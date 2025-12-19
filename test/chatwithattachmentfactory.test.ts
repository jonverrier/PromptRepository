/**
 * @module chatwithattachmentfactory.test
 * 
 * Unit tests for the ChatWithAttachmentFactory module.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatWithAttachmentDriverFactory, EModelProvider, EModel, IChatWithAttachmentDriver } from '../src/entry';
import { CHAT_WITH_ATTACHMENT_TEST_PROVIDERS, createChatWithAttachmentDrivers } from './ChatWithAttachmentTestConfig';

// Create factory for tests that need to create drivers directly
const factory = new ChatWithAttachmentDriverFactory();

// Enumerate all providers to test
const providers = CHAT_WITH_ATTACHMENT_TEST_PROVIDERS;

// Create drivers for all providers
const drivers = createChatWithAttachmentDrivers(EModel.kLarge);

// Run tests for each provider
providers.forEach((provider, index) => {
   const driver = drivers[index];

   // Skip tests if driver failed to initialize (e.g., missing API key)
   if (!driver) {
      console.warn(`Skipping tests for ${provider} - driver initialization failed (likely missing API key)`);
      return;
   }

   describe(`ChatWithAttachmentDriverFactory (${provider})`, () => {
      it('creates driver with required methods', () => {
         expect(driver).toBeDefined();
         expect(driver).toBeInstanceOf(Object);
         expect(driver.getModelResponse).toBeDefined();
         expect(driver.uploadAttachment).toBeDefined();
         expect(driver.deleteAttachment).toBeDefined();
      });

      it('creates driver for kMini model', () => {
         const miniDriver = factory.create(EModel.kMini, provider);
         expect(miniDriver).toBeDefined();
         expect(miniDriver.getModelResponse).toBeDefined();
      });

      it('creates driver for kLarge model', () => {
         const largeDriver = factory.create(EModel.kLarge, provider);
         expect(largeDriver).toBeDefined();
         expect(largeDriver.getModelResponse).toBeDefined();
      });

      it('implements IChatWithAttachmentDriverFactory interface', () => {
         // Type check: driver should be assignable to IChatWithAttachmentDriver
         const typedDriver: IChatWithAttachmentDriver = driver;
         expect(typedDriver).toBeDefined();
      });
   });
});

describe('ChatWithAttachmentDriverFactory - Cross-provider tests', () => {
   it('creates different driver instances for different providers', () => {
      const openAIDriver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      const azureDriver = factory.create(EModel.kLarge, EModelProvider.kAzureOpenAI);
      
      expect(openAIDriver).not.toBe(azureDriver);
   });
});

