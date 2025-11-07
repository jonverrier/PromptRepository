/**
 * @module Chat
 * 
 * Base functionality for interacting with OpenAI's chat completion API.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole, EVerbosity } from './entry';
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
         const isAssistantWithFunctionCall = msg.role === EChatRole.kAssistant && msg.function_call;
         const baseMessage: any = {
            role: msg.role === EChatRole.kUser ? 'user' : 
                  msg.role === EChatRole.kAssistant ? 'assistant' : 
                  msg.role === EChatRole.kFunction ? 'function' : 'user',
            content: isAssistantWithFunctionCall ? null : (msg.content || '')
         };

         // Add name property for function messages
         if (msg.role === EChatRole.kFunction && msg.name) {
            baseMessage.name = msg.name;
         }

         return baseMessage;
      });

      // Map EVerbosity enum to Responses API verbosity values
      const verbosityMap: Record<EVerbosity, string> = {
         [EVerbosity.kLow]: 'low',
         [EVerbosity.kMedium]: 'medium',
         [EVerbosity.kHigh]: 'high'
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

      // Add functions to the configuration if provided
      if (functions && functions.length > 0) {
         config.tools = functions.map(func => ({
            type: 'function',
            name: func.name, // Add name at tool level for Responses API
            function: {
               name: func.name,
               description: func.description,
               parameters: {
                  type: 'object',
                  properties: func.inputSchema.properties,
                  required: func.inputSchema.required,
                  additionalProperties: false
               }
            }
         }));
         // Configure tool choice - only force tools when explicitly requested
         config.tool_choice = forceToolUse ? "required" : "auto";
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
         const toolMessage = await this.handleFunctionCall(convertedCall, functions);
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
      const MAX_TOOL_USE_ROUNDS = 50;
      let currentMessages = messages;
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         // Check for function/tool calls in Responses API format
         const output = response.output;
         if (output) {
            // Extract text content from the output array
            const textContent = this.extractTextFromOutput(output);
            
            // Check for tool calls in the response
            if (response.tool_calls && response.tool_calls.length > 0 && functions) {
               const toolMessages = await this.processOpenAIToolCalls(response.tool_calls, functions);
               
               // Add assistant message and tool messages to the conversation history
               const assistantMessage: IChatMessage = {
                  role: EChatRole.kAssistant,
                  content: textContent || '',
                  function_call: undefined,
                  timestamp: new Date(),
                  id: `assistant-${Date.now()}`,
                  className: 'assistant-message'
               };
               currentMessages = [
                  ...currentMessages,
                  assistantMessage,
                  ...toolMessages
               ];
               
               // Re-invoke the model with the tool result(s)
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
      const MAX_TOOL_USE_ROUNDS = 50;
      let currentMessages = messages;
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         // Check for function/tool calls in Responses API format
         const output = response.output;
         if (output) {
            // Extract text content from the output array
            const textContent = this.extractTextFromOutput(output);
            
            // Check for tool calls
            if (response.tool_calls && response.tool_calls.length > 0 && functions) {
               const toolMessages = await this.processOpenAIToolCalls(response.tool_calls, functions);
               
               // Add assistant message and tool messages to the conversation history
               const assistantMessage: IChatMessage = {
                  role: EChatRole.kAssistant,
                  content: textContent || '',
                  function_call: undefined,
                  timestamp: new Date(),
                  id: `assistant-${Date.now()}`,
                  className: 'assistant-message'
               };
               currentMessages = [
                  ...currentMessages,
                  assistantMessage,
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
            const config = self.createResponseConfig(systemPrompt, messages, verbosity, functions, false, false);

            // Add stream parameter to config
            const streamConfig = { ...config, stream: true };
            
            const stream = await retryWithExponentialBackoff(async () => {
               try {
                  return await self.openai.responses.stream(streamConfig);
               } catch (error: any) {
                  // Check if streaming is not supported, fall back to non-streaming
                  if (error?.code === 'unsupported_value' && error?.param === 'stream') {
                     console.warn('OpenAI streaming not available, falling back to simulated streaming');
                     return await self.openai.responses.create(config);
                  }
                  throw error;
               }
            });

            // Check if we got a streaming response
            if (Symbol.asyncIterator in stream) {
               // Real streaming response - Responses API uses different format
               for await (const chunk of stream as any) {
                  // Handle Responses API streaming format
                  if (chunk.type === 'response.output_text.delta' && chunk.delta) {
                     yield chunk.delta;
                  }
               }
            } else {
               // Non-streaming response, simulate streaming
               const content = self.extractTextFromOutput(stream.output || []);
               if (content) {
                  // Split into words and yield them as chunks
                  const words = content.split(' ').filter(word => word.trim().length > 0);
                  for (let i = 0; i < words.length; i += 2) {
                     const chunk = words.slice(i, i + 2).join(' ');
                     const chunkText = i + 2 < words.length ? chunk + ' ' : chunk;
                     yield chunkText;
                     // Add a small delay to simulate streaming
                     await new Promise(resolve => setTimeout(resolve, 50));
                  }
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
            
            // Simulate streaming by yielding the result in chunks
            const words = result.split(' ').filter(word => word.trim().length > 0);
            for (let i = 0; i < words.length; i += 2) {
               const chunk = words.slice(i, i + 2).join(' ');
               const chunkText = i + 2 < words.length ? chunk + ' ' : chunk;
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
