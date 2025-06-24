/**
 * @module Chat.OpenAI
 * 
 * Concrete implementation of OpenAIModelChatDriver for OpenAI model.
 * Provides specific configuration for OpenAI model.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole } from './entry';
import { EModel, IChatMessage, IFunction } from './entry';
import { OpenAIModelChatDriver } from './Chat';

/**
 * Concrete implementation of OpenAIModelDriver for OpenAI model.
 * Provides specific configuration for OpenAI model.
 * 
 * @extends {OpenAIModelChatDriver}
 * 
 * @property {string} model - The OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export class OpenAIChatDriver extends OpenAIModelChatDriver {
   private model: string;
   protected declare openai: OpenAI;

   constructor(modelType: EModel) {
      super(modelType);
      this.model = modelType === EModel.kLarge ? 'gpt-4.1' : 'gpt-4.1-mini';

      if (!process.env.OPENAI_API_KEY) {
         throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this.openai = new OpenAI({
         apiKey: process.env.OPENAI_API_KEY,
      });
   }

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
         model: this.model,
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

   protected shouldUseToolMessages(): boolean {
      return false; // OpenAI doesn't support tool messages
   }
} 