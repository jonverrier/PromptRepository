/**
 * @module anthropic.chatwithattachment.test
 *
 * Unit tests for AnthropicChatWithAttachment MIME mapping and configuration.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';
import {
   ChatWithAttachmentDriverFactory,
   EModelProvider,
   EModel,
   EVerbosity,
   InvalidStateError,
   InvalidParameterError
} from '../src/entry';
import { AnthropicChatWithAttachment } from '../src/ChatWithAttachment.Anthropic';
import { MockAnthropicChatWithAttachment } from './MockAnthropicChatWithAttachment';
import type { MessageCreateParams } from '@anthropic-ai/sdk/resources/messages/messages';

describe('AnthropicChatWithAttachment unit tests', () => {
   const originalApiKey = process.env.ANTHROPIC_API_KEY;

   afterEach(() => {
      if (originalApiKey !== undefined) {
         process.env.ANTHROPIC_API_KEY = originalApiKey;
      } else {
         delete process.env.ANTHROPIC_API_KEY;
      }
   });

   it('should throw InvalidStateError when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new AnthropicChatWithAttachment(EModel.kLarge)).toThrow(InvalidStateError);
   });

   it('should be created via ChatWithAttachmentDriverFactory for kAnthropic provider', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const factory = new ChatWithAttachmentDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kAnthropic);
      expect(driver).toBeInstanceOf(AnthropicChatWithAttachment);
   });

   it('should reject attachment references', async () => {
      const driver = new MockAnthropicChatWithAttachment();
      driver.setMockMessagesCreate(async () => ({
         content: [{ type: 'text', text: 'unused' }]
      }));

      await expect(
         driver.getModelResponse(undefined, 'prompt', EVerbosity.kMedium, { id: 'file-1' })
      ).rejects.toThrow(InvalidParameterError);
   });

   it('should map text/plain attachment to document text source', async () => {
      let captured: MessageCreateParams | undefined;
      const driver = new MockAnthropicChatWithAttachment();
      driver.setMockMessagesCreate(async (params) => {
         captured = params;
         return { content: [{ type: 'text', text: 'ok' }] };
      });

      await driver.getModelResponse(undefined, 'read this', EVerbosity.kMedium, {
         filename: 'notes.txt',
         mimeType: 'text/plain',
         data: Buffer.from('hello world')
      });

      const content = captured!.messages[0].content as Array<{ type: string; source?: { type: string; media_type?: string; data?: string } }>;
      const doc = content.find(b => b.type === 'document');
      expect(doc?.source?.type).toBe('text');
      expect(doc?.source?.media_type).toBe('text/plain');
      expect(doc?.source?.data).toBe('hello world');
   });

   it('should map application/pdf attachment to base64 document source', async () => {
      let captured: MessageCreateParams | undefined;
      const driver = new MockAnthropicChatWithAttachment();
      driver.setMockMessagesCreate(async (params) => {
         captured = params;
         return { content: [{ type: 'text', text: 'ok' }] };
      });

      const pdfBytes = Buffer.from('%PDF-1.4');
      await driver.getModelResponse(undefined, 'read pdf', EVerbosity.kMedium, {
         filename: 'doc.pdf',
         mimeType: 'application/pdf',
         data: pdfBytes
      });

      const content = captured!.messages[0].content as Array<{ type: string; source?: { type: string; media_type?: string; data?: string } }>;
      const doc = content.find(b => b.type === 'document');
      expect(doc?.source?.type).toBe('base64');
      expect(doc?.source?.media_type).toBe('application/pdf');
      expect(doc?.source?.data).toBe(pdfBytes.toString('base64'));
   });

   it('should map image/png attachment to base64 image source', async () => {
      let captured: MessageCreateParams | undefined;
      const driver = new MockAnthropicChatWithAttachment();
      driver.setMockMessagesCreate(async (params) => {
         captured = params;
         return { content: [{ type: 'text', text: 'ok' }] };
      });

      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await driver.getModelResponse(undefined, 'describe', EVerbosity.kMedium, {
         filename: 'pic.png',
         mimeType: 'image/png',
         data: pngBytes
      });

      const content = captured!.messages[0].content as Array<{ type: string; source?: { type: string; media_type?: string } }>;
      const img = content.find(b => b.type === 'image');
      expect(img?.source?.type).toBe('base64');
      expect(img?.source?.media_type).toBe('image/png');
   });

   it('should throw for unsupported MIME types', async () => {
      const driver = new MockAnthropicChatWithAttachment();
      driver.setMockMessagesCreate(async () => ({
         content: [{ type: 'text', text: 'ok' }]
      }));

      await expect(
         driver.getModelResponse(undefined, 'prompt', EVerbosity.kMedium, {
            filename: 'data.bin',
            mimeType: 'application/octet-stream',
            data: Buffer.from([0, 1, 2])
         })
      ).rejects.toThrow(/Unsupported attachment MIME type/);
   });
});
