/**
 * @module Chat.AzureOpenAI
 * 
 * Concrete implementation of OpenAIModelChatDriver for Azure OpenAI model.
 * Provides specific configuration for Azure OpenAI model.
 */
// Copyright (c) 2025 Jon Verrier

import { AzureOpenAI } from 'openai';
import { EChatRole } from './entry';
import { EModel, IChatMessage } from './entry';
import { OpenAIModelChatDriver } from './Chat';

const AZURE_DEPLOYMENTS = {
   LARGE: "Studio41Large",
   MINI: "Studio41Small"
} as const;

/**
 * Concrete implementation of OpenAIModelDriver for Azure OpenAI model.
 * Provides specific configuration for Azure OpenAI model.
 * 
 * @extends {OpenAIModelChatDriver}
 * 
 * @property {string} model - The Azure OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of Azure OpenAI API client
 */
export class AzureOpenAIChatDriver extends OpenAIModelChatDriver {
   private deployment: string;
   protected declare openai: AzureOpenAI;

   constructor(modelType: EModel) {
      super(modelType);
      this.deployment = modelType === EModel.kLarge ? AZURE_DEPLOYMENTS.LARGE : AZURE_DEPLOYMENTS.MINI;

      if (!process.env.AZURE_OPENAI_API_KEY) {
         throw new Error('AZURE_OPENAI_API_KEY environment variable is not set');
      }
      if (!process.env.AZURE_OPENAI_ENDPOINT) {
         throw new Error('AZURE_OPENAI_ENDPOINT environment variable is not set');
      }

      this.openai = new AzureOpenAI({
         apiKey: process.env.AZURE_OPENAI_API_KEY,
         endpoint: process.env.AZURE_OPENAI_ENDPOINT,
         deployment: this.deployment,
         apiVersion: "2025-03-01-preview"
      });
   }

   protected createCompletionConfig(systemPrompt: string | undefined, messages: IChatMessage[]): any {
      const formattedMessages = messages.map(msg => ({
         role: msg.role === EChatRole.kUser ? 'user' : 'assistant',
         content: msg.content
      }));

      return {
         model: this.deployment,
         input: formattedMessages,
         ...(systemPrompt && { instructions: systemPrompt }),
         temperature: 0.25
      };
   }
} 