/**
 * @module ChatWithAttachmentDriverFactory.test
 * Contract tests for ChatWithAttachmentDriverFactory provider routing.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';

import { ChatWithAttachmentDriverFactory } from '../src/ChatWithAttachmentFactory';
import { OpenAIChatWithAttachment } from '../src/ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from '../src/ChatWithAttachment.AzureOpenAI';
import { GoogleGeminiChatWithAttachment } from '../src/ChatWithAttachment.GoogleGemini';
import { AnthropicChatWithAttachment } from '../src/ChatWithAttachment.Anthropic';
import { EModel, EModelProvider } from '../src/entry';

describe('ChatWithAttachmentDriverFactory.create', () => {
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

   it('returns OpenAIChatWithAttachment for kOpenAI', () => {
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      expect(driver).toBeInstanceOf(OpenAIChatWithAttachment);
   });

   it('returns AzureOpenAIChatWithAttachment for kAzureOpenAI', () => {
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kMini, EModelProvider.kAzureOpenAI);
      expect(driver).toBeInstanceOf(AzureOpenAIChatWithAttachment);
   });

   it('returns GoogleGeminiChatWithAttachment for kGoogleGemini', () => {
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kGoogleGemini);
      expect(driver).toBeInstanceOf(GoogleGeminiChatWithAttachment);
   });

   it('returns AnthropicChatWithAttachment for kAnthropic', () => {
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kAnthropic);
      expect(driver).toBeInstanceOf(AnthropicChatWithAttachment);
   });

   it('returns GoogleGeminiChatWithAttachment for kDefault when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kDefault);
      expect(driver).toBeInstanceOf(GoogleGeminiChatWithAttachment);
   });

   it('returns OpenAIChatWithAttachment for kDefault when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'production';
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kDefault);
      expect(driver).toBeInstanceOf(OpenAIChatWithAttachment);
   });

   it('returns distinct instances for different providers', () => {
      const factory = new ChatWithAttachmentDriverFactory();
      const openAiDriver = factory.create(EModel.kLarge, EModelProvider.kOpenAI);
      const azureDriver = factory.create(EModel.kLarge, EModelProvider.kAzureOpenAI);
      expect(openAiDriver).not.toBe(azureDriver);
   });
});
