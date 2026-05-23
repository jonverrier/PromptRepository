/**
 * @module ChatDriverFactory.test
 * Contract tests for ChatDriverFactory provider routing (no live LLM calls).
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';

import { ChatDriverFactory } from '../src/ChatFactory';
import { OpenAIChatDriver } from '../src/Chat.OpenAI';
import { AzureOpenAIChatDriver } from '../src/Chat.AzureOpenAI';
import { GoogleGeminiChatDriver } from '../src/Chat.GoogleGemini';
import { AnthropicChatDriver } from '../src/Chat.Anthropic';
import { EModel, EModelProvider } from '../src/entry';

describe('ChatDriverFactory.create', () => {
   const originalOpenAiKey = process.env.OPENAI_API_KEY;
   const originalAzureKey = process.env.AZURE_OPENAI_API_KEY;
   const originalAzureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
   const originalGeminiKey = process.env.GOOGLE_GEMINI_API_KEY;
   const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
   const originalNodeEnv = process.env.NODE_ENV;

   beforeAll(() => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.AZURE_OPENAI_API_KEY = 'test-azure-key';
      process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
      process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
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
      if (originalGeminiKey !== undefined) {
         process.env.GOOGLE_GEMINI_API_KEY = originalGeminiKey;
      } else {
         delete process.env.GOOGLE_GEMINI_API_KEY;
      }
      if (originalAnthropicKey !== undefined) {
         process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
      } else {
         delete process.env.ANTHROPIC_API_KEY;
      }
      if (originalNodeEnv !== undefined) {
         process.env.NODE_ENV = originalNodeEnv;
      } else {
         delete process.env.NODE_ENV;
      }
   });

   it('returns OpenAIChatDriver for kOpenAI', () => {
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      expect(driver).toBeInstanceOf(OpenAIChatDriver);
   });

   it('returns AzureOpenAIChatDriver for kAzureOpenAI', () => {
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kMini, EModelProvider.kAzureOpenAI);
      expect(driver).toBeInstanceOf(AzureOpenAIChatDriver);
   });

   it('returns GoogleGeminiChatDriver for kGoogleGemini', () => {
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kGoogleGemini);
      expect(driver).toBeInstanceOf(GoogleGeminiChatDriver);
   });

   it('returns AnthropicChatDriver for kAnthropic', () => {
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kAnthropic);
      expect(driver).toBeInstanceOf(AnthropicChatDriver);
   });

   it('returns GoogleGeminiChatDriver for kDefault when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kDefault);
      expect(driver).toBeInstanceOf(GoogleGeminiChatDriver);
   });

   it('returns OpenAIChatDriver for kDefault when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'production';
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kDefault);
      expect(driver).toBeInstanceOf(OpenAIChatDriver);
   });
});
