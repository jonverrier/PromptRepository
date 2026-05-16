/**
 * @module Embed.OpenAI
 * 
 * Concrete implementation of OpenAIModelEmbeddingDriver for direct OpenAI embedding model.
 * Provides specific configuration for direct OpenAI embedding services.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// This module implements a concrete embedding driver that connects directly to OpenAI’s Embeddings API. It specializes the generic OpenAIModelEmbeddingDriver from ./Embed by providing native OpenAI configuration, including model selection and client initialization.
// 
// The main export is NativeOpenAIEmbeddingDriver. It extends the base OpenAI embedding driver and sets the provider to EModelProvider.kOpenAI. On construction it chooses a deploymentName (the OpenAI model name) based on the requested EModel. EModel.kLarge maps to text-embedding-3-large, while other sizes map to text-embedding-3-small. It overrides getModelName to return the selected deploymentName for use by the base embedding logic.
// 
// The constructor validates configuration by requiring the OPENAI_API_KEY environment variable; if it is missing it throws InvalidStateError from ./entry. When present, it creates an OpenAI SDK client (imported from openai) using the API key and stores it for requests.
// ===End StrongAI Generated Comment===


import OpenAI from 'openai';
import { EModel, EModelProvider, InvalidStateError } from './entry';
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
         throw new InvalidStateError('OPENAI_API_KEY environment variable is not set');
      }

      this.openai = new OpenAI({
         apiKey: process.env.OPENAI_API_KEY,
      });
   }

   protected getModelName(): string {
      return this.deploymentName;
   }
} 