/**
 * @module chat.test
 * 
 * Unit tests for the Chat module which handles interactions with the LLM.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatDriverFactory, EModelProvider, EModel, EChatRole, IChatMessage, ChatMessageClassName } from '../src/entry';

const TEST_TIMEOUT_MS = 30000; // 30 second timeout for all tests

describe('getChatCompletion', () => {

   const chatDriverFactory = new ChatDriverFactory();
   const chatDriver = chatDriverFactory.create(EModel.kLarge, EModelProvider.kOpenAI);

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

describe('getStreamedModelResponse', () => {

   const chatDriverFactory = new ChatDriverFactory();
   const chatDriver = chatDriverFactory.create(EModel.kLarge, EModelProvider.kOpenAI);

   it('should successfully stream chat completion with system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      const result = await iterator.next();

      expect(result.value).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.value.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
   }).timeout(TEST_TIMEOUT_MS);

   it('should successfully stream chat completion without system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse(undefined, 'say Hi');
      const result = await iterator.next();
      expect(result.value).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.value.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
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
      const chunks: string[] = [];
      while (true) {
         const result = await iterator.next();
         if (result.done) break;
         chunks.push(result.value);
      }
      const fullText = chunks.join('');
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
   }).timeout(TEST_TIMEOUT_MS);
});

describe('Constrained Model Response Tests', () => {

   const chatDriverFactory = new ChatDriverFactory();
   const chatDriver = chatDriverFactory.create(EModel.kLarge, EModelProvider.kOpenAI);

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
