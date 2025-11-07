/**
 * @module Chat.OpenAI
 * 
 * Concrete implementation of GenericOpenAIChatDriver for OpenAI model.
 * Provides specific configuration for OpenAI model.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole } from './entry';
import { EModel, IChatMessage, IFunction } from './entry';
import { GenericOpenAIChatDriver } from './Chat.GenericOpenAI';

/**
 * Concrete implementation of GenericOpenAIChatDriver for OpenAI model.
 * Provides specific configuration for OpenAI model.
 * 
 * @extends {GenericOpenAIChatDriver}
 * 
 * @property {string} model - The OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export class OpenAIChatDriver extends GenericOpenAIChatDriver {
   private model: string;
   protected declare openai: OpenAI;

   constructor(modelType: EModel) {
      super(modelType);
      this.model = modelType === EModel.kLarge ? 'gpt-5' : 'gpt-5-mini';

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
      return true; // GPT-5 with Responses API supports tool messages
   }
} 