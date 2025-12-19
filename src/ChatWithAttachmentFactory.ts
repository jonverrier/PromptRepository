/**
 * @module ChatWithAttachmentFactory
 * 
 * Factory for creating chat driver instances with attachment support.
 */
// Copyright (c) 2025 Jon Verrier

import { IChatWithAttachmentDriverFactory, IChatWithAttachmentDriver, EModelProvider, EModel } from './entry';
import { OpenAIChatWithAttachment } from './ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from './ChatWithAttachment.AzureOpenAI';
import { GoogleGeminiChatWithAttachment } from './ChatWithAttachment.GoogleGemini';

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

