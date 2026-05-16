/**
 * @module MockAnthropicChatWithAttachment
 *
 * Mock implementation of AnthropicChatWithAttachment for testing.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { EModel } from '../src/entry';
import { AnthropicChatWithAttachment } from '../src/ChatWithAttachment.Anthropic';
import type { MessageCreateParams } from '@anthropic-ai/sdk/resources/messages/messages';

type MockMessagesCreateFn = (
   params: MessageCreateParams
) => Promise<{ content: Array<{ type: 'text'; text: string }> }>;

const mockHolder: { fn?: MockMessagesCreateFn } = {};

/**
 * Mock class for testing Anthropic ChatWithAttachment driver.
 */
export class MockAnthropicChatWithAttachment extends AnthropicChatWithAttachment {
   constructor(modelType: EModel = EModel.kLarge) {
      super(modelType, {
         client: {
            messages: {
               create: async (params: MessageCreateParams) => {
                  if (mockHolder.fn) {
                     return mockHolder.fn(params);
                  }
                  return {
                     content: [{ type: 'text' as const, text: 'mock response' }],
                     id: 'mock',
                     model: 'claude-sonnet-4-5',
                     role: 'assistant' as const,
                     stop_reason: 'end_turn' as const,
                     stop_sequence: null,
                     type: 'message' as const,
                     usage: { input_tokens: 0, output_tokens: 0 }
                  };
               }
            }
         } as unknown as import('@anthropic-ai/sdk').default
      });
   }

   setMockMessagesCreate(mockFn: MockMessagesCreateFn): void {
      mockHolder.fn = mockFn;
   }

   resetMocks(): void {
      mockHolder.fn = undefined;
   }
}
