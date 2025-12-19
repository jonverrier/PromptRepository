/**
 * @module MockChatWithAttachmentFactory
 * 
 * Factory for creating mock ChatWithAttachment drivers for testing.
 */
// Copyright (c) 2025 Jon Verrier

import { EModelProvider, EModel, IChatWithAttachmentDriver } from '../src/entry';
import { MockOpenAIChatWithAttachment } from './MockOpenAIChatWithAttachment';
import { MockAzureOpenAIChatWithAttachment } from './MockAzureOpenAIChatWithAttachment';
import { MockGeminiChatWithAttachment } from './MockGeminiChatWithAttachment';

/**
 * Factory class for creating mock chat drivers with attachment support
 */
export class MockChatWithAttachmentFactory {
   /**
    * Creates a mock driver for the specified provider
    */
   create(model: EModel, provider: EModelProvider): IChatWithAttachmentDriver {
      if (provider === EModelProvider.kAzureOpenAI) {
         return new MockAzureOpenAIChatWithAttachment(model);
      }
      
      if (provider === EModelProvider.kGoogleGemini) {
         return new MockGeminiChatWithAttachment(model);
      }
      
      if (provider === EModelProvider.kDefault) {
         // In development, use Gemini; in production, use OpenAI
         if (process.env.NODE_ENV === 'development') {
            return new MockGeminiChatWithAttachment(model);
         } else {
            return new MockOpenAIChatWithAttachment();
         }
      }
      
      // Default to OpenAI for kOpenAI provider
      return new MockOpenAIChatWithAttachment();
   }
}

