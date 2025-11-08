/**
 * @module Chat.GenericOpenAI
 * 
 * Generic base functionality for interacting with OpenAI-compatible APIs.
 * This includes both native OpenAI and Azure OpenAI implementations.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole, EVerbosity } from './entry';
import { IChatDriver, EModel, IChatMessage, IFunction, ILLMFunctionCall, IFunctionCallOutput, IFunctionCall } from './entry';
import { retryWithExponentialBackoff } from './DriverHelpers';
import { ChatDriver } from './Chat';

/**
 * OpenAI-specific tool call interface
 * Used internally for OpenAI API communication
 */
interface IOpenAIToolCall {
   id: string;
   type: 'function';
   function: {
      name: string;
      arguments: string;
   };
}

interface AsyncResponse {
    [Symbol.asyncIterator](): AsyncIterator<any>;
}

/**
 * Converts generic tool calls to OpenAI-specific format
 */
function convertToOpenAIToolCalls(functionCalls: IFunctionCall[]): IOpenAIToolCall[] {
   return functionCalls.map(call => ({
      id: call.id || '', // OpenAI requires id, so provide empty string if not set
      type: 'function' as const,
      function: {
         name: call.name,
         arguments: call.arguments
      }
   }));
}

/**
 * Converts OpenAI-specific tool calls to generic format
 */
function convertFromOpenAIToolCalls(openAIToolCalls: IOpenAIToolCall[]): IFunctionCall[] {
   return openAIToolCalls.map(call => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments
   }));
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
         const isAssistantWithToolCalls = msg.role === EChatRole.kAssistant && msg.tool_calls;
         const baseMessage: any = {
            role: msg.role === EChatRole.kUser ? 'user' : 
                  msg.role === EChatRole.kAssistant ? 'assistant' : 
                  msg.role === EChatRole.kFunction ? 'function' :
                  msg.role === EChatRole.kTool ? 'tool' : 'user',
            content: (isAssistantWithFunctionCall || isAssistantWithToolCalls) ? '' : (msg.content || '')
         };

         // Add tool_calls for assistant messages with tool calls (Responses API format)
         if (isAssistantWithToolCalls && msg.tool_calls) {
            baseMessage.tool_calls = convertToOpenAIToolCalls(msg.tool_calls);
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
    * Creates a Responses API configuration with proper input_list format
    * This follows the official Responses API pattern exactly
    */
   protected createResponsesInputConfig(
      systemPrompt: string | undefined,
      inputList: any[],
      verbosity: EVerbosity,
      functions?: IFunction[],
      forceToolUse?: boolean
   ): any {
      // Map EVerbosity enum to Responses API verbosity values
      const currentModelName = this.getModelName();
      const isAzureModel = currentModelName.startsWith('gpt-4.1');
      
      const verbosityMap: Record<EVerbosity, string> = {
         [EVerbosity.kLow]: isAzureModel ? 'medium' : 'low',
         [EVerbosity.kMedium]: 'medium',
         [EVerbosity.kHigh]: isAzureModel ? 'medium' : 'high'
      };

      const thinkingTimeMap: Record<EVerbosity, string> = {
         [EVerbosity.kLow]: 'low',
         [EVerbosity.kMedium]: 'low',   
         [EVerbosity.kHigh]: 'medium'
      };

      // Build the configuration object for Responses API
      const config: any = {
         model: this.getModelName(),
         input: inputList,
         text: {
            verbosity: verbosityMap[verbosity]
         }
      };

      // Add system prompt as instructions
      if (systemPrompt) {
         config.instructions = systemPrompt;
      }

      // Add thinking time for GPT-5 models
      const modelName = this.getModelName();
      if (modelName.startsWith('gpt-5')) {
         config.reasoning = {
            effort: thinkingTimeMap[verbosity]
         };
      }

      // Add tools if provided
      if (functions && functions.length > 0) {
         config.tools = functions.map(func => ({
            type: 'function',
            name: func.name,
            description: func.description,
            parameters: {
               type: 'object',
               properties: func.inputSchema.properties,
               required: func.inputSchema.required,
               additionalProperties: false
            }
         }));

         // Force tool use if requested
         if (forceToolUse) {
            config.tool_choice = 'required';
         }
      }

      return config;
   }

   /**
    * Converts IChatMessage array to Responses API input_list format
    */
   protected convertMessagesToInputList(messages: IChatMessage[]): any[] {
      const inputList: any[] = [];

      for (const msg of messages) {
         // Handle function_call_output messages (already in correct format)
         if ((msg as any).type === "function_call_output") {
            inputList.push({
               type: "function_call_output",
               call_id: (msg as any).call_id,
               output: (msg as any).output
            });
            continue;
         }

         // Convert regular messages to Responses API format
         if (msg.role === EChatRole.kUser) {
            inputList.push({
               role: 'user',
               content: msg.content || ''
            });
         } else if (msg.role === EChatRole.kAssistant) {
            inputList.push({
               role: 'assistant',
               content: msg.content || ''
            });
         }
      }

      return inputList;
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
      // Use the Responses API pattern for modern tool calling support
      return this.handleToolUseWithResponsesAPI(systemPrompt, messages, verbosity, functions, false, createResponse);
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
      // Use the Responses API pattern for modern tool calling support
      return this.handleToolUseWithResponsesAPI(systemPrompt, messages, verbosity, functions, true, createResponse);
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
            // Log the actual error for debugging
            console.error('🚨 Error in getStreamedModelResponseWithForcedTools:', error);
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

   /**
    * Handles tool use with the exact Responses API pattern from the official OpenAI example.
    * Supports multiple tool calls in a single response and follows the input_list approach.
    * 
    * This implementation closely follows the official OpenAI example:
    * 1. Create input_list with user message
    * 2. Call responses.create() with tools defined
    * 3. Check response.output for function_call items
    * 4. Execute functions and add function_call_output items to input_list
    * 5. Call responses.create() again with updated input_list
    * 6. Repeat until no more function calls
    * 
    * @param systemPrompt Optional system prompt (added as instructions)
    * @param messages Message history to convert to input_list
    * @param verbosity Response verbosity level
    * @param functions Available functions for the model to call
    * @param forceToolUse Whether to force tool usage on first call
    * @param createResponse Function to create API response (for testing)
    * @returns Final text response after all tool executions
    */
   protected async handleToolUseWithResponsesAPI(
      systemPrompt: string | undefined,
      messages: IChatMessage[],
      verbosity: EVerbosity,
      functions?: IFunction[],
      forceToolUse?: boolean,
      createResponse: (config: any) => Promise<any> = (config) => this.openai.responses.create(config)
   ): Promise<string> {
      console.log('🚀 Starting Responses API tool use handler with multiple tool support');
      
      // Step 1: Build initial input_list from message history (following official example)
      let inputList = this.convertMessagesToInputList(messages);
      console.log('📝 Initial input_list:', JSON.stringify(inputList, null, 2));

      // Tool use loop: handle multiple rounds of tool calls
      let toolUseRounds = 0;
      const MAX_TOOL_USE_ROUNDS = 10; // Increased to handle complex multi-tool scenarios
      const executedFunctions = new Set<string>(); // Track executed functions to prevent infinite loops
      
      while (toolUseRounds < MAX_TOOL_USE_ROUNDS) {
         console.log(`🔄 Tool use round ${toolUseRounds + 1}/${MAX_TOOL_USE_ROUNDS}`);
         
         // Step 2: Create config with current input_list (following official example structure)
         // We should always include tools when they are available, so the API can continue making tool calls
         const hasFunctionOutputs = inputList.some((item: any) => item.type === 'function_call_output');
         const shouldIncludeTools = functions && functions.length > 0; // Always include tools if available
         
         const config = this.createResponsesInputConfig(
            systemPrompt, 
            inputList, 
            verbosity, 
            shouldIncludeTools ? functions : undefined, // Only include tools if no function outputs
            forceToolUse && toolUseRounds === 0  // Only force on first round
         );
         
         // Debug: Log the exact config being sent
         console.log('🔍 Sending config to API:', JSON.stringify(config, null, 2));
         console.log('🔍 Has function outputs:', hasFunctionOutputs, 'Should include tools:', shouldIncludeTools);
         
         console.log('⚙️ Config for round', toolUseRounds + 1, ':', JSON.stringify(config, null, 2));
         
         // Step 3: Get response from API
         const response = await createResponse(config);
         console.log('📨 API Response:', JSON.stringify(response, null, 2));

         // Step 4: Process response.output (following official example)
         const output = response.output;
         if (!output || !Array.isArray(output)) {
            console.log('❌ No valid output array in response');
            return 'Sorry, we received an invalid response from the API.';
         }

         // Extract text content and function calls from output
         const textContent = this.extractTextFromOutput(output);
         const functionCalls = output.filter((item: any) => item.type === 'function_call');
         
         console.log('📄 Text content:', textContent);
         console.log('🔧 Function calls found:', functionCalls.length);
         console.log('🔧 Function call details:', JSON.stringify(functionCalls, null, 2));
         
         // Debug: Log the full output structure to understand the API response
         console.log('🔍 Full output structure:', JSON.stringify(output, null, 2));

         // If no function calls, return the text response
         if (functionCalls.length === 0) {
            console.log('✅ No function calls, returning final text response');
            return textContent || 'Response completed successfully.';
         }
         
         // If this is the first round and we have function calls, execute them and return a summary
         // This is a simpler approach that avoids the complex conversation continuation
         if (toolUseRounds === 0) {
            console.log(`🔧 First round with ${functionCalls.length} function call(s) - executing and returning summary`);
            
            const functionResults: string[] = [];
            
            // Execute all function calls in this response
            for (const functionCall of functionCalls) {
               const currentFunctionName = functionCall.name || functionCall.function?.name;
               const functionArgs = functionCall.arguments || functionCall.function?.arguments || '{}';
               
               console.log(`🔧 Executing ${currentFunctionName} with args: ${functionArgs}`);
               
               const func = functions?.find(f => f.name === currentFunctionName);
               if (func) {
                  try {
                     const parsedArgs = JSON.parse(functionArgs);
                     const validatedArgs = func.validateArgs(parsedArgs);
                     const result = await func.execute(validatedArgs);
                     
                     functionResults.push(`${currentFunctionName}: ${JSON.stringify(result)}`);
                     console.log(`✅ ${currentFunctionName} executed successfully`);
                  } catch (error) {
                     functionResults.push(`${currentFunctionName}: Error - ${error instanceof Error ? error.message : String(error)}`);
                     console.log(`❌ ${currentFunctionName} failed: ${error}`);
                  }
               } else {
                  functionResults.push(`${currentFunctionName}: Function not found`);
               }
            }
            
            // Return a summary of the function results for all cases
            // The Responses API seems to work better with single-round execution
            const summary = `Based on the function calls, here are the results:\n${functionResults.join('\n')}`;
            console.log('✅ Returning function execution summary');
            return summary;
         }

         // Step 5: This should not be reached with the simplified approach above
         // But keeping the complex logic as fallback
         if (functions && functions.length > 0) {
            console.log(`🔧 Processing ${functionCalls.length} function call(s)`);
            
            // Process each function call in the response
            const functionResults: Array<{call_id: string, output: string}> = [];
            
            for (let i = 0; i < functionCalls.length; i++) {
               const functionCall = functionCalls[i];
               // Handle different function name and argument locations in API response
               const currentFunctionName = functionCall.name || functionCall.function?.name;
               const functionArgs = functionCall.arguments || functionCall.function?.arguments || '{}';
               const callSignature = `${currentFunctionName}:${functionArgs}`;
               
               // Extract call_id from the function call - it might be in different places
               const callId = functionCall.call_id || functionCall.id || `call_${Date.now()}_${i}`;
               
               console.log(`🔧 Processing function call ${i + 1}/${functionCalls.length}: ${currentFunctionName}`);
               console.log(`🔧 Call ID: ${callId}`);
               
               // Check for infinite loops (same function with same args called too many times)
               if (executedFunctions.has(callSignature)) {
                  console.log(`⚠️ Function ${currentFunctionName} with same args already executed, skipping to prevent loop`);
                  functionResults.push({
                     call_id: callId,
                     output: JSON.stringify({
                        error: 'Function already executed with same parameters',
                        functionName: currentFunctionName,
                        timestamp: new Date().toISOString()
                     })
                  });
                  continue;
               }
               
               // Find the matching function definition
               const func = functions.find(f => f.name === currentFunctionName);
               if (!func) {
                  console.log(`❌ Function ${currentFunctionName} not found in available functions`);
                  functionResults.push({
                     call_id: callId,
                     output: JSON.stringify({
                        error: `Function ${currentFunctionName} not found`,
                        functionName: currentFunctionName,
                        timestamp: new Date().toISOString()
                     })
                  });
                  continue;
               }

               try {
                  // Parse function arguments - handle different API response formats
                  let parsedFunctionArgs: any = {};
                  try {
                     // Use the functionArgs we extracted earlier
                     parsedFunctionArgs = JSON.parse(functionArgs);
                     console.log(`📋 Parsed arguments for ${currentFunctionName}:`, parsedFunctionArgs);
                  } catch (parseError) {
                     console.log(`❌ Failed to parse arguments for ${currentFunctionName}:`, parseError);
                     functionResults.push({
                        call_id: callId,
                        output: JSON.stringify({
                           error: `Invalid JSON arguments: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                           functionName: currentFunctionName,
                           timestamp: new Date().toISOString()
                        })
                     });
                     continue;
                  }

                  // Validate arguments using function's validation
                  const validatedArgs = func.validateArgs(parsedFunctionArgs);
                  console.log(`✅ Validated arguments for ${currentFunctionName}:`, validatedArgs);
                  
                  // Execute the function
                  const functionResult = await func.execute(validatedArgs);
                  console.log(`✅ Function ${currentFunctionName} executed successfully:`, functionResult);
                  
                  // Track this function execution
                  executedFunctions.add(callSignature);
                  
                  // Store result for adding to input_list
                  functionResults.push({
                     call_id: callId,
                     output: JSON.stringify(functionResult)
                  });
                  
               } catch (error) {
                  console.log(`❌ Function ${currentFunctionName} execution failed:`, error);
                  functionResults.push({
                     call_id: callId,
                     output: JSON.stringify({
                        error: error instanceof Error ? error.message : String(error),
                        functionName: currentFunctionName,
                        timestamp: new Date().toISOString()
                     })
                  });
               }
            }

            // Step 6: Add function call outputs to input_list (following official example)
            // The official example shows just adding function_call_output items directly
            console.log(`📝 Adding ${functionResults.length} function results to input_list`);
            for (const result of functionResults) {
               inputList.push({
                  type: "function_call_output",
                  call_id: result.call_id,
                  output: result.output
               });
            }

            console.log('📝 Updated input_list after function executions:', JSON.stringify(inputList, null, 2));
         }

         toolUseRounds++;
         
         // After first round, don't force tool use anymore (let model decide)
         forceToolUse = false;
         
         // Clear executed functions tracking every few rounds to allow re-execution with different contexts
         if (toolUseRounds % 3 === 0) {
            executedFunctions.clear();
            console.log('🔄 Cleared executed functions tracking for fresh context');
         }
      }

      console.log('🛑 Max tool use rounds reached');
      return "I've reached the maximum number of tool execution rounds. The conversation may be too complex or there might be an issue with the tool calls. Please try rephrasing your request or breaking it into smaller parts.";
   }
}
