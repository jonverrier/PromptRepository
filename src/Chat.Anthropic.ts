/**
 * @module Chat.Anthropic
 *
 * Concrete implementation of ChatDriver for Anthropic Claude Messages API.
 * Provides chat, streaming, tool use, forced tools, and constrained JSON response capabilities.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// @ts-ignore - @anthropic-ai/sdk is a peer dependency
import Anthropic from '@anthropic-ai/sdk';
import type {
   Message,
   MessageCreateParams,
   MessageParam,
   Tool,
   ToolUseBlock,
   ContentBlockParam
} from '@anthropic-ai/sdk/resources/messages/messages';
import { EChatRole, EVerbosity, InvalidStateError, ConnectionError, InvalidOperationError } from './entry';
import { EModel, IChatMessage, IFunction } from './entry';
import { ChatDriver } from './Chat';
import { retryWithExponentialBackoff, MAX_RETRIES } from './DriverHelpers';

const ANTHROPIC_MODELS = {
   LARGE: 'claude-opus-4-7',
   MINI: 'claude-sonnet-4-5'
} as const;

const MAX_TOOL_USE_ROUNDS = 10;
const DEFAULT_MAX_TOKENS_LOW = 2048;
const DEFAULT_MAX_TOKENS_MEDIUM = 4096;
const DEFAULT_MAX_TOKENS_HIGH = 8192;

type AnthropicToolUseBlock = ToolUseBlock;

/**
 * Concrete implementation of ChatDriver for Anthropic Claude API.
 *
 * @extends {ChatDriver}
 */
export class AnthropicChatDriver extends ChatDriver {
   private modelName: string;
   private client: Anthropic;

   constructor(modelType: EModel) {
      super(modelType);
      this.modelName = modelType === EModel.kLarge ? ANTHROPIC_MODELS.LARGE : ANTHROPIC_MODELS.MINI;

      if (!process.env.ANTHROPIC_API_KEY) {
         throw new InvalidStateError('ANTHROPIC_API_KEY environment variable is not set');
      }
      this.client = new Anthropic({
         apiKey: process.env.ANTHROPIC_API_KEY,
         maxRetries: 0
      });
   }

   protected getProviderName(): string {
      return 'Anthropic';
   }

   protected getModelName(): string {
      return this.modelName;
   }

   /**
    * Maps EVerbosity to max_tokens for Claude.
    */
   private getMaxTokens(verbosity: EVerbosity): number {
      if (verbosity === EVerbosity.kHigh) {
         return DEFAULT_MAX_TOKENS_HIGH;
      }
      if (verbosity === EVerbosity.kMedium) {
         return DEFAULT_MAX_TOKENS_MEDIUM;
      }
      return DEFAULT_MAX_TOKENS_LOW;
   }

   /**
    * Converts IChatMessage array to Anthropic Messages API format (user/assistant text only).
    */
   private convertMessagesToAnthropicFormat(messages: IChatMessage[]): MessageParam[] {
      return messages
         .filter(msg => msg.role === EChatRole.kUser || msg.role === EChatRole.kAssistant)
         .map(msg => ({
            role: msg.role === EChatRole.kUser ? 'user' as const : 'assistant' as const,
            content: msg.content || ''
         }));
   }

   /**
    * Converts IFunction array to Anthropic tools format.
    */
   private convertFunctionsToAnthropicFormat(functions: IFunction[]): Tool[] {
      return functions.map(func => ({
         name: func.name,
         description: func.description,
         input_schema: {
            type: 'object' as const,
            properties: func.inputSchema.properties as Record<string, unknown>,
            required: func.inputSchema.required || []
         }
      }));
   }

   /**
    * Extracts text from Anthropic message content blocks.
    */
   private extractTextFromContent(content: Message['content']): string {
      const parts: string[] = [];
      for (const block of content) {
         if (block.type === 'text') {
            parts.push(block.text);
         }
      }
      return parts.join('');
   }

   /**
    * Extracts tool_use blocks from Anthropic message content.
    */
   private extractToolUseBlocks(content: Message['content']): AnthropicToolUseBlock[] {
      return content.filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use');
   }

   /**
    * Executes function calls and returns tool_result content blocks.
    */
   private async executeToolUseBlocks(
      toolUseBlocks: AnthropicToolUseBlock[],
      functions: IFunction[]
   ): Promise<ContentBlockParam[]> {
      const results: ContentBlockParam[] = [];

      for (const block of toolUseBlocks) {
         const func = functions.find(f => f.name === block.name);
         let output: string;

         if (!func) {
            output = JSON.stringify({
               error: true,
               message: `Function ${block.name} not found`,
               functionName: block.name,
               timestamp: new Date().toISOString()
            });
         } else {
            try {
               const args = typeof block.input === 'object' && block.input !== null
                  ? block.input as Record<string, unknown>
                  : {};
               const validatedArgs = func.validateArgs(args);
               const functionResult = await func.execute(validatedArgs);
               output = JSON.stringify(functionResult);
            } catch (error) {
               output = JSON.stringify({
                  error: true,
                  message: error instanceof Error ? error.message : String(error),
                  functionName: block.name,
                  timestamp: new Date().toISOString()
               });
            }
         }

         results.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: output
         });
      }

      return results;
   }

   /**
    * Removes additionalProperties from JSON schema (Anthropic may reject some nested forms).
    */
   private removeAdditionalPropertiesFromSchema(schema: Record<string, unknown>): Record<string, unknown> {
      const cleaned: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(schema)) {
         if (key === 'additionalProperties') {
            continue;
         }

         if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            cleaned[key] = this.removeAdditionalPropertiesFromSchema(value as Record<string, unknown>);
         } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
            cleaned[key] = value.map((item: unknown) =>
               typeof item === 'object' && item !== null
                  ? this.removeAdditionalPropertiesFromSchema(item as Record<string, unknown>)
                  : item
            );
         } else {
            cleaned[key] = value;
         }
      }

      return cleaned;
   }

   /**
    * Core message loop with optional tool use.
    */
   private async runMessageLoop(
      systemPrompt: string | undefined,
      messages: MessageParam[],
      verbosity: EVerbosity,
      functions: IFunction[] | undefined,
      forceToolUse: boolean
   ): Promise<string> {
      let conversationMessages = [...messages];
      let rounds = 0;

      while (rounds < MAX_TOOL_USE_ROUNDS) {
         const requestParams: MessageCreateParams = {
            model: this.modelName,
            max_tokens: this.getMaxTokens(verbosity),
            messages: conversationMessages
         };

         if (systemPrompt) {
            requestParams.system = systemPrompt;
         }

         if (functions && functions.length > 0) {
            requestParams.tools = this.convertFunctionsToAnthropicFormat(functions);
            if (forceToolUse && rounds === 0) {
               requestParams.tool_choice = { type: 'any' };
            }
         }

         const response = await retryWithExponentialBackoff(
            () => this.client.messages.create(requestParams),
            MAX_RETRIES,
            this.getProviderName()
         );

         const toolUseBlocks = this.extractToolUseBlocks(response.content);

         if (toolUseBlocks.length === 0) {
            const text = this.extractTextFromContent(response.content);
            if (text && text.trim().length > 0) {
               return text;
            }
            if (response.stop_reason === 'end_turn') {
               return text || 'Response completed successfully.';
            }
            throw new InvalidOperationError('Received empty text response from model.');
         }

         if (!functions || functions.length === 0) {
            return this.extractTextFromContent(response.content) || 'Response completed successfully.';
         }

         // Append assistant message with full content (including tool_use blocks)
         conversationMessages.push({
            role: 'assistant',
            content: response.content as ContentBlockParam[]
         });

         const toolResults = await this.executeToolUseBlocks(toolUseBlocks, functions);
         conversationMessages.push({
            role: 'user',
            content: toolResults
         });

         rounds++;
         forceToolUse = false;
      }

      throw new InvalidOperationError('Maximum function call rounds reached without final response.');
   }

   async getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string> {
      const messages = this.buildMessageArray(messageHistory, userPrompt);
      const anthropicMessages = this.convertMessagesToAnthropicFormat(messages);

      try {
         return await this.runMessageLoop(systemPrompt, anthropicMessages, verbosity, functions, false);
      } catch (error) {
         if (error instanceof ConnectionError || error instanceof InvalidOperationError) {
            throw error;
         }
         if (error instanceof Error) {
            throw new ConnectionError(`Anthropic API error: ${error.message}`);
         }
         throw new ConnectionError('Unknown error occurred while calling Anthropic API');
      }
   }

   getStreamedModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string> {
      const messages = this.buildMessageArray(messageHistory, userPrompt);
      const anthropicMessages = this.convertMessagesToAnthropicFormat(messages);
      const self = this;

      return (async function* () {
         try {
            const result = await self.runMessageLoop(
               systemPrompt,
               anthropicMessages,
               verbosity,
               functions,
               false
            );

            const words = result.split(' ').filter(word => word.trim().length > 0);
            if (words.length <= 2) {
               const chars = result.trim();
               const chunkSize = Math.max(1, Math.floor(chars.length / 3));
               for (let i = 0; i < chars.length; i += chunkSize) {
                  yield chars.slice(i, i + chunkSize);
                  await new Promise(resolve => setTimeout(resolve, 50));
               }
            } else {
               for (let i = 0; i < words.length; i++) {
                  const chunkText = i < words.length - 1 ? words[i] + ' ' : words[i];
                  yield chunkText;
                  await new Promise(resolve => setTimeout(resolve, 50));
               }
            }
         } catch (error) {
            yield '\n\nSorry, it looks like the response was interrupted. Please try again.';
         }
      })();
   }

   async getModelResponseWithForcedTools(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string> {
      if (!functions || functions.length === 0) {
         throw new InvalidOperationError('Functions are required for forced tool usage');
      }

      const enhancedSystemPrompt = systemPrompt
         ? `${systemPrompt}\n\nYou MUST use one or more of the available tools to answer the user's question. When you receive tool results, incorporate ALL relevant details from those results into your response.`
         : "You MUST use one or more of the available tools to answer the user's question. When you receive tool results, incorporate ALL relevant details from those results into your response.";

      const messages = this.buildMessageArray(messageHistory, userPrompt);
      const anthropicMessages = this.convertMessagesToAnthropicFormat(messages);

      try {
         return await this.runMessageLoop(enhancedSystemPrompt, anthropicMessages, verbosity, functions, true);
      } catch (error) {
         if (error instanceof ConnectionError || error instanceof InvalidOperationError) {
            throw error;
         }
         if (error instanceof Error) {
            throw new ConnectionError(`Anthropic API error: ${error.message}`);
         }
         throw new ConnectionError('Unknown error occurred while calling Anthropic API');
      }
   }

   getStreamedModelResponseWithForcedTools(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string> {
      if (!functions || functions.length === 0) {
         throw new InvalidOperationError('Functions are required for forced tool usage');
      }

      const enhancedSystemPrompt = systemPrompt
         ? `${systemPrompt}\n\nYou MUST use one or more of the available tools to answer the user's question. When you receive tool results, incorporate ALL relevant details from those results into your response.`
         : "You MUST use one or more of the available tools to answer the user's question. When you receive tool results, incorporate ALL relevant details from those results into your response.";

      return this.getStreamedModelResponse(enhancedSystemPrompt, userPrompt, verbosity, messageHistory, functions);
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
      const anthropicMessages = this.convertMessagesToAnthropicFormat(messages);
      const cleanedSchema = this.removeAdditionalPropertiesFromSchema(jsonSchema);

      const jsonInstruction = `You MUST respond with valid JSON only, matching this schema: ${JSON.stringify(cleanedSchema)}`;
      const combinedSystem = systemPrompt
         ? `${systemPrompt}\n\n${jsonInstruction}`
         : jsonInstruction;

      try {
         const requestParams: MessageCreateParams = {
            model: this.modelName,
            max_tokens: this.getMaxTokens(verbosity),
            messages: anthropicMessages,
            system: combinedSystem
         };

         if (functions && functions.length > 0) {
            requestParams.tools = this.convertFunctionsToAnthropicFormat(functions);
         }

         const response = await retryWithExponentialBackoff(
            () => this.client.messages.create(requestParams),
            MAX_RETRIES,
            this.getProviderName()
         );

         const content = this.extractTextFromContent(response.content);
         if (content) {
            try {
               return JSON.parse(content) as T;
            } catch (parseError) {
               const snippet = content.length > 500 ? content.slice(0, 500) + '...[truncated]' : content;
               console.warn('Failed to parse JSON response, returning default value:', parseError);
               console.warn('[ConstrainedResponse] Raw response that failed to parse:', JSON.stringify(snippet));
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
