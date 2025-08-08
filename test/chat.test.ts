/**
 * @module chat.test
 * 
 * Unit tests for the Chat module which handles interactions with the LLM.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { ChatDriverFactory, EModelProvider, EModel, EChatRole, IChatMessage, ChatMessageClassName, IFunction } from '../src/entry';
import { OpenAIModelChatDriver } from '../src/Chat';

const TEST_TIMEOUT_MS = 30000; // 30 second timeout for all tests

// Create chat drivers for both providers outside describe blocks
const chatDriverFactory = new ChatDriverFactory();
const providers = [EModelProvider.kOpenAI, EModelProvider.kAzureOpenAI];
const chatDrivers = providers.map(provider => chatDriverFactory.create(EModel.kLarge, provider));

// Mock class for testing exponential backoff
class MockOpenAIChatDriver extends OpenAIModelChatDriver {
   private failCount = 0;
   private shouldFail = false;
   private maxFailures = 0;

   constructor() {
      super(EModel.kLarge);
      // Mock the OpenAI client
      (this as any).openai = {
         responses: {
            create: async (config: any) => {
               if (this.shouldFail && this.failCount < this.maxFailures) {
                  this.failCount++;
                  const error: any = new Error('Rate limit exceeded');
                  error.status = 429;
                  throw error;
               }
               
               // If streaming is requested, return a mock stream
               if (config.stream) {
                  return {
                     [Symbol.asyncIterator]: () => ({
                        next: async () => ({
                           value: { delta: 'Success response' },
                           done: false
                        })
                     })
                  };
               }
               
               // Return new API format with output array
               return { 
                  output: [
                     {
                        type: 'text',
                        content: 'Success response'
                     }
                  ]
               };
            },
            parse: async (config: any) => {
               if (this.shouldFail && this.failCount < this.maxFailures) {
                  this.failCount++;
                  const error: any = new Error('Rate limit exceeded');
                  error.status = 429;
                  throw error;
               }
               return { output_parsed: { test: 'data' } };
            }
         }
      };
   }

   protected getModelName(): string {
      return 'mock-model';
   }

   protected shouldUseToolMessages(): boolean {
      return false; // Mock implementation defaults to false
   }

   setShouldFail(shouldFail: boolean, maxFailures: number = 0) {
      this.shouldFail = shouldFail;
      this.maxFailures = maxFailures;
      this.failCount = 0;
   }

   getFailCount() {
      return this.failCount;
   }

   // Method to override the mock for specific tests
   setMockCreate(mockFn: () => Promise<any>) {
      (this as any).openai.responses.create = mockFn;
   }

   async getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T> {
      // Use retry wrapper like the base class - import retryWithExponentialBackoff
      const { retryWithExponentialBackoff } = await import('../src/DriverHelpers');
      
      const response = await retryWithExponentialBackoff(async () => {
         if (this.shouldFail && this.failCount < this.maxFailures) {
            this.failCount++;
            const error: any = new Error('Rate limit exceeded');
            error.status = 429;
            throw error;
         }
         return (this as any).openai.responses.parse({ jsonSchema });
      });
      
      return ({ test: 'data' } as T);
   }
}

// Run all tests for each provider
providers.forEach((provider, index) => {
  const chatDriver = chatDrivers[index];

  describe(`getChatCompletion (${provider})`, () => {
    it('should successfully return chat completion with system prompt', async () => {
      const result = await chatDriver.getModelResponse('You are helpful', 'say Hi');
      expect(result).toMatch(/(Hi|Hello)/);
    }).timeout(TEST_TIMEOUT_MS);

    it('should successfully return chat completion without system prompt', async () => {
      const result = await chatDriver.getModelResponse(undefined, 'say Hi');
      expect(result).toMatch(/(Hi|Hello)/);
    }).timeout(TEST_TIMEOUT_MS);

    it('should successfully return chat completion with message history', async () => {
      const messageHistory: IChatMessage[] = [
        {
          id: '1',
          className: ChatMessageClassName,
          role: EChatRole.kUser,
          content: 'My name is Alice',
          timestamp: new Date()
        },
        {
          id: '2',
          className: ChatMessageClassName,
          role: EChatRole.kAssistant,
          content: 'Hello Alice, nice to meet you!',
          timestamp: new Date()
        }
      ];
      const result = await chatDriver.getModelResponse('You are helpful', 'What is my name?', messageHistory);
      expect(result.toLowerCase()).toContain('alice');
    }).timeout(TEST_TIMEOUT_MS);
  });

  describe(`getStreamedModelResponse (${provider})`, () => {
    it('should successfully stream chat completion with system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      let result = '';
      while (true) {
        const chunk = await iterator.next();
        if (chunk.done) break;
        if (chunk.value) result += chunk.value;
      }
      expect(result).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
    }).timeout(TEST_TIMEOUT_MS);

    it('should successfully stream chat completion without system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse(undefined, 'say Hi');
      let result = '';
      while (true) {
        const chunk = await iterator.next();
        if (chunk.done) break;
        if (chunk.value) result += chunk.value;
      }
      expect(result).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
    }).timeout(TEST_TIMEOUT_MS);

    it('should successfully stream chat completion with message history', async () => {
      const messageHistory: IChatMessage[] = [
        {
          id: '1',
          className: ChatMessageClassName,
          role: EChatRole.kUser,
          content: 'My name is Bob',
          timestamp: new Date()
        },
        {
          id: '2',
          className: ChatMessageClassName,
          role: EChatRole.kAssistant,
          content: 'Hello Bob, nice to meet you!',
          timestamp: new Date()
        }
      ];
      const iterator = chatDriver.getStreamedModelResponse('You are helpful', 'What is my name?', messageHistory);
      let fullText = '';
      while (true) {
        const result = await iterator.next();
        if (result.done) break;
        if (result.value) fullText += result.value;
      }
      expect(fullText.toLowerCase()).toContain('bob');
    }).timeout(TEST_TIMEOUT_MS);

    it('should stream long-form content in multiple chunks', async () => {
      const prompt = 'Write a Shakespearean sonnet about artificial intelligence';
      const iterator = chatDriver.getStreamedModelResponse(undefined, prompt);

      const chunks: string[] = [];
      let totalLength = 0;

      try {
        while (true) {
          const result = await iterator.next();
          if (result.done) break;
          if (result.value) {
            chunks.push(result.value);
            totalLength += result.value.length;
            // If we've collected enough text to verify it's a long response, we can stop
            if (totalLength > 1000 && chunks.length > 1) break;
          }
        }
      } finally {
        // Ensure we clean up the iterator
        await iterator.return?.();
      }

      // We expect multiple chunks for a sonnet
      expect(chunks.length).toBeGreaterThan(1);

      // Combine chunks and verify we got meaningful content
      const fullText = chunks.join('');

      expect(fullText).toMatch(/[A-Za-z]/); // Contains letters
      expect(fullText.length).toBeGreaterThan(100); // Got enough content to verify streaming works
      // A sonnet should have 14 lines
      const lines = fullText.split('\n').filter(line => line.trim().length > 0);
      expect(lines.length).toBeGreaterThanOrEqual(14);
    }).timeout(60000); // 60 second timeout for long-form content
  });

  describe(`Constrained Model Response Tests (${provider})`, () => {
    it('should return constrained JSON response matching schema', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age'],
        additionalProperties: false
      };

      const defaultValue = { name: 'default', age: 0 };
      const result = await chatDriver.getConstrainedModelResponse(
        'You are a helpful assistant that returns person data',
        'Give me details about a person named Bob who is 42 years old',
        schema,
        defaultValue
      );

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('age');
      expect(result.name).toBe('Bob');
      expect(result.age).toBe(42);
    }).timeout(TEST_TIMEOUT_MS);

    it('should return constrained JSON response with message history', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age'],
        additionalProperties: false
      };

      const messageHistory: IChatMessage[] = [
        {
          id: '1',
          className: ChatMessageClassName,
          role: EChatRole.kUser,
          content: 'I am talking about Charlie who is 25 years old',
          timestamp: new Date()
        },
        {
          id: '2',
          className: ChatMessageClassName,
          role: EChatRole.kAssistant,
          content: 'I understand you are referring to Charlie, age 25.',
          timestamp: new Date()
        }
      ];

      const defaultValue = { name: 'default', age: 0 };
      const result = await chatDriver.getConstrainedModelResponse(
        'You are a helpful assistant that returns person data',
        'Give me the details about the person we discussed',
        schema,
        defaultValue,
        messageHistory
      );

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('age');
      expect(result.name).toBe('Charlie');
      expect(result.age).toBe(25);
    }).timeout(TEST_TIMEOUT_MS);

    it('should return default value when response parsing fails', async () => {
      const schema = {
        type: 'object',
        properties: {
          validKey: { type: 'boolean' }
        },
        required: ['validKey'],
        additionalProperties: false
      };

      const defaultValue = { validKey: false };
      const result = await chatDriver.getConstrainedModelResponse(
        undefined,
        'Give me an invalid response',
        schema,
        defaultValue
      );

      expect(result).toEqual(defaultValue);
    }).timeout(TEST_TIMEOUT_MS);

    it('should handle complex nested schema constraints', async () => {
      const schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['email', 'phone'] },
                    value: { type: 'string' }
                  },
                  required: ['type', 'value'],
                  additionalProperties: false
                }
              }
            },
            required: ['name', 'contacts'],
            additionalProperties: false
          }
        },
        required: ['user'],
        additionalProperties: false
      };

      const defaultValue = {
        user: {
          name: 'default',
          contacts: []
        }
      };

      const result = await chatDriver.getConstrainedModelResponse(
        'You are a helpful assistant that returns user contact information',
        'Create a user named Alice with an email contact alice@example.com and phone contact 555-0123',
        schema,
        defaultValue
      );

      expect(result.user.name).toBe('Alice');
      expect(result.user.contacts).toHaveLength(2);
      expect(result.user.contacts).toContainEqual({
        type: 'email',
        value: 'alice@example.com'
      });
      expect(result.user.contacts).toContainEqual({
        type: 'phone',
        value: '555-0123'
      });
    }).timeout(TEST_TIMEOUT_MS);
  });

  // Mini model tests for each provider
  const miniChatDriver = chatDriverFactory.create(EModel.kMini, provider);

  describe(`Mini Model Tests (${provider})`, () => {
    it('should successfully return simple chat completion', async () => {
      const result = await miniChatDriver.getModelResponse('You are helpful', 'say Hi');
      expect(result).toMatch(/(Hi|Hello)/);
    }).timeout(TEST_TIMEOUT_MS);

    it('should successfully stream chat completion', async () => {
      const iterator = miniChatDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      let result = '';
      while (true) {
        const chunk = await iterator.next();
        if (chunk.done) break;
        if (chunk.value) result += chunk.value;
      }
      expect(result).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
    }).timeout(TEST_TIMEOUT_MS);
  });
});

describe('Exponential Backoff Tests', () => {
   let mockDriver: MockOpenAIChatDriver;

   beforeEach(() => {
      mockDriver = new MockOpenAIChatDriver();
   });

   afterEach(() => {
      mockDriver.setShouldFail(false);
   });

   it('should retry on 429 errors and eventually succeed', async () => {
      // Set up to fail 2 times then succeed
      mockDriver.setShouldFail(true, 2);

      const startTime = Date.now();
      const result = await mockDriver.getModelResponse('You are helpful', 'say Hi');
      const endTime = Date.now();

      expect(result).toBe('Success response');
      expect(mockDriver.getFailCount()).toBe(2);

      // Verify exponential backoff timing (should be ~3 seconds: 1s + 2s)
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThan(2500); // At least 2.5 seconds
      expect(elapsedTime).toBeLessThan(5000); // Less than 5 seconds
   }).timeout(10000);

   it('should retry on 429 errors for constrained responses', async () => {
      // Set up to fail 1 time then succeed
      mockDriver.setShouldFail(true, 1);

      const schema = {
         type: 'object',
         properties: { test: { type: 'string' } },
         required: ['test']
      };

      const startTime = Date.now();
      const result = await mockDriver.getConstrainedModelResponse(
         'You are helpful',
         'return test data',
         schema,
         { test: 'default' }
      );
      const endTime = Date.now();

      expect(result).toEqual({ test: 'data' });
      expect(mockDriver.getFailCount()).toBe(1);

      // Verify exponential backoff timing (should be ~1 second)
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThan(800); // At least 800ms
      expect(elapsedTime).toBeLessThan(2000); // Less than 2 seconds
   }).timeout(5000);

   it('should throw error after max retries exceeded', async () => {
      // Set up to fail more than max retries (5)
      mockDriver.setShouldFail(true, 6);

      const startTime = Date.now();
      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI API error: Rate limit exceeded');
      const endTime = Date.now();

      expect(mockDriver.getFailCount()).toBe(6); // Should have tried 6 times (1 initial + 5 retries)
      
      // Verify it took reasonable time (should be ~31 seconds: 1+2+4+8+16)
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThan(25000); // At least 25 seconds
      expect(elapsedTime).toBeLessThan(40000); // Less than 40 seconds
   }).timeout(45000);

   it('should not retry on non-429 errors', async () => {
      // Mock to throw a different error
      mockDriver.setMockCreate(async () => {
         const error: any = new Error('Authentication failed');
         error.status = 401;
         throw error;
      });

      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI API error: Authentication failed');
   }).timeout(5000);

   it('should handle content filter errors without retrying', async () => {
      // Mock to throw a content filter error
      mockDriver.setMockCreate(async () => {
         const error: any = new Error('Content filter triggered');
         error.status = 400;
         error.error = {
            type: 'content_filter',
            message: 'Content violates OpenAI safety policies'
         };
         throw error;
      });

      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI content filter triggered: Content violates OpenAI safety policies');
   }).timeout(5000);

   it('should handle safety system errors without retrying', async () => {
      // Mock to throw a safety error
      mockDriver.setMockCreate(async () => {
         const error: any = new Error('Safety system triggered');
         error.status = 400;
         error.error = {
            type: 'safety',
            message: 'Content violates OpenAI safety guidelines'
         };
         throw error;
      });

      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI safety system triggered: Content violates OpenAI safety guidelines');
   }).timeout(5000);

   it('should handle general refusal errors without retrying', async () => {
      // Mock to throw a general refusal error
      mockDriver.setMockCreate(async () => {
         const error: any = new Error('Request refused');
         error.status = 400;
         error.error = {
            type: 'invalid_request',
            message: 'I cannot process this request'
         };
         throw error;
      });

      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI refused request: I cannot process this request');
   }).timeout(5000);

   it('should handle 403 forbidden errors as refusals', async () => {
      // Mock to throw a 403 error
      mockDriver.setMockCreate(async () => {
         const error: any = new Error('Forbidden');
         error.status = 403;
         error.message = 'Access forbidden';
         throw error;
      });

      await expect(
         mockDriver.getModelResponse('You are helpful', 'say Hi')
      ).rejects.toThrow('OpenAI refused request (403): Access forbidden');
   }).timeout(5000);

   it('should handle streaming with exponential backoff', async () => {
      // Set up to fail 1 time then succeed
      mockDriver.setShouldFail(true, 1);

      const startTime = Date.now();
      const iterator = mockDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      const result = await iterator.next();
      const endTime = Date.now();

      expect(result.value).toBe('Success response');
      expect(mockDriver.getFailCount()).toBe(1);

      // Verify exponential backoff timing
      const elapsedTime = endTime - startTime;
      expect(elapsedTime).toBeGreaterThan(800);
      expect(elapsedTime).toBeLessThan(2000);
   }).timeout(5000);

   it('should handle mid-stream errors gracefully', async () => {
      // Mock that returns some chunks then throws an error
      mockDriver.setMockCreate(async () => {
         let chunkCount = 0;
         return {
            [Symbol.asyncIterator]: () => ({
               next: async () => {
                  chunkCount++;
                  if (chunkCount <= 3) {
                     // Return successful chunks
                     return {
                        value: {
                           type: 'response.output_text.delta',
                           delta: `Chunk ${chunkCount} `
                        },
                        done: false
                     };
                  } else {
                     // Throw error after a few chunks
                     const error: any = new Error('Network connection lost');
                     error.status = 500;
                     throw error;
                  }
               }
            })
         };
      });

      const iterator = mockDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      const chunks: string[] = [];
      let finalResult: any;
      let hitError = false;

      try {
         while (true) {
            const result = await iterator.next();
            if (result.done) {
               finalResult = result;
               // Also add the final value if it exists (this could be the interruption message)
               if (result.value) {
                  chunks.push(result.value);
               }
               break;
            }
            if (result.value) {
               chunks.push(result.value);
            }
         }
      } catch (error) {
         hitError = true;
      }

      // Should not throw an exception - should handle gracefully
      expect(hitError).toBe(false);
      
      // Should have received the successful chunks
      expect(chunks.length).toBe(4); // 3 data chunks + 1 interruption message
      expect(chunks.join('')).toContain('Chunk 1');
      expect(chunks.join('')).toContain('Chunk 2');
      expect(chunks.join('')).toContain('Chunk 3');
      
      // Should have received the interruption message as the final chunk
      const allContent = chunks.join('');
      expect(allContent).toContain('Sorry, it looks like the response was interrupted. Please try again.');
      
      // Stream should be marked as done
      expect(finalResult.done).toBe(true);
      
      // Verify the interruption message is the last chunk
      expect(chunks[chunks.length - 1]).toContain('Sorry, it looks like the response was interrupted. Please try again.');
   }).timeout(5000);
});


