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