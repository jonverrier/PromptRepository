/**
 * @module Chat
 * 
 * Base functionality for interacting with OpenAI's chat completion API.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole, IFunctionCall } from './entry';
import { IChatDriver, EModel, IChatMessage, IFunction } from './entry';

interface AsyncResponse {
    [Symbol.asyncIterator](): AsyncIterator<any>;
}

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function exponentialBackoff(retryCount: number): Promise<void> {
   const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
   await new Promise(resolve => setTimeout(resolve, delay));
}

async function retryWithExponentialBackoff<T>(
   operation: () => Promise<T>,
   maxRetries: number = MAX_RETRIES
): Promise<T> {
   let retryCount = 0;
   
   while (true) {
      try {
         return await operation();
      } catch (error: any) {
         if (error?.status === 429 && retryCount < maxRetries) {
            await exponentialBackoff(retryCount);
            retryCount++;
            continue;
         }
         throw error;
      }
   }
}

/**
 * Abstract base class for OpenAI model drivers.
 * Provides common functionality for interacting with OpenAI's API
 * including authentication and error handling.
 * 
 * @implements {IChatDriver}
 * @abstract
 * 
 * @property {string} model - The OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export abstract class OpenAIModelChatDriver implements IChatDriver {
   protected openai!: OpenAI;

   constructor(protected modelType: EModel) {}

   protected abstract createCompletionConfig(systemPrompt: string | undefined, messages: IChatMessage[], functions?: IFunction[]): any;

   async getModelResponse(systemPrompt: string | undefined, 
      userPrompt: string, 
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): Promise<string> {

      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      try {
         let config = this.createCompletionConfig(systemPrompt, messages, functions);
         let response = await retryWithExponentialBackoff(() => 
            this.openai.responses.create(config)
         );

         // Tool use loop: keep handling tool calls until we get a text response or hit max rounds
         let toolUseRounds = 0;
         const MAX_TOOL_USE_ROUNDS = 50;
         let currentMessages = messages;
         while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
            // Check for function/tool calls in output array (new API)
            const outputArr = (response as any).output;
            if (outputArr && Array.isArray(outputArr)) {
               // Enable this when debugging: print the output array each round
               // console.log(`Tool use round ${toolUseRounds + 1}, output:`, JSON.stringify(outputArr, null, 2));
               
               // If any function_call, handle tool use
               const toolCalls = outputArr.filter((item: any) => item.type === 'function_call');
               if (toolCalls.length > 0 && functions) {
                  const toolMessages: IChatMessage[] = [];
                  for (const call of toolCalls) {
                     const functionName = call.name;
                     let functionArgs: any = {};
                     try {
                        functionArgs = JSON.parse(call.arguments);
                     } catch (e) {
                        throw new Error('Failed to parse function call arguments');
                     }
                     const func = functions.find(f => f.name === functionName);
                     if (!func) {
                        throw new Error(`Function ${functionName} not found in provided functions`);
                     }
                     // Validate and execute
                     const validatedArgs = func.validateArgs(functionArgs);
                     const functionResult = await func.execute(validatedArgs);

                     // For OpenAI (which doesn't support 'tool' role), send as assistant message
                     // For Azure OpenAI, send as tool message
                     const isOpenAI = this.constructor.name === 'OpenAIChatDriver';
                     if (isOpenAI) {
                        toolMessages.push({
                           role: EChatRole.kAssistant,
                           content: `Function ${functionName} returned: ${JSON.stringify(functionResult)}`,
                           timestamp: new Date(),
                           id: `assistant-${Date.now()}`,
                           className: 'assistant-message'
                        });
                     } else {
                        toolMessages.push({
                           role: EChatRole.kTool,
                           name: functionName,
                           tool_call_id: call.call_id,
                           content: JSON.stringify(functionResult),
                           timestamp: new Date(),
                           id: `tool-${Date.now()}`,
                           className: 'tool-message'
                        });
                     }
                  }
                  // Add tool messages to the conversation history
                  currentMessages = [
                     ...currentMessages,
                     ...toolMessages
                  ];
                  // Re-invoke the model with the tool result(s)
                  config = this.createCompletionConfig(systemPrompt, currentMessages, functions);
                  response = await retryWithExponentialBackoff(() => 
                     this.openai.responses.create(config)
                  );
                  toolUseRounds++;
                  continue;
               }
               // If any text output, return it
               const textOutput = outputArr.find((item: any) => 
                  item.type === 'text' || 
                  (item.type === 'message' && item.content && Array.isArray(item.content) && 
                   item.content.find((c: any) => c.type === 'output_text'))
               );
               if (textOutput) {
                  if (textOutput.type === 'text' && textOutput.content) {
                     return textOutput.content;
                  } else if (textOutput.type === 'message' && textOutput.content) {
                     const textContent = textOutput.content.find((c: any) => c.type === 'output_text');
                     if (textContent && textContent.text) {
                        return textContent.text;
                     }
                  }
               }
            }            
         }
         throw new Error('No response content received from OpenAI');
      } catch (error) {
         if (error instanceof Error) {
            throw new Error(`OpenAI API error: ${error.message}`);
         }
         throw new Error('Unknown error occurred while calling OpenAI API');
      }
   }

   getStreamedModelResponse(systemPrompt: string | undefined, 
      userPrompt: string, 
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): AsyncIterator<string> {
         
      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      const config = this.createCompletionConfig(systemPrompt, messages, functions);
      config.stream = true;

      let streamPromise = retryWithExponentialBackoff(() => 
         this.openai.responses.create(config)
      );
      let streamIterator: AsyncIterator<any> | null = null;

      return {
         async next(): Promise<IteratorResult<string>> {
            try {
               if (!streamIterator) {
                  const stream = await streamPromise;
                  if (Symbol.asyncIterator in stream) {
                     streamIterator = (stream as unknown as AsyncResponse)[Symbol.asyncIterator]();
                  } else {
                     throw new Error('Stream does not support async iteration');
                  }
               }

               if (streamIterator) {
                  let looking = true;
                  while (looking) {
                     const chunk = await streamIterator.next();
                     if (chunk.done) {
                        streamIterator = null;
                        return { value: '', done: true };
                     }

                     if ('delta' in chunk.value && typeof chunk.value.delta === 'string') {
                        looking = false;
                        return { value: chunk.value.delta, done: false };
                     }
                  }
               }

               return { value: '', done: true };
            } catch (error) {
               streamIterator = null;
               if (error instanceof Error) {
                  throw new Error(`Stream error: ${error.message}`);
               }
               throw error;
            }
         },
         return(): Promise<IteratorResult<string>> {
            streamIterator = null;
            return Promise.resolve({ value: '', done: true });
         },
         throw(error: any): Promise<IteratorResult<string>> {
            streamIterator = null;
            return Promise.reject(error);
         }
      };
   }

   async getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T> {
      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      const config = this.createCompletionConfig(systemPrompt, messages, functions);
      config.text = { format: { type: "json_schema", strict: true, name: "constrainedOutput", schema: jsonSchema } };

      const response = await retryWithExponentialBackoff(() => 
         this.openai.responses.parse(config)
      );
      return (response.output_parsed as T) ?? defaultValue;
   }
}
