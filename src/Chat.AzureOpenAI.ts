/**
 * @module Chat.AzureOpenAI
 * 
 * Concrete implementation of GenericOpenAIChatDriver for Azure OpenAI model.
 * Provides specific configuration for Azure OpenAI model.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// This module implements an Azure OpenAI-backed chat driver that plugs into the project’s generic OpenAI chat abstraction. It provides Azure-specific configuration and maps a generic model selection to an Azure deployment name.
// 
// The main export is AzureOpenAIChatDriver, a subclass of GenericOpenAIChatDriver. Its constructor takes an EModel and chooses the corresponding deployment (gpt-4.1 for large, gpt-4.1-mini for mini). It validates required runtime configuration by checking AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and throws InvalidStateError when either is missing. When configured, it creates an AzureOpenAI client from the openai SDK using the endpoint, key, selected deployment, and a fixed API version (2025-03-01-preview).
// 
// AzureOpenAIChatDriver overrides getModelName to return the deployment string, shouldUseToolMessages to enable tool message handling, and getProviderName to report “Azure OpenAI”.
// 
// Key dependencies are AzureOpenAI (client construction), GenericOpenAIChatDriver (shared chat flow), EModel (deployment selection), and InvalidStateError (configuration errors).
// ===End StrongAI Generated Comment===



import { AzureOpenAI } from 'openai';
import { EChatRole, InvalidStateError } from './entry';
import { EModel, IChatMessage, IFunction } from './entry';
import { GenericOpenAIChatDriver } from './Chat.GenericOpenAI';

const AZURE_DEPLOYMENTS = {
   LARGE: "gpt-4.1",
   MINI: "gpt-4.1-mini"
} as const;

/**
 * Concrete implementation of GenericOpenAIChatDriver for Azure OpenAI model.
 * Provides specific configuration for Azure OpenAI model.
 * 
 * @extends {GenericOpenAIChatDriver}
 * 
 * @property {string} model - The Azure OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of Azure OpenAI API client
 */
export class AzureOpenAIChatDriver extends GenericOpenAIChatDriver {
   private deployment: string;
   protected declare openai: AzureOpenAI;

   constructor(modelType: EModel) {
      super(modelType);
      this.deployment = modelType === EModel.kLarge ? AZURE_DEPLOYMENTS.LARGE : AZURE_DEPLOYMENTS.MINI;

      if (!process.env.AZURE_OPENAI_API_KEY) {
         throw new InvalidStateError('AZURE_OPENAI_API_KEY environment variable is not set');
      }
      if (!process.env.AZURE_OPENAI_ENDPOINT) {
         throw new InvalidStateError('AZURE_OPENAI_ENDPOINT environment variable is not set');
      }

      this.openai = new AzureOpenAI({
         apiKey: process.env.AZURE_OPENAI_API_KEY,
         endpoint: process.env.AZURE_OPENAI_ENDPOINT,
         deployment: this.deployment,
         apiVersion: "2025-03-01-preview"
      });
   }

   protected getModelName(): string {
      return this.deployment;
   }

   protected shouldUseToolMessages(): boolean {
      return true; // Azure OpenAI supports tool messages
   }

   protected getProviderName(): string {
      return "Azure OpenAI";
   }
} 