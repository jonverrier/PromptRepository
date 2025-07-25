/**
 * @module EmbedFactory
 * 
 * Factory for creating embedding driver instances.
 */
// Copyright (c) 2025 Jon Verrier

import { IEmbeddingModelDriver, IEmbeddingDriverFactory, EModelProvider, EModel } from './entry';
import { NativeOpenAIEmbeddingDriver } from './Embed.OpenAI';
import { AzureOpenAIEmbeddingDriver } from './Embed.AzureOpenAI';

/**
 * Factory class for creating embedding drivers
 * Supports both Azure OpenAI and direct OpenAI providers
 */
export class EmbeddingDriverFactory implements IEmbeddingDriverFactory {
   /**
    * Creates an embedding driver instance based on the specified model and provider
    * 
    * @param {EModel} model - The model size to use (kLarge or kMini)
    * @param {EModelProvider} provider - The provider to use (kAzureOpenAI or kOpenAI)
    * @returns {IEmbeddingModelDriver} An embedding driver instance
    */
   create(model: EModel, provider: EModelProvider): IEmbeddingModelDriver {
      if (provider === EModelProvider.kAzureOpenAI) {
         return new AzureOpenAIEmbeddingDriver(model);
      }
      return new NativeOpenAIEmbeddingDriver(model);
   }
} 