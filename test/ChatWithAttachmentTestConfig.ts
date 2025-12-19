/**
 * @module ChatWithAttachmentTestConfig
 * 
 * Shared configuration for ChatWithAttachment driver tests.
 * Enforces consistent provider enumeration and driver initialization.
 */
// Copyright (c) 2025 Jon Verrier

import { ChatWithAttachmentDriverFactory, EModelProvider, EModel, IChatWithAttachmentDriver } from '../src/entry';

const TEST_TIMEOUT_MS = 60000; // 60 second timeout for all tests

/**
 * Providers to test - currently only Gemini for initial testing.
 * Once Gemini is validated, uncomment other providers for regression testing.
 */
export const CHAT_WITH_ATTACHMENT_TEST_PROVIDERS: EModelProvider[] = [
   // EModelProvider.kOpenAI,
   // EModelProvider.kAzureOpenAI,
   EModelProvider.kGoogleGemini
];

/**
 * Creates ChatWithAttachment drivers for all configured providers.
 * Returns null for providers that fail to initialize (e.g., missing API key).
 */
export function createChatWithAttachmentDrivers(model: EModel = EModel.kLarge): (IChatWithAttachmentDriver | null)[] {
   const factory = new ChatWithAttachmentDriverFactory();
   return CHAT_WITH_ATTACHMENT_TEST_PROVIDERS.map(provider => {
      try {
         return factory.create(model, provider);
      } catch (error) {
         // If provider initialization fails (e.g., missing API key), return null
         // Tests will skip providers that fail to initialize
         return null;
      }
   });
}

export { TEST_TIMEOUT_MS };

