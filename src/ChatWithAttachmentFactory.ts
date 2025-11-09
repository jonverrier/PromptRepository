/**
 * @module ChatWithAttachmentFactory
 * 
 * Factory for creating chat driver instances with attachment support.
 */
// Copyright (c) 2025 Jon Verrier

import { IChatWithAttachmentDriverFactory, IChatWithAttachmentDriver, EModelProvider, EModel } from './entry';
import { OpenAIChatWithAttachment } from './ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from './ChatWithAttachment.AzureOpenAI';

/**
 * Factory class for creating chat drivers with attachment support
 */
export class ChatWithAttachmentDriverFactory implements IChatWithAttachmentDriverFactory {
   create(model: EModel, provider: EModelProvider): IChatWithAttachmentDriver {
      if (provider === EModelProvider.kAzureOpenAI) {
         return new AzureOpenAIChatWithAttachment(model);
      }
      // Map EModel to OpenAI model string
      const modelString = model === EModel.kLarge ? 'gpt-4.1' : 'gpt-4.1-mini';
      return new OpenAIChatWithAttachment({ model: modelString });
   }
}

