/**
 * @module embed.factory.test
 * Contract tests for EmbeddingDriverFactory provider routing (no live API calls).
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';

import { EmbeddingDriverFactory } from '../src/EmbedFactory';
import { NativeOpenAIEmbeddingDriver } from '../src/Embed.OpenAI';
import { AzureOpenAIEmbeddingDriver } from '../src/Embed.AzureOpenAI';
import { EModel, EModelProvider, InvalidParameterError } from '../src/entry';

describe('EmbeddingDriverFactory.create', () => {
   const originalOpenAiKey = process.env.OPENAI_API_KEY;
   const originalAzureKey = process.env.AZURE_OPENAI_API_KEY;
   const originalAzureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;

   beforeAll(() => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
   });

   afterAll(() => {
      if (originalOpenAiKey !== undefined) {
         process.env.OPENAI_API_KEY = originalOpenAiKey;
      } else {
         delete process.env.OPENAI_API_KEY;
      }
      if (originalAzureKey !== undefined) {
         process.env.AZURE_OPENAI_API_KEY = originalAzureKey;
      } else {
         delete process.env.AZURE_OPENAI_API_KEY;
      }
      if (originalAzureEndpoint !== undefined) {
         process.env.AZURE_OPENAI_ENDPOINT = originalAzureEndpoint;
      } else {
         delete process.env.AZURE_OPENAI_ENDPOINT;
      }
   });

   it('returns NativeOpenAIEmbeddingDriver for kOpenAI', () => {
      const factory = new EmbeddingDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      expect(driver).toBeInstanceOf(NativeOpenAIEmbeddingDriver);
      expect(driver.drivenModelProvider).toBe(EModelProvider.kOpenAI);
      expect(driver.drivenModelType).toBe(EModel.kLarge);
   });

   it('returns AzureOpenAIEmbeddingDriver for kAzureOpenAI', () => {
      const factory = new EmbeddingDriverFactory();
      const driver = factory.create(EModel.kMini, EModelProvider.kAzureOpenAI);
      expect(driver).toBeInstanceOf(AzureOpenAIEmbeddingDriver);
      expect(driver.drivenModelProvider).toBe(EModelProvider.kAzureOpenAI);
      expect(driver.drivenModelType).toBe(EModel.kMini);
   });

   it('throws for kGoogleGemini', () => {
      const factory = new EmbeddingDriverFactory();
      expect(() => factory.create(EModel.kLarge, EModelProvider.kGoogleGemini))
         .toThrow(InvalidParameterError);
   });

   it('throws for kAnthropic', () => {
      const factory = new EmbeddingDriverFactory();
      expect(() => factory.create(EModel.kLarge, EModelProvider.kAnthropic))
         .toThrow(InvalidParameterError);
   });

   it('throws for kDefault', () => {
      const factory = new EmbeddingDriverFactory();
      expect(() => factory.create(EModel.kLarge, EModelProvider.kDefault))
         .toThrow(InvalidParameterError);
   });
});
