/**
 * @module chatwithattachmentfactory.test
 * 
 * Unit tests for the ChatWithAttachmentFactory module.
 */
// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatWithAttachmentDriverFactory, EModelProvider, EModel, IChatWithAttachmentDriver } from '../src/entry';

describe('ChatWithAttachmentDriverFactory', () => {
   const factory = new ChatWithAttachmentDriverFactory();

   it('creates OpenAI driver for kOpenAI provider', () => {
      const driver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      expect(driver).toBeDefined();
      expect(driver).toBeInstanceOf(Object);
      expect(driver.getModelResponse).toBeDefined();
      expect(driver.uploadAttachment).toBeDefined();
      expect(driver.deleteAttachment).toBeDefined();
   });

   it('creates Azure OpenAI driver for kAzureOpenAI provider', () => {
      const driver = factory.create(EModel.kLarge, EModelProvider.kAzureOpenAI);
      expect(driver).toBeDefined();
      expect(driver).toBeInstanceOf(Object);
      expect(driver.getModelResponse).toBeDefined();
      expect(driver.uploadAttachment).toBeDefined();
      expect(driver.deleteAttachment).toBeDefined();
   });

   it('creates different driver instances for different providers', () => {
      const openAIDriver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      const azureDriver = factory.create(EModel.kLarge, EModelProvider.kAzureOpenAI);
      
      expect(openAIDriver).not.toBe(azureDriver);
   });

   it('creates drivers for kMini model', () => {
      const openAIDriver = factory.create(EModel.kMini, EModelProvider.kOpenAI);
      const azureDriver = factory.create(EModel.kMini, EModelProvider.kAzureOpenAI);
      
      expect(openAIDriver).toBeDefined();
      expect(azureDriver).toBeDefined();
   });

   it('creates drivers for kLarge model', () => {
      const openAIDriver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      const azureDriver = factory.create(EModel.kLarge, EModelProvider.kAzureOpenAI);
      
      expect(openAIDriver).toBeDefined();
      expect(azureDriver).toBeDefined();
   });

   it('implements IChatWithAttachmentDriverFactory interface', () => {
      const driver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      // Type check: driver should be assignable to IChatWithAttachmentDriver
      const typedDriver: IChatWithAttachmentDriver = driver;
      expect(typedDriver).toBeDefined();
   });
});

