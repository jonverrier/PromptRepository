/**
 * @module ChatFactory
 * 
 * Factory for creating chat driver instances.
 */
// Copyright (c) 2025 Jon Verrier

import { IChatDriver, IChatDriverFactory, EModelProvider, EModel } from './entry';
import { OpenAIChatDriver } from './Chat.OpenAI';
import { AzureOpenAIChatDriver } from './Chat.AzureOpenAI';
import { GoogleGeminiChatDriver } from './Chat.GoogleGemini';

/**
 * Factory class for creating chat drivers
 */
export class ChatDriverFactory implements IChatDriverFactory {
   create(model: EModel, provider: EModelProvider): IChatDriver {
      // Handle kDefault provider - maps to Gemini in development, OpenAI in production
      if (provider === EModelProvider.kDefault) {
         const isDevelopment = process.env.NODE_ENV === 'development';
         if (isDevelopment) {
            return new GoogleGeminiChatDriver(model);
         } else {
            return new OpenAIChatDriver(model);
         }
      }

      if (provider === EModelProvider.kAzureOpenAI) {
         return new AzureOpenAIChatDriver(model);
      }
      if (provider === EModelProvider.kGoogleGemini) {
         // NOTE: GoogleGeminiChatDriver always uses flash model (gemini-3-flash-preview) regardless of model parameter
         // This is due to rate limit constraints - pro model only allows 250 requests/day
         return new GoogleGeminiChatDriver(model);
      }
      return new OpenAIChatDriver(model);
   }
} 