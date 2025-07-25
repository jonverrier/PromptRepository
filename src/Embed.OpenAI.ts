/**
 * @module Embed.OpenAI
 * 
 * Concrete implementation of OpenAIModelEmbeddingDriver for direct OpenAI embedding model.
 * Provides specific configuration for direct OpenAI embedding services.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EModel, EModelProvider } from './entry';
import { OpenAIModelEmbeddingDriver as OpenAIEmbeddingDriver } from './Embed';

/**
 * Direct OpenAI embedding model driver.
 * Provides specific configuration for direct OpenAI embedding services.
 * 
 * @extends {OpenAIEmbeddingDriver}
 * 
 * @property {string} deploymentName - The OpenAI model name to use
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export class NativeOpenAIEmbeddingDriver extends OpenAIEmbeddingDriver {
   public deploymentName: string;
   protected declare openai: OpenAI;

   private static readonly OPENAI_MODELS = {
      LARGE: "text-embedding-3-large",
      MINI: "text-embedding-3-small"
   } as const;

   constructor(modelType: EModel) {
      super(modelType, EModelProvider.kOpenAI);
      this.deploymentName = modelType === EModel.kLarge ? 
         NativeOpenAIEmbeddingDriver.OPENAI_MODELS.LARGE : 
         NativeOpenAIEmbeddingDriver.OPENAI_MODELS.MINI;

      if (!process.env.OPENAI_API_KEY) {
         throw new Error('OPENAI_API_KEY environment variable is not set');
      }

      this.openai = new OpenAI({
         apiKey: process.env.OPENAI_API_KEY,
      });
   }

   protected getModelName(): string {
      return this.deploymentName;
   }
} 