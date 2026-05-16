/**
 * @module ChatFactory
 * 
 * Factory for creating chat driver instances.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// Factory module that creates an appropriate chat driver instance from a requested model and provider. It exports a single class, ChatDriverFactory, which implements IChatDriverFactory and returns an IChatDriver from its create(model, provider) method.
// 
// Provider selection is driven by the EModelProvider enum. If provider is kDefault, the factory chooses a driver based on NODE_ENV: GoogleGeminiChatDriver in development and OpenAIChatDriver in non-development environments. If provider is kAzureOpenAI, it returns AzureOpenAIChatDriver. If provider is kGoogleGemini, it returns GoogleGeminiChatDriver; this driver is expected to use a flash variant internally regardless of the model argument due to rate-limit constraints. If provider is kAnthropic, it returns AnthropicChatDriver. Any unrecognized provider falls back to OpenAIChatDriver.
// 
// Key dependencies are IChatDriver, IChatDriverFactory, EModelProvider, and EModel from ./entry, plus the provider-specific driver classes imported from the Chat.* modules.
// ===End StrongAI Generated Comment===


import { IChatDriver, IChatDriverFactory, EModelProvider, EModel } from './entry';
import { OpenAIChatDriver } from './Chat.OpenAI';
import { AzureOpenAIChatDriver } from './Chat.AzureOpenAI';
import { GoogleGeminiChatDriver } from './Chat.GoogleGemini';
import { AnthropicChatDriver } from './Chat.Anthropic';

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
      if (provider === EModelProvider.kAnthropic) {
         return new AnthropicChatDriver(model);
      }
      return new OpenAIChatDriver(model);
   }
} 