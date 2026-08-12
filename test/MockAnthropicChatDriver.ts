/**
 * @module MockAnthropicChatDriver
 *
 * Mock implementation of AnthropicChatDriver for testing exponential backoff and error handling.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { EModel, IChatMessage, IFunction, EVerbosity } from '../src/entry';
import { AnthropicChatDriver } from '../src/Chat.Anthropic';

/**
 * Mock class for testing Anthropic driver with exponential backoff support.
 */
export class MockAnthropicChatDriver extends AnthropicChatDriver {
   private failCount = 0;
   private shouldFail = false;
   private maxFailures = 0;
   private mockMessagesCreate?: () => Promise<unknown>;

   constructor() {
      super(EModel.kLarge);
   }

   /**
    * Set whether the mock should fail and how many times.
    */
   setShouldFail(shouldFail: boolean, maxFailures: number = 0): void {
      this.shouldFail = shouldFail;
      this.maxFailures = maxFailures;
      this.failCount = 0;
      this.mockMessagesCreate = undefined;
   }

   /**
    * Get the number of failures that occurred.
    */
   getFailCount(): number {
      return this.failCount;
   }

   /**
    * Set custom mock behavior for messages.create.
    */
   setMockCreate(mockFn: () => Promise<unknown>): void {
      this.mockMessagesCreate = mockFn;
   }

   /**
    * Method to set custom mock behavior for constrained response tests.
    */
   setMockSendMessage(mockFn: () => Promise<{ content: Array<{ type: string; text: string }> }>): void {
      this.mockMessagesCreate = async () => {
         const result = await mockFn();
         return {
            content: result.content,
            stop_reason: 'end_turn',
            role: 'assistant',
            id: 'msg_mock',
            model: 'mock-model',
            type: 'message',
            usage: { input_tokens: 0, output_tokens: 0 }
         };
      };
   }

   private async invokeMockOrDefault(): Promise<{ content: Array<{ type: string; text: string }> }> {
      if (this.mockMessagesCreate) {
         return this.mockMessagesCreate() as Promise<{ content: Array<{ type: string; text: string }> }>;
      }

      if (this.shouldFail && this.failCount < this.maxFailures) {
         this.failCount++;
         const error: Error & { status?: number } = new Error('Rate limit exceeded');
         error.status = 429;
         throw error;
      }

      return {
         content: [{ type: 'text', text: 'Success response' }]
      };
   }

   /**
    * Override getModelResponse to use mock.
    */
   async getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string> {
      const { retryWithExponentialBackoff, MAX_RETRIES } = await import('../src/DriverHelpers.js');

      const result = await retryWithExponentialBackoff(async () => {
         const response = await this.invokeMockOrDefault();
         const textBlock = response.content.find(b => b.type === 'text');
         return textBlock?.text ?? 'Success response';
      }, MAX_RETRIES, 'Anthropic');

      return result;
   }

   /**
    * Override getStreamedModelResponse to use mock.
    */
   getStreamedModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string> {
      const self = this;

      return (async function* () {
         try {
            const { retryWithExponentialBackoff, MAX_RETRIES } = await import('../src/DriverHelpers.js');

            if (self.mockMessagesCreate) {
               try {
                  const mockResult = await retryWithExponentialBackoff(
                     self.mockMessagesCreate,
                     MAX_RETRIES,
                     'Anthropic'
                  ) as unknown;

                  if (mockResult && typeof (mockResult as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
                     for await (const chunk of mockResult as AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>) {
                        const content = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content;
                        if (content) {
                           yield content;
                        }
                     }
                     return;
                  }
               } catch (streamError) {
                  yield 'Sorry, it looks like the response was interrupted. Please try again.';
                  return;
               }
            }

            await retryWithExponentialBackoff(async () => {
               await self.invokeMockOrDefault();
               return { success: true };
            }, MAX_RETRIES, 'Anthropic');

            const words = 'Success response'.split(/(\s+)/);
            for (const word of words) {
               if (word.trim().length > 0 || word.match(/\s+/)) {
                  yield word;
               }
            }
         } catch (error) {
            throw error;
         }
      })();
   }

   /**
    * Override getConstrainedModelResponse to use mock.
    */
   async getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T> {
      const { retryWithExponentialBackoff, MAX_RETRIES } = await import('../src/DriverHelpers.js');

      if (this.mockMessagesCreate) {
         try {
            const result = await retryWithExponentialBackoff(
               this.mockMessagesCreate,
               MAX_RETRIES,
               'Anthropic'
            ) as { content: Array<{ type: string; text: string }> };
            const textBlock = result.content?.find(b => b.type === 'text');
            const responseText = textBlock?.text ?? '';
            try {
               return JSON.parse(responseText) as T;
            } catch (parseError) {
               return defaultValue;
            }
         } catch (error) {
            return defaultValue;
         }
      }

      try {
         const result = await retryWithExponentialBackoff(async () => {
            if (this.shouldFail && this.failCount < this.maxFailures) {
               this.failCount++;
               const error: Error & { status?: number } = new Error('Rate limit exceeded');
               error.status = 429;
               throw error;
            }

            let jsonData: Record<string, unknown> = { test: 'data' };
            if (userPrompt.includes('return test data')) {
               jsonData = { test: 'data' };
            } else {
               const jsonMatch = userPrompt.match(/\{[\s\S]*\}/);
               if (jsonMatch) {
                  try {
                     jsonData = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
                  } catch {
                     // use default
                  }
               }
            }

            return JSON.stringify(jsonData);
         }, MAX_RETRIES, 'Anthropic');

         try {
            return JSON.parse(result) as T;
         } catch (parseError) {
            return defaultValue;
         }
      } catch (error) {
         return defaultValue;
      }
   }
}
