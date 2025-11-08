/**
 * @module Chat.GenericOpenAI
 * 
 * Generic base functionality for interacting with OpenAI-compatible APIs.
 * This includes both native OpenAI and Azure OpenAI implementations.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole, EVerbosity } from './entry';
import { IChatDriver, EModel, IChatMessage, IFunction } from './entry';
import { retryWithExponentialBackoff } from './DriverHelpers';
import { ChatDriver } from './Chat';

interface AsyncResponse {
    [Symbol.asyncIterator](): AsyncIterator<any>;
}

/**
 * Abstract base class for OpenAI-compatible model drivers.
 * Provides common functionality for interacting with OpenAI's Responses API
 * including authentication, error handling, and function calling.
 * 
 * @extends {ChatDriver}
 * @abstract
 * 
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export abstract class GenericOpenAIChatDriver extends ChatDriver {
   protected openai!: OpenAI;

   constructor(modelType: EModel) {
      super(modelType);
   }

   protected shouldUseToolMessages(): boolean {
      // Default implementation - subclasses can override
      return false;
   }

   protected abstract getModelName(): string;

   protected createResponseConfig(
      systemPrompt: string | undefined,
      messages: IChatMessage[],
      verbosity: EVerbosity,
      functions?: IFunction[],
      useToolMessages?: boolean,
      forceToolUse?: boolean
   ): any {
      const filteredMessages = messages.filter(msg => msg.role !== EChatRole.kFunction);
      const formattedMessages = filteredMessages.map(msg => {
         // Handle function_call_output messages (Responses API format)
         if ((msg as any).type === "function_call_output") {
            return {
               type: "function_call_output",
               call_id: (msg as any).call_id,
               output: (msg as any).output
            };
         }

         const isAssistantWithFunctionCall = msg.role === EChatRole.kAssistant && msg.function_call;
         const isAssistantWithToolCalls = msg.role === EChatRole.kAssistant && (msg as any).tool_calls;
         const baseMessage: any = {
            role: msg.role === EChatRole.kUser ? 'user' : 
                  msg.role === EChatRole.kAssistant ? 'assistant' : 
                  msg.role === EChatRole.kFunction ? 'function' :
                  msg.role === EChatRole.kTool ? 'tool' : 'user',
            content: (isAssistantWithFunctionCall || isAssistantWithToolCalls) ? '' : (msg.content || '')
         };

         // Add tool_calls for assistant messages with tool calls (Responses API format)
         if (isAssistantWithToolCalls) {
            baseMessage.tool_calls = (msg as any).tool_calls;
         }

         // Add name property for function messages
         if (msg.role === EChatRole.kFunction && msg.name) {
            baseMessage.name = msg.name;
         }

         // Add tool_call_id for tool messages (required by Responses API)
         if (msg.role === EChatRole.kTool && msg.tool_call_id) {
            baseMessage.tool_call_id = msg.tool_call_id;
         }

         return baseMessage;
      });

      // Map EVerbosity enum to Responses API verbosity values
      // Note: Azure GPT-4.1 only supports 'medium', so we map high to medium for Azure
      const currentModelName = this.getModelName();
      const isAzureModel = currentModelName.startsWith('gpt-4.1');
      
      const verbosityMap: Record<EVerbosity, string> = {
         [EVerbosity.kLow]: isAzureModel ? 'medium' : 'low',
         [EVerbosity.kMedium]: 'medium',
         [EVerbosity.kHigh]: isAzureModel ? 'medium' : 'high'
      };

      // Map EVerbosity to thinking time (one level below verbosity)
      const thinkingTimeMap: Record<EVerbosity, string> = {
         [EVerbosity.kLow]: 'low',      // Low verbosity -> low thinking
         [EVerbosity.kMedium]: 'low',   // Medium verbosity -> low thinking  
         [EVerbosity.kHigh]: 'medium'   // High verbosity -> medium thinking
      };

      // Build messages array with system prompt if provided
      const allMessages = systemPrompt 
         ? [{ role: 'system', content: systemPrompt }, ...formattedMessages]
         : formattedMessages;

      // For Responses API, we use a different structure
      const config: any = {
         model: this.getModelName(),
         input: allMessages,
         text: {
            verbosity: verbosityMap[verbosity] // Add verbosity parameter for GPT-5
         }
      };

      // Add thinking time for GPT-5 models (one level below verbosity)
      const modelName = this.getModelName();
      if (modelName.startsWith('gpt-5')) {
         config.reasoning = {
            effort: thinkingTimeMap[verbosity]
         };
      }

      // Add functions to the configuration if provided
      if (functions && functions.length > 0) {
         config.tools = functions.map(func => {
            // Try a flatter structure that might work better with Responses API
            const tool = {
               type: 'function',
               name: func.name,
               description: func.description,
               parameters: {
                  type: 'object',
                  properties: func.inputSchema.properties,
                  required: func.inputSchema.required,
                  additionalProperties: false
               }
            };
            // Schema is correctly formatted for Responses API
            return tool;
         });
         // Configure tool choice - only force tools when explicitly requested
         config.tool_choice = forceToolUse ? "required" : "auto";
         
      }

      return config;
   }

   /**
    * Handles a single function call and returns the result
    */
   protected async handleFunctionCall(call: any, functions: IFunction[], toolCallId?: string): Promise<IChatMessage> {
      const functionName = call.function_call?.name || call.name;
      let functionArgs: any = {};
      let functionResult: any;
      
      try {
         // Parse function arguments
         try {
            const argsString = call.function_call?.arguments || call.arguments;
            functionArgs = JSON.parse(argsString);
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

      // For Responses API, use function_call_output format (not assistant messages)
      // We need to satisfy IChatMessage interface while adding Responses API fields
      const message: IChatMessage & { type?: string; call_id?: string; output?: string } = {
         role: EChatRole.kAssistant, // Required by IChatMessage interface
         content: undefined, // Will be ignored due to type field
         type: "function_call_output",
         call_id: toolCallId,
         output: JSON.stringify(functionResult),
         timestamp: new Date(),
         id: `function-output-${Date.now()}`,
         className: 'function-output-message'
      };
      console.log(`[FUNCTION MESSAGE] Created function_call_output message:`, {
         type: message.type,
         call_id: message.call_id,
         output: message.output ? message.output.substring(0, 200) + (message.output.length > 200 ? '...' : '') : ''
      });
      return message;
   }

   /**
    * Processes tool calls and returns tool messages
    */
   protected async processToolCalls(toolCalls: any[], functions: IFunction[]): Promise<IChatMessage[]> {
      const toolMessages: IChatMessage[] = [];
      for (const call of toolCalls) {
         const toolMessage = await this.handleFunctionCall(call, functions, call.id);
         toolMessages.push(toolMessage);
      }
      return toolMessages;
   }

   /**
    * Processes OpenAI tool calls and returns tool messages
    */
   protected async processOpenAIToolCalls(toolCalls: any[], functions: IFunction[]): Promise<IChatMessage[]> {
      const toolMessages: IChatMessage[] = [];
      for (const call of toolCalls) {
         // Convert OpenAI tool call format to our internal format
         const convertedCall = {
            type: 'function_call',
            function_call: {
               name: call.function.name,
               arguments: call.function.arguments
            }
         };
         const toolMessage = await this.handleFunctionCall(convertedCall, functions, call.id);
         toolMessages.push(toolMessage);
      }
      return toolMessages;
   }

   /**
    * Extracts text content from response output array
    */
   protected extractTextFromOutput(outputArr: any[]): string | null {
      // Handle different possible output structures
      for (const item of outputArr) {
         if (item.type === 'text' && item.text) {
            return item.text;
         } else if (item.type === 'message' && item.content) {
            if (typeof item.content === 'string') {
               return item.content;
            } else if (Array.isArray(item.content)) {
               const textContent = item.content.find((c: any) => c.type === 'text' || c.type === 'output_text');
               if (textContent && textContent.text) {
                  return textContent.text;
               }
            }
         } else if (typeof item === 'string') {
            return item;
         } else if (item.content && typeof item.content === 'string') {
            return item.content;
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
      verbosity: EVerbosity,
      functions: IFunction[] | undefined,
      createResponse: (config: any) => Promise<any>
   ): Promise<string> {
      let config = this.createResponseConfig(systemPrompt, messages, verbosity, functions, false, false);
      let response = await createResponse(config);

      // Tool use loop: keep handling tool calls until we get a text response or hit max rounds
      let toolUseRounds = 0;
      const MAX_TOOL_USE_ROUNDS = 5; // Reduce to prevent infinite loops
      let currentMessages = messages;
      let lastFunctionCall: string | null = null;
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         // Check for function/tool calls in Responses API format
         const output = response.output;
         if (output) {
            // Extract text content from the output array
            const textContent = this.extractTextFromOutput(output);
            
            // Check for function calls in the output array (Responses API format)
            const functionCalls = output.filter((item: any) => item.type === 'function_call');
            if (functionCalls.length > 0 && functions) {
               // Check for repeated function calls to prevent infinite loops
               const currentFunctionCall = `${functionCalls[0].name}:${functionCalls[0].arguments}`;
               
               if (lastFunctionCall === currentFunctionCall && toolUseRounds > 0) {
                  // Return a helpful message instead of looping
                  return "Sorry, we had an internal error caling tools. Please try again, or report the error if it recurs.";
               }
               lastFunctionCall = currentFunctionCall;
               
               // Convert Responses API function calls to OpenAI tool call format
               const convertedCalls = functionCalls.map((call: any) => ({
                  type: 'function',
                  function: {
                     name: call.name,
                     arguments: call.arguments || '{}'
                  },
                  id: call.call_id
               }));
               
               const toolMessages = await this.processOpenAIToolCalls(convertedCalls, functions);
               
               // Add assistant message from API response AND function_call_output messages
               // The assistant message must include the tool_calls to match function_call_output call_ids
               const assistantMessage: IChatMessage & { tool_calls?: any[] } = {
                  role: EChatRole.kAssistant,
                  content: textContent || '',
                  tool_calls: functionCalls.map((call: any) => ({
                     id: call.call_id,
                     type: 'function',
                     function: {
                        name: call.name,
                        arguments: call.arguments || '{}'
                     }
                  })),
                  function_call: undefined,
                  timestamp: new Date(),
                  id: `assistant-${Date.now()}`,
                  className: 'assistant-message'
               };
               
               currentMessages = [
                  ...currentMessages,
                  ...toolMessages
               ];
               
               // Tool messages added to conversation history
               
               // Re-invoke the model with the tool result(s) - don't force tools on subsequent calls
               config = this.createResponseConfig(systemPrompt, currentMessages, verbosity, functions, false, false);
               response = await createResponse(config);
               toolUseRounds++;
               continue;
            }
            
            // If we have text content, return it
            if (textContent) {
               return textContent;
            }
         }
         
         break;
      }
      throw new Error('No response content received from OpenAI');
   }

   /**
    * Handles the tool use loop with forced tool usage
    */
   protected async handleToolUseLoopWithForcedTools(
      systemPrompt: string | undefined,
      messages: IChatMessage[],
      verbosity: EVerbosity,
      functions: IFunction[] | undefined,
      createResponse: (config: any) => Promise<any>
   ): Promise<string> {
      let config = this.createResponseConfig(systemPrompt, messages, verbosity, functions, false, true);
      let response = await createResponse(config);

      // Tool use loop: keep handling tool calls until we get a text response or hit max rounds
      let toolUseRounds = 0;
      const MAX_TOOL_USE_ROUNDS = 5; // Reduce to prevent infinite loops
      let currentMessages = messages;
      let lastFunctionCall: string | null = null;
      let consecutiveRepeats = 0;
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         // Check for function/tool calls in Responses API format
         const output = response.output;
         
         if (output) {
            // Extract text content from the output array
            const textContent = this.extractTextFromOutput(output);
            
            // Check for function calls in the output array (Responses API format)
            const functionCalls = output.filter((item: any) => item.type === 'function_call');
            
            if (functionCalls.length > 0 && functions) {
               // Check for repeated function calls to prevent infinite loops
               const currentFunctionCall = `${functionCalls[0].name}:${functionCalls[0].arguments}`;
               
               // Smart loop detection: only count consecutive repeats of the same function
               if (lastFunctionCall === currentFunctionCall) {
                  consecutiveRepeats++;
                  console.log(`[LOOP DETECTION] Round ${toolUseRounds}, Consecutive repeat #${consecutiveRepeats} of: ${currentFunctionCall}`);
               } else {
                  // Reset counter when we see a different function call (progress made)
                  consecutiveRepeats = 0;
                  console.log(`[LOOP DETECTION] Round ${toolUseRounds}, New function call: ${currentFunctionCall} (reset counter)`);
               }
               
               // Only trigger loop detection after 2 consecutive repeats (3 total calls of same function)
               if (consecutiveRepeats >= 2) {
                  console.log(`[LOOP DETECTION] Loop detected! ${consecutiveRepeats + 1} consecutive calls to: ${currentFunctionCall}`);
                  // Return a helpful message instead of looping
                  return "Sorry, we hit an internal error in our function call loop. Please try again, or report the error if it recurs.";
               }
               
               lastFunctionCall = currentFunctionCall;
               
               // Convert Responses API function calls to OpenAI tool call format
               const convertedCalls = functionCalls.map((call: any) => ({
                  type: 'function',
                  function: {
                     name: call.name,
                     arguments: call.arguments || '{}'
                  },
                  id: call.call_id
               }));
               
               const toolMessages = await this.processOpenAIToolCalls(convertedCalls, functions);
               
               // Add assistant message from API response AND function_call_output messages
               // The assistant message must include the tool_calls to match function_call_output call_ids
               const assistantMessage: IChatMessage & { tool_calls?: any[] } = {
                  role: EChatRole.kAssistant,
                  content: textContent || '',
                  tool_calls: functionCalls.map((call: any) => ({
                     id: call.call_id,
                     type: 'function',
                     function: {
                        name: call.name,
                        arguments: call.arguments || '{}'
                     }
                  })),
                  function_call: undefined,
                  timestamp: new Date(),
                  id: `assistant-${Date.now()}`,
                  className: 'assistant-message'
               };
               
               currentMessages = [
                  ...currentMessages,
                  ...toolMessages
               ];
               
               // Tool messages added to conversation history
               
               // Re-invoke the model with the tool result(s) - don't force tools on subsequent calls
               config = this.createResponseConfig(systemPrompt, currentMessages, verbosity, functions, false, false);
               response = await createResponse(config);
               toolUseRounds++;
               continue;
            }
            
            // Check for legacy tool calls format
            if (response.tool_calls && response.tool_calls.length > 0 && functions) {
               const toolMessages = await this.processOpenAIToolCalls(response.tool_calls, functions);
               
               // Add assistant message with tool_calls and function result messages to conversation history
               // The assistant message must include the tool_calls for Responses API
               const assistantMessage: IChatMessage & { tool_calls?: any[] } = {
                  role: EChatRole.kAssistant,
                  content: '',
                  tool_calls: functionCalls.map((call: any) => ({
                     id: call.call_id,
                     type: 'function',
                     function: {
                        name: call.name,
                        arguments: call.arguments || '{}'
                     }
                  })),
                  function_call: undefined,
                  timestamp: new Date(),
                  id: `assistant-${Date.now()}`,
                  className: 'assistant-message'
               };
               currentMessages = [
                  ...currentMessages,
                  ...toolMessages
               ];
               
               // Re-invoke the model with the tool result(s) - don't force tools on subsequent calls
               config = this.createResponseConfig(systemPrompt, currentMessages, verbosity, functions, false, false);
               response = await createResponse(config);
               toolUseRounds++;
               continue;
            }
            
            // If we have text content, return it
            if (textContent) {
               return textContent;
            }
         }
         
         break;
      }
      throw new Error('No response content received from OpenAI');
   }

   async getModelResponse(systemPrompt: string | undefined, 
      userPrompt: string, 
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): Promise<string> {

      const messages = this.buildMessageArray(messageHistory, userPrompt);

      try {
         return await this.handleToolUseLoop(
            systemPrompt,
            messages,
            verbosity,
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

   async getModelResponseWithForcedTools(systemPrompt: string | undefined, 
      userPrompt: string, 
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): Promise<string> {

      const messages = this.buildMessageArray(messageHistory, userPrompt);

      try {
         return await this.handleToolUseLoopWithForcedTools(
            systemPrompt,
            messages,
            verbosity,
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
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): AsyncIterator<string> {
         
      const messages = this.buildMessageArray(messageHistory, userPrompt);
      const self = this;

      return (async function* () {
         try {
            // Try to call the API - this might return a streaming iterator for testing
            const config = self.createResponseConfig(systemPrompt, messages, verbosity, functions, false, false);
            const response = await retryWithExponentialBackoff(() => self.openai.responses.create(config));
            
            // Check if the response has an async iterator (for testing)
            if (response && typeof (response as any)[Symbol.asyncIterator] === 'function') {
               // Handle real streaming (for testing)
               try {
                  for await (const chunk of (response as any)) {
                     // Handle both test mock format and real API format
                     let content = chunk.value?.choices?.[0]?.delta?.content || chunk.choices?.[0]?.delta?.content;
                     if (content) {
                        yield content;
                     }
                  }
               } catch (streamError) {
                  // Handle mid-stream errors gracefully
                  yield '\n\nSorry, it looks like the response was interrupted. Please try again.';
               }
               return;
            }
            
            // Use the tool use loop to handle function calls properly, then simulate streaming
            const result = await self.handleToolUseLoop(
               systemPrompt,
               messages,
               verbosity,
               functions,
               (config) => retryWithExponentialBackoff(() => self.openai.responses.create(config))
            );
            
            // Simulate streaming by yielding the result in chunks
            const words = result.split(' ').filter(word => word.trim().length > 0);
            
            // If we have very few words, split by characters to ensure multiple chunks
            if (words.length <= 2) {
               const chars = result.trim();
               const chunkSize = Math.max(1, Math.floor(chars.length / 3)); // Split into ~3 chunks
               for (let i = 0; i < chars.length; i += chunkSize) {
                  const chunk = chars.slice(i, i + chunkSize);
                  yield chunk;
                  await new Promise(resolve => setTimeout(resolve, 50));
               }
            } else {
               // Normal word-by-word streaming for longer responses
               for (let i = 0; i < words.length; i++) {
                  const chunkText = i < words.length - 1 ? words[i] + ' ' : words[i];
                  yield chunkText;
                  await new Promise(resolve => setTimeout(resolve, 50));
               }
            }
         } catch (error) {
            // Handle errors gracefully
            yield '\n\nSorry, it looks like the response was interrupted. Please try again.';
         }
      })();
   }

   getStreamedModelResponseWithForcedTools(systemPrompt: string | undefined, 
      userPrompt: string, 
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]): AsyncIterator<string> {
         
      const messages = this.buildMessageArray(messageHistory, userPrompt);
      const self = this;

      return (async function* () {
         try {
            // Use the forced tool use loop for the initial call
            const result = await self.handleToolUseLoopWithForcedTools(
               systemPrompt,
               messages,
               verbosity,
               functions,
               (config) => retryWithExponentialBackoff(() => self.openai.responses.create(config))
            );
            
            // Simulate streaming by yielding the result in chunks (1 word at a time for better granularity)
            const words = result.split(' ').filter(word => word.trim().length > 0);
            for (let i = 0; i < words.length; i++) {
               const chunkText = i < words.length - 1 ? words[i] + ' ' : words[i];
               yield chunkText;
               // Add a small delay to simulate streaming
               await new Promise(resolve => setTimeout(resolve, 50));
            }
         } catch (error) {
            // Handle errors gracefully
            yield '\n\nSorry, it looks like the response was interrupted. Please try again.';
         }
      })();
   }

   async getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T> {
      const messages = this.buildMessageArray(messageHistory, userPrompt);

      const config = this.createResponseConfig(systemPrompt, messages, verbosity, functions, false, false);
      // Merge the format configuration with existing text configuration
      config.text = {
         ...config.text,
         format: {
            type: "json_schema", 
            name: "constrainedOutput",
            schema: jsonSchema
         }
      };

      try {
      const response = await retryWithExponentialBackoff(() => 
            this.openai.responses.create(config)
         );
         
         const content = this.extractTextFromOutput(response.output || []);
         if (content) {
            try {
               return JSON.parse(content) as T;
            } catch (parseError) {
               console.warn('Failed to parse JSON response, returning default value:', parseError);
               return defaultValue;
            }
         }
         return defaultValue;
      } catch (error) {
         console.warn('Error in constrained response, returning default value:', error);
         return defaultValue;
      }
   }
}
