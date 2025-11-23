/**
 * @module Embed.AzureOpenAI
 * 
 * Concrete implementation of OpenAIModelEmbeddingDriver for Azure OpenAI embedding model.
 * Provides specific configuration for Azure OpenAI embedding services.
 */
// Copyright (c) 2025 Jon Verrier

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