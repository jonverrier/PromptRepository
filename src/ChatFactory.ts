/**
 * @module ChatFactory
 * 
 * Factory for creating chat driver instances.
 */
// Copyright (c) 2025 Jon Verrier

import { IChatDriver, IChatDriverFactory, EModelProvider, EModel } from './entry';
import { OpenAIChatDriver } from './Chat.OpenAI';
import { AzureOpenAIChatDriver } from './Chat.AzureOpenAI';

/**
 * Factory class for creating chat drivers
 */
export class ChatDriverFactory implements IChatDriverFactory {
   create(model: EModel, provider: EModelProvider): IChatDriver {
      if (provider === EModelProvider.kAzureOpenAI) {
         return new AzureOpenAIChatDriver(model);
      }
      return new OpenAIChatDriver(model);
   }
} 