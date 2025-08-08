/**
 * @module Chat
 * 
 * Base functionality for interacting with OpenAI's chat completion API.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole } from './entry';
import { IChatDriver, EModel, IChatMessage, IFunction } from './entry';
import { retryWithExponentialBackoff } from './DriverHelpers';

interface AsyncResponse {
    [Symbol.asyncIterator](): AsyncIterator<any>;
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
         ...(systemPrompt && { instructions: systemPrompt })
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

   /**
    * Creates a user message with the given prompt
    */
   protected createUserMessage(userPrompt: string): IChatMessage {
      return {
         role: EChatRole.kUser,
         content: userPrompt,
         timestamp: new Date(),
         id: `user-${Date.now()}`,
         className: 'user-message'
      };
   }

   /**
    * Builds the complete message array including history and new user message
    */
   protected buildMessageArray(messageHistory: IChatMessage[] | undefined, userPrompt: string): IChatMessage[] {
      return [
         ...(messageHistory || []),
         this.createUserMessage(userPrompt)
      ];
   }

   /**
    * Handles a single function call and returns the result
    */
   protected async handleFunctionCall(call: any, functions: IFunction[]): Promise<IChatMessage> {
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
         return {
            role: EChatRole.kAssistant,
            content: `Function ${functionName} returned: ${JSON.stringify(functionResult)}`,
            timestamp: new Date(),
            id: `assistant-${Date.now()}`,
            className: 'assistant-message'
         };
      } else {
         return {
            role: EChatRole.kTool,
            name: functionName,
            tool_call_id: call.call_id,
            content: JSON.stringify(functionResult),
            timestamp: new Date(),
            id: `tool-${Date.now()}`,
            className: 'tool-message'
         };
      }
   }

   /**
    * Processes tool calls and returns tool messages
    */
   protected async processToolCalls(toolCalls: any[], functions: IFunction[]): Promise<IChatMessage[]> {
      const toolMessages: IChatMessage[] = [];
      for (const call of toolCalls) {
         const toolMessage = await this.handleFunctionCall(call, functions);
         toolMessages.push(toolMessage);
      }
      return toolMessages;
   }

   /**
    * Extracts text content from response output array
    */
   protected extractTextFromOutput(outputArr: any[]): string | null {
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
      return null;
   }

   /**
    * Handles the tool use loop for both streaming and non-streaming responses
    */
   protected async handleToolUseLoop(
      systemPrompt: string | undefined,
      messages: IChatMessage[],
      functions: IFunction[] | undefined,
      createResponse: (config: any) => Promise<any>
   ): Promise<string> {
      let config = this.createCompletionConfig(systemPrompt, messages, functions, false);
      let response = await createResponse(config);

      // Tool use loop: keep handling tool calls until we get a text response or hit max rounds
      let toolUseRounds = 0;
      const MAX_TOOL_USE_ROUNDS = 50;
      let currentMessages = messages;
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         // Check for function/tool calls in output array (new API)
         const outputArr = (response as any).output;
         if (outputArr && Array.isArray(outputArr)) {
            // If any function_call, handle tool use
            const toolCalls = outputArr.filter((item: any) => item.type === 'function_call');
            if (toolCalls.length > 0 && functions) {
               const toolMessages = await this.processToolCalls(toolCalls, functions);
               
               // Add tool messages to the conversation history
               currentMessages = [
                  ...currentMessages,
                  ...toolMessages
               ];
               
               // Re-invoke the model with the tool result(s)
               config = this.createCompletionConfig(systemPrompt, currentMessages, functions, false);
               response = await createResponse(config);
               toolUseRounds++;
               continue;
            }
            
            // If any text output, return it
            const textContent = this.extractTextFromOutput(outputArr);
            if (textContent) {
               return textContent;
            }
         }            
      }
      throw new Error('No response content received from OpenAI');
   }

   async getModelResponse(systemPrompt: string | undefined, 
      userPrompt: string, 
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): Promise<string> {

      const messages = this.buildMessageArray(messageHistory, userPrompt);

      try {
         return await this.handleToolUseLoop(
            systemPrompt,
            messages,
            functions,
            (config) => retryWithExponentialBackoff(() => this.openai.responses.create(config))
         );
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
         
      const messages = this.buildMessageArray(messageHistory, userPrompt);
      let currentMessages = messages;
      let toolUseRounds = 0;
      const MAX_TOOL_USE_ROUNDS = 50;
      
      let streamPromise: Promise<any> | null = null;
      let streamIterator: AsyncIterator<any> | null = null;
      let isInToolUseMode = false;
      let pendingToolCalls: any[] = [];
      let toolCallBuffer = '';
      let pendingErrorToEmit: string | null = null;
      let textBuffer = '';
      let hasStartedFunctionCall = false;
      let functionCallInProgress = false;
      let functionCallBuffer = '';
      let accumulatedText = '';

      // Capture 'this' reference for use in the iterator
      const self = this;

      const createStreamConfig = () => {
         const config = self.createCompletionConfig(systemPrompt, currentMessages, functions, false);
         config.stream = true;
         return config;
      };

      const initializeStream = async () => {
         if (!streamPromise) {
            const config = createStreamConfig();
            streamPromise = retryWithExponentialBackoff(async () => {
               try {
                  return await self.openai.responses.create(config);
               } catch (error: any) {
                  // Check if this is a streaming verification error
                  if (error?.code === 'unsupported_value' && error?.param === 'stream') {
                     // Fall back to non-streaming and simulate chunks
                     console.warn('OpenAI streaming not available, falling back to simulated streaming');
                     const nonStreamConfig = { ...config };
                     delete nonStreamConfig.stream;
                     return await self.openai.responses.create(nonStreamConfig);
                  } else {
                     throw error;
                  }
               }
            });
         }
         
         if (!streamIterator) {
            const stream = await streamPromise;
            if (Symbol.asyncIterator in stream) {
               streamIterator = (stream as unknown as AsyncResponse)[Symbol.asyncIterator]();
            } else {
               // This is likely a non-streaming response, create a simulated iterator
               streamIterator = self.createSimulatedStreamIterator(stream);
            }
         }
      };

      const resetStream = () => {
         streamPromise = null;
         streamIterator = null;
         textBuffer = '';
         hasStartedFunctionCall = false;
         functionCallInProgress = false;
         functionCallBuffer = '';
         accumulatedText = '';
      };

      // Helper function to detect and filter function call content
      const isFunctionCallContent = (text: string): boolean => {
         // Check if text looks like JSON function call arguments
         const trimmed = text.trim();
         if (trimmed.startsWith('{') && trimmed.includes('"')) {
            return true;
         }
         return false;
      };

      const filterFunctionCallContent = (text: string): string => {
         // Try to find and remove JSON object at the beginning of text
         const trimmed = text.trim();
         
         if (!trimmed.startsWith('{')) {
            return text;
         }
         
         try {
            // Find the end of the JSON object
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let jsonEndIndex = -1;
            
            for (let i = 0; i < trimmed.length; i++) {
               const char = trimmed[i];
               
               if (escapeNext) {
                  escapeNext = false;
                  continue;
               }
               
               if (char === '\\') {
                  escapeNext = true;
                  continue;
               }
               
               if (char === '"' && !escapeNext) {
                  inString = !inString;
                  continue;
               }
               
               if (!inString) {
                  if (char === '{') {
                     braceCount++;
                  } else if (char === '}') {
                     braceCount--;
                     if (braceCount === 0) {
                        jsonEndIndex = i;
                        break;
                     }
                  }
               }
            }
            
            if (jsonEndIndex !== -1) {
               // Remove the JSON object and any leading whitespace
               const remainingText = trimmed.substring(jsonEndIndex + 1).trim();
               return remainingText;
            }
         } catch (error) {
            // If parsing fails, return original text
            console.warn('Failed to parse function call JSON:', error);
         }
         
         return text;
      };

      return {
         async next(): Promise<IteratorResult<string>> {
            try {
               // If we have a pending error to emit, do so and clear it
               if (pendingErrorToEmit) {
                  const err = pendingErrorToEmit;
                  pendingErrorToEmit = null;
                  return { value: err, done: false };
               }

               await initializeStream();

                  if (streamIterator) {
                     let chunk;
                     try {
                        chunk = await streamIterator.next();
                     } catch (error) {
                        // Handle mid-stream errors gracefully
                        return { 
                           value: '\n\nSorry, it looks like the response was interrupted. Please try again.', 
                           done: true 
                        };
                     }
                     
                     if (chunk.done) {
                     // Check if we have a complete response to process
                     if (isInToolUseMode && pendingToolCalls.length > 0 && functions) {
                        // Process tool calls
                        const toolMessages = await self.processToolCalls(pendingToolCalls, functions);
                        currentMessages = [...currentMessages, ...toolMessages];

                        // Check for error in toolMessages
                        const errorMsg = toolMessages
                          .map(msg => {
                            try {
                              const content = typeof msg.content === 'string' ? msg.content : '';
                              const parsed = JSON.parse(content);
                              if (parsed && parsed.error && parsed.message) {
                                return `Function ${parsed.functionName || ''} error: ${parsed.message}`;
                              }
                            } catch { /* ignore */ }
                            // fallback: look for error in string
                            if (typeof msg.content === 'string' && msg.content.toLowerCase().includes('error')) {
                              return msg.content;
                            }
                            return null;
                          })
                          .find(Boolean);
                        if (errorMsg) {
                          pendingErrorToEmit = errorMsg;
                        }
                        
                        // Reset for next round
                        resetStream();
                        pendingToolCalls = [];
                        toolCallBuffer = '';
                        isInToolUseMode = false;
                        toolUseRounds++;
                        textBuffer = '';
                        hasStartedFunctionCall = false;
                        
                        if (toolUseRounds >= MAX_TOOL_USE_ROUNDS) {
                           throw new Error('Maximum tool use rounds exceeded');
                        }
                        
                        // Continue with next iteration to get the final response
                        return this.next();
                     }
                     
                     // If we had function calls but no more pending calls, we need to get the final response
                     if (hasStartedFunctionCall && !isInToolUseMode && pendingToolCalls.length === 0) {
                        // Reset and continue to get the final text response
                        resetStream();
                        return this.next();
                     }
                     
                     resetStream();
                     return { value: '', done: true };
                  }

                  // Handle streaming chunks
                  if (chunk.value && typeof chunk.value === 'object') {
                     // Check for function call chunks
                     if (chunk.value.type === 'function_call') {
                        isInToolUseMode = true;
                        hasStartedFunctionCall = true;
                        pendingToolCalls.push(chunk.value);
                        return { value: '', done: false };
                     }
                     
                     // Check for function call completion in output_item.done
                     if (chunk.value.type === 'response.output_item.done' && chunk.value.item && chunk.value.item.type === 'function_call') {
                        isInToolUseMode = true;
                        hasStartedFunctionCall = true;
                        pendingToolCalls.push(chunk.value.item);
                        return { value: '', done: false };
                     }
                     
                     // Check for text chunks - handle different streaming formats
                     if ('delta' in chunk.value && typeof chunk.value.delta === 'string') {
                        const delta = chunk.value.delta;
                        
                        if (isInToolUseMode || hasStartedFunctionCall) {
                           // Buffer text during tool use mode or after function call started
                           toolCallBuffer += delta;
                           return { value: '', done: false };
                        } else {
                           // Accumulate text to check for function call patterns
                           accumulatedText += delta;
                           
                           // Check if accumulated text contains function call content
                           if (isFunctionCallContent(accumulatedText)) {
                              functionCallInProgress = true;
                              functionCallBuffer += delta;
                              return { value: '', done: false };
                           } else if (functionCallInProgress) {
                              // We're in the middle of a function call, continue buffering
                              functionCallBuffer += delta;
                              return { value: '', done: false };
                           } else {
                              // Check if we can safely return accumulated text
                              const filteredText = filterFunctionCallContent(accumulatedText);
                              if (filteredText !== accumulatedText) {
                                 // Function call was detected and filtered, reset and return clean text
                                 accumulatedText = '';
                                 return { value: filteredText, done: false };
                              } else if (!accumulatedText.includes('{')) {
                                 // No JSON detected, safe to return
                                 const textToReturn = accumulatedText;
                                 accumulatedText = '';
                                 return { value: textToReturn, done: false };
                              } else {
                                 // Might be partial JSON, continue accumulating
                                 return { value: '', done: false };
                              }
                           }
                        }
                     }
                     
                     // Check for response.output_text.delta format
                     if (chunk.value.type === 'response.output_text.delta' && typeof chunk.value.delta === 'string') {
                        const delta = chunk.value.delta;
                        
                        if (isInToolUseMode || hasStartedFunctionCall) {
                           // Buffer text during tool use mode or after function call started
                           toolCallBuffer += delta;
                           return { value: '', done: false };
                        } else {
                           // Accumulate text to check for function call patterns
                           accumulatedText += delta;
                           
                           // Check if accumulated text contains function call content
                           if (isFunctionCallContent(accumulatedText)) {
                              functionCallInProgress = true;
                              functionCallBuffer += delta;
                              return { value: '', done: false };
                           } else if (functionCallInProgress) {
                              // We're in the middle of a function call, continue buffering
                              functionCallBuffer += delta;
                              return { value: '', done: false };
                           } else {
                              // Check if we can safely return accumulated text
                              const filteredText = filterFunctionCallContent(accumulatedText);
                              if (filteredText !== accumulatedText) {
                                 // Function call was detected and filtered, reset and return clean text
                                 accumulatedText = '';
                                 return { value: filteredText, done: false };
                              } else if (!accumulatedText.includes('{')) {
                                 // No JSON detected, safe to return
                                 const textToReturn = accumulatedText;
                                 accumulatedText = '';
                                 return { value: textToReturn, done: false };
                              } else {
                                 // Might be partial JSON, continue accumulating
                                 return { value: '', done: false };
                              }
                           }
                        }
                     }
                     
                     // Check for complete response chunks
                     if (chunk.value.output && Array.isArray(chunk.value.output)) {
                        const outputArr = chunk.value.output;
                        
                        // Check for function calls
                        const toolCalls = outputArr.filter((item: any) => item.type === 'function_call');
                        if (toolCalls.length > 0 && functions) {
                           isInToolUseMode = true;
                           hasStartedFunctionCall = true;
                           pendingToolCalls = toolCalls;
                           return { value: '', done: false };
                        }
                        
                        // Check for text output
                        const textContent = self.extractTextFromOutput(outputArr);
                        if (textContent) {
                           // Filter out function call content if present
                           const filteredContent = filterFunctionCallContent(textContent);
                           if (filteredContent && filteredContent !== textContent) {
                              return { value: filteredContent, done: false };
                           } else if (filteredContent && !hasStartedFunctionCall) {
                              return { value: filteredContent, done: false };
                           }
                        }
                     }
                     
                     // Handle end of function call content
                     if (functionCallInProgress && chunk.done) {
                        functionCallInProgress = false;
                        functionCallBuffer = '';
                        return { value: '', done: false };
                     }
                     
                     // Handle end of stream with accumulated text
                     if (chunk.done && accumulatedText) {
                        const filteredText = filterFunctionCallContent(accumulatedText);
                        accumulatedText = '';
                        if (filteredText) {
                           return { value: filteredText, done: false };
                        }
                     }
                  }
               }

               return { value: '', done: false };
            } catch (error) {
               resetStream();
               // Handle any unhandled streaming errors gracefully
               return { 
                  value: '\n\nSorry, it looks like the response was interrupted. Please try again.', 
                  done: true 
               };
            }
         },
         return(): Promise<IteratorResult<string>> {
            resetStream();
            return Promise.resolve({ value: '', done: true });
         },
         throw(error: any): Promise<IteratorResult<string>> {
            resetStream();
            return Promise.reject(error);
         }
      };
   }

   /**
    * Creates a simulated stream iterator for non-streaming responses
    * This is used as a fallback when streaming is not available
    */
   private createSimulatedStreamIterator(response: any): AsyncIterator<any> {
      let content = '';
      let isDone = false;
      
      // Extract content from the response
      if (response.output && response.output.length > 0) {
         content = response.output[0].content || '';
      }
      
      // If no content found, return empty iterator
      if (!content) {
         return {
            async next(): Promise<IteratorResult<any>> {
               return { done: true, value: undefined };
            }
         };
      }
      
      // Split content into smaller chunks for more realistic streaming (1-2 words per chunk)
      const words = content.split(' ').filter(word => word.trim().length > 0);
      const chunks: string[] = [];
      
      for (let i = 0; i < words.length; i += 2) { // Group 2 words together
         const chunk = words.slice(i, i + 2).join(' ');
         chunks.push(chunk);
      }
      

      
      let currentIndex = 0;
      
      return {
         async next(): Promise<IteratorResult<any>> {
            if (isDone || currentIndex >= chunks.length) {
               return { done: true, value: undefined };
            }
            
            const chunk = chunks[currentIndex];
            currentIndex++;
            
            // Add space after chunk except for last chunk
            const chunkText = currentIndex < chunks.length ? chunk + ' ' : chunk;
            
            if (currentIndex >= chunks.length) {
               isDone = true;
            }
            
            return {
               done: false,
               value: {
                  type: 'response.output_text.delta',
                  delta: chunkText
               }
            };
         },
         async return(): Promise<IteratorResult<any>> {
            isDone = true;
            return { done: true, value: undefined };
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
      const messages = this.buildMessageArray(messageHistory, userPrompt);

      const config = this.createCompletionConfig(systemPrompt, messages, functions, false);
      config.text = { format: { type: "json_schema", strict: true, name: "constrainedOutput", schema: jsonSchema } };

      const response = await retryWithExponentialBackoff(() => 
         this.openai.responses.parse(config)
      );
      return (response.output_parsed as T) ?? defaultValue;
   }
}
