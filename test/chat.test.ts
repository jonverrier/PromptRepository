/**
 * @module chat.test
 * 
 * Unit tests for the Chat module which handles interactions with the LLM.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatDriverFactory, EModelProvider, EModel } from '../src/entry';

describe('getChatCompletion', () => {

   const chatDriverFactory = new ChatDriverFactory();
   const chatDriver = chatDriverFactory.create(EModel.kLarge, EModelProvider.kOpenAI);

   it('should successfully return chat completion with system prompt', async () => {
      const result = await chatDriver.getModelResponse('You are helpful', 'say Hi');
      expect(result).toMatch(/(Hi|Hello)/);
   }).timeout(10000);

   it('should successfully return chat completion without system prompt', async () => {
      const result = await chatDriver.getModelResponse(undefined, 'say Hi');
      expect(result).toMatch(/(Hi|Hello)/);
   }).timeout(10000);

});

describe('getStreamedModelResponse', () => {

   const chatDriverFactory = new ChatDriverFactory();
   const chatDriver = chatDriverFactory.create(EModel.kLarge, EModelProvider.kOpenAI);

   it('should successfully stream chat completion with system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse('You are helpful', 'say Hi');
      const result = await iterator.next();

      expect(result.value).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.value.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
   }).timeout(10000);

   it('should successfully stream chat completion without system prompt', async () => {
      const iterator = chatDriver.getStreamedModelResponse(undefined, 'say Hi');
      const result = await iterator.next();
      expect(result.value).toMatch(/[A-Za-z]+/); // Expect at least one word (sequence of letters)
      expect(result.value.toLowerCase()).toMatch(/(hi|hello)/); // Check for hi or hello substring
   }).timeout(10000);

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
   }).timeout(15000);
});