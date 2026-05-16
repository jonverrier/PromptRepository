/**
 * @module ChatWithAttachmentFactory
 * 
 * Factory for creating chat driver instances with attachment support.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// This module provides a single factory that creates chat driver instances that support message attachments. It centralizes provider selection and the mapping from an abstract model size (EModel) to concrete vendor model names.
// 
// The main export is ChatWithAttachmentDriverFactory, which implements IChatWithAttachmentDriverFactory. Its create(model, provider) method returns an IChatWithAttachmentDriver implementation based on EModelProvider. For kAzureOpenAI it returns AzureOpenAIChatWithAttachment. For kGoogleGemini it returns GoogleGeminiChatWithAttachment; the Gemini implementation effectively uses the “flash” tier regardless of the requested model size due to rate-limit constraints. For kAnthropic it returns AnthropicChatWithAttachment. For kDefault it routes to Gemini in development (process.env.NODE_ENV === 'development') and to OpenAI in production, mapping EModel.kLarge to gpt-4.1 and other sizes to gpt-4.1-mini. Any other case also defaults to OpenAI with the same mapping.
// 
// Key dependencies are the enums and interfaces from ./entry and the concrete driver classes for each provider.
// ===End StrongAI Generated Comment===


import { IChatWithAttachmentDriverFactory, IChatWithAttachmentDriver, EModelProvider, EModel } from './entry';
import { OpenAIChatWithAttachment } from './ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from './ChatWithAttachment.AzureOpenAI';
import { GoogleGeminiChatWithAttachment } from './ChatWithAttachment.GoogleGemini';
import { AnthropicChatWithAttachment } from './ChatWithAttachment.Anthropic';

/**
 * Factory class for creating chat drivers with attachment support
 */


export class ChatWithAttachmentDriverFactory implements IChatWithAttachmentDriverFactory {
   create(model: EModel, provider: EModelProvider): IChatWithAttachmentDriver {
      if (provider === EModelProvider.kAzureOpenAI) {
         return new AzureOpenAIChatWithAttachment(model);
      }
      
      if (provider === EModelProvider.kGoogleGemini) {
         // NOTE: GoogleGeminiChatWithAttachment always uses flash model (gemini-3-flash-preview) regardless of model parameter
         // This is due to rate limit constraints - pro model only allows 250 requests/day
         return new GoogleGeminiChatWithAttachment(model);
      }

      if (provider === EModelProvider.kAnthropic) {
         return new AnthropicChatWithAttachment(model);
      }
      
      if (provider === EModelProvider.kDefault) {
         // In development, use Gemini; in production, use OpenAI
         if (process.env.NODE_ENV === 'development') {
            return new GoogleGeminiChatWithAttachment(model);
         } else {
            const modelString = model === EModel.kLarge ? 'gpt-4.1' : 'gpt-4.1-mini';
            return new OpenAIChatWithAttachment({ model: modelString });
         }
      }
      
      // Default to OpenAI for kOpenAI provider
      const modelString = model === EModel.kLarge ? 'gpt-4.1' : 'gpt-4.1-mini';
      return new OpenAIChatWithAttachment({ model: modelString });
   }
}

