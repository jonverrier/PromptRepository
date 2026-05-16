/**
 * @module Embed.AzureOpenAI
 * 
 * Concrete implementation of OpenAIModelEmbeddingDriver for Azure OpenAI embedding model.
 * Provides specific configuration for Azure OpenAI embedding services.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// Concrete embedding driver for Azure OpenAI. This module adapts a shared OpenAI embedding driver abstraction to work with Azure-hosted embedding deployments, including provider-specific configuration and environment validation.
// 
// Main export: AzureOpenAIEmbeddingDriver. This class extends OpenAIModelEmbeddingDriver and wires it to the Azure OpenAI API. Its constructor takes an EModel value and selects the Azure deployment name for either a large or small embedding model. It requires AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT to be set in the environment, and throws InvalidStateError when either is missing. It then creates an AzureOpenAI client instance using the selected deployment and a fixed API version (2024-02-01). The class exposes deploymentName for visibility and overrides getModelName to return the deployment name used by the base driver.
// 
// Key dependencies: AzureOpenAI from the openai package for the Azure client, EModel and EModelProvider for model selection and provider labeling, InvalidStateError for configuration failures, and OpenAIModelEmbeddingDriver for common embedding behavior.
// ===End StrongAI Generated Comment===


import { AzureOpenAI } from 'openai';
import { EModel, EModelProvider, InvalidStateError } from './entry';
import { OpenAIModelEmbeddingDriver } from './Embed';

const AZURE_DEPLOYMENTS = {
   LARGE: "text-embedding-3-large",
   MINI: "text-embedding-3-small"
} as const;

/**
 * Azure OpenAI embedding model driver.
 * Provides specific configuration for Azure OpenAI embedding services.
 * 
 * @extends {OpenAIModelEmbeddingDriver}
 * 
 * @property {string} deploymentName - The Azure deployment name to use
 * @property {AzureOpenAI} openai - Instance of Azure OpenAI API client
 */


export class AzureOpenAIEmbeddingDriver extends OpenAIModelEmbeddingDriver {
   public deploymentName: string;
   protected declare openai: AzureOpenAI;

   constructor(modelType: EModel) {
      super(modelType, EModelProvider.kAzureOpenAI);
      this.deploymentName = modelType === EModel.kLarge ? 
         AZURE_DEPLOYMENTS.LARGE : 
         AZURE_DEPLOYMENTS.MINI;

      if (!process.env.AZURE_OPENAI_API_KEY) {
         throw new InvalidStateError('AZURE_OPENAI_API_KEY environment variable is not set');
      }
      if (!process.env.AZURE_OPENAI_ENDPOINT) {
         throw new InvalidStateError('AZURE_OPENAI_ENDPOINT environment variable is not set');
      }

      this.openai = new AzureOpenAI({
         apiKey: process.env.AZURE_OPENAI_API_KEY,
         endpoint: process.env.AZURE_OPENAI_ENDPOINT,
         deployment: this.deploymentName,
         apiVersion: "2024-02-01"
      });
   }

   protected getModelName(): string {
      return this.deploymentName;
   }
} 