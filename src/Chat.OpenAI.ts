/**
 * @module Chat.OpenAI
 * 
 * Concrete implementation of GenericOpenAIChatDriver for OpenAI model.
 * Provides specific configuration for OpenAI model.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// This module implements the OpenAI-backed chat driver used by the project’s chat framework. It specializes GenericOpenAIChatDriver with OpenAI-specific configuration and wires up an OpenAI API client instance.
// 
// The main export is OpenAIChatDriver. It extends GenericOpenAIChatDriver and selects a concrete GPT-5 family model name based on the provided EModel value. EModel.kLarge maps to gpt-5.2, and all other sizes map to gpt-5-mini. The constructor requires an API key to be present in the OPENAI_API_KEY environment variable and throws InvalidStateError when it is missing. When configured, it creates an OpenAI client from the openai package using that key.
// 
// OpenAIChatDriver overrides getModelName to supply the chosen model identifier to the base driver. It also overrides shouldUseToolMessages to enable tool messages, allowing tool-calling behavior supported by the Responses API.
// 
// Key dependencies include OpenAI, GenericOpenAIChatDriver, EModel, and InvalidStateError.
// ===End StrongAI Generated Comment===


import OpenAI from 'openai';
import { EChatRole, InvalidStateError } from './entry';
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
      this.model = modelType === EModel.kLarge ? 'gpt-5.2' : 'gpt-5-mini';

      if (!process.env.OPENAI_API_KEY) {
         throw new InvalidStateError('OPENAI_API_KEY environment variable is not set');
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