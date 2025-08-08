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

   protected getModelName(): string {
      return this.model;
   }

   protected shouldUseToolMessages(): boolean {
      return false; // OpenAI doesn't support tool messages
   }
} 