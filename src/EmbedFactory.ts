/**
 * @module EmbedFactory
 * 
 * Factory for creating embedding driver instances.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// This module defines a small factory that constructs embedding model drivers without exposing provider-specific details to callers. It exports EmbeddingDriverFactory, which implements the IEmbeddingDriverFactory contract. The factory’s create(model, provider) method returns an IEmbeddingModelDriver for the requested model and hosting provider. It selects the concrete implementation based on the EModelProvider enum: when the provider is kAzureOpenAI, it instantiates AzureOpenAIEmbeddingDriver; otherwise it instantiates NativeOpenAIEmbeddingDriver for direct OpenAI usage. The requested EModel value is passed through to the driver constructor so each driver can map the model choice to its own API configuration. Key dependencies come from ./entry, including the IEmbeddingModelDriver return type, the IEmbeddingDriverFactory interface implemented by the factory, and the EModel and EModelProvider enums used to express the selection inputs. The provider-specific driver classes encapsulate all API integration and configuration differences.
// ===End StrongAI Generated Comment===


import { IEmbeddingModelDriver, IEmbeddingDriverFactory, EModelProvider, EModel, InvalidParameterError } from './entry';
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
      switch (provider) {
         case EModelProvider.kOpenAI:
            return new NativeOpenAIEmbeddingDriver(model);
         case EModelProvider.kAzureOpenAI:
            return new AzureOpenAIEmbeddingDriver(model);
         default:
            throw new InvalidParameterError(
               `EmbeddingDriverFactory does not support provider: ${provider}. Use kOpenAI or kAzureOpenAI.`
            );
      }
   }
} 