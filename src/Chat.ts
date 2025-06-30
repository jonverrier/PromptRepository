/**
 * @module Chat
 * 
 * Base functionality for interacting with OpenAI's chat completion API.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole } from './entry';
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
         // Handle rate limiting with exponential backoff
         if (error?.status === 429 && retryCount < maxRetries) {
            await exponentialBackoff(retryCount);
            retryCount++;
            continue;
         }
         
         // Handle OpenAI refusal errors - these should not be retried
         if (error?.status === 400) {
            // Check for specific refusal error types
            if (error?.error?.type === 'content_filter' || 
                error?.error?.code === 'content_filter' ||
                error?.message?.toLowerCase().includes('content filter')) {
               throw new Error(`OpenAI content filter triggered: ${error?.error?.message || error?.message || 'Content violates OpenAI safety policies'}`);
            }
            
            if (error?.error?.type === 'safety' || 
                error?.error?.code === 'safety' ||
                error?.message?.toLowerCase().includes('safety')) {
               throw new Error(`OpenAI safety system triggered: ${error?.error?.message || error?.message || 'Content violates OpenAI safety guidelines'}`);
            }
            
            if (error?.error?.type === 'invalid_request' && 
                (error?.error?.message?.toLowerCase().includes('refuse') ||
                 error?.error?.message?.toLowerCase().includes('cannot') ||
                 error?.error?.message?.toLowerCase().includes('unable'))) {
               throw new Error(`OpenAI refused request: ${error?.error?.message || error?.message || 'Request was refused by OpenAI'}`);
            }
         }
         
         // Handle other 4xx errors that indicate refusal
         if (error?.status >= 400 && error?.status < 500) {
            if (error?.message?.toLowerCase().includes('refuse') ||
                error?.message?.toLowerCase().includes('cannot') ||
                error?.message?.toLowerCase().includes('unable') ||
                error?.message?.toLowerCase().includes('forbidden')) {
               throw new Error(`OpenAI refused request (${error.status}): ${error?.message || 'Request was refused'}`);
            }
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

   protected shouldUseToolMessages(): boolean {
      // Default implementation - subclasses can override
      return false;
   }

   protected abstract getModelName(): string;

   protected createCompletionConfig(
      systemPrompt: string | undefined,
      messages: IChatMessage[],
      functions?: IFunction[],
      useToolMessages?: boolean
   ): any {
      const filteredMessages = messages.filter(msg => msg.role !== EChatRole.kFunction);
      const formattedMessages = filteredMessages.map(msg => {
         const isAssistantWithFunctionCall = msg.role === EChatRole.kAssistant && msg.function_call;
         const baseMessage: any = {
            role: msg.role === EChatRole.kUser ? 'user' : 
                  msg.role === EChatRole.kAssistant ? 'assistant' : 
                  msg.role === EChatRole.kFunction ? 'function' : 'user',
            content: isAssistantWithFunctionCall ? '' : msg.content
         };

         // Add name property for function messages
         if (msg.role === EChatRole.kFunction && msg.name) {
            baseMessage.name = msg.name;
         }

         return baseMessage;
      });

      const config: any = {
         model: this.getModelName(),
         input: formattedMessages,
         ...(systemPrompt && { instructions: systemPrompt }),
         temperature: 0.25
      };

      // Add functions to the configuration if provided
      if (functions && functions.length > 0) {
         config.tools = functions.map(func => {
            const tool = {
               name: func.name,
               description: func.description,
               type: 'function',
               parameters: {
                  type: 'object',
                  properties: func.inputSchema.properties,
                  required: func.inputSchema.required,
                  additionalProperties: false
               }
            };
            return tool;
         });
      }

      return config;
   }

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
         let config = this.createCompletionConfig(systemPrompt, messages, functions, false);
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
                     let functionResult: any;
                     
                     try {
                        // Parse function arguments
                        try {
                           functionArgs = JSON.parse(call.arguments);
                        } catch (e) {
                           functionResult = {
                              error: true,
                              message: `Failed to parse function call arguments: ${e instanceof Error ? e.message : String(e)}`,
                              functionName: functionName,
                              timestamp: new Date().toISOString()
                           };
                        }
                        
                        // Find the function
                        const func = functions.find(f => f.name === functionName);
                        if (!func) {
                           functionResult = {
                              error: true,
                              message: `Function ${functionName} not found in provided functions`,
                              functionName: functionName,
                              timestamp: new Date().toISOString()
                           };
                        } else if (!functionResult) {
                           // Validate and execute only if no previous errors occurred
                           try {
                              const validatedArgs = func.validateArgs(functionArgs);
                              functionResult = await func.execute(validatedArgs);
                           } catch (error) {
                              // Set functionResult to an error string including exception details
                              const errorMessage = error instanceof Error ? error.message : String(error);
                              functionResult = {
                                 error: true,
                                 message: `Function execution failed: ${errorMessage}`,
                                 functionName: functionName,
                                 timestamp: new Date().toISOString()
                              };
                           }
                        }
                     } catch (error) {
                        // Catch any unexpected errors
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        functionResult = {
                           error: true,
                           message: `Unexpected error: ${errorMessage}`,
                           functionName: functionName,
                           timestamp: new Date().toISOString()
                        };
                     }

                     // Use the shouldUseToolMessages method to determine message type
                     if (!this.shouldUseToolMessages()) {
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
                  config = this.createCompletionConfig(systemPrompt, currentMessages, functions, false);
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

      const config = this.createCompletionConfig(systemPrompt, messages, functions, false);
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

      const config = this.createCompletionConfig(systemPrompt, messages, functions, false);
      config.text = { format: { type: "json_schema", strict: true, name: "constrainedOutput", schema: jsonSchema } };

      const response = await retryWithExponentialBackoff(() => 
         this.openai.responses.parse(config)
      );
      return (response.output_parsed as T) ?? defaultValue;
   }
}
