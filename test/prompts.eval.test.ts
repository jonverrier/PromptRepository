/**
 * Test module for evaluating prompt template behavior.
 * Contains integration tests that verify prompt templates produce expected outputs
 * when expanded with different parameter values and processed by the LLM.
 */

// Copyright (c) 2025 Jon Verrier
import { expect } from 'expect';
import { describe, it } from 'mocha';
import { IPrompt } from '../src/entry';
import prompts from './template-prompt.json';
import { getModelResponse } from '../src/Chat';
import { PromptInMemoryRepository } from '../src/PromptRepository';

describe('Template Prompt Evals', () => {
   let prompt: IPrompt = prompts.find(p => p.id === "template-prompt-002")!;
   const repo = new PromptInMemoryRepository(prompts);

   it('should handle basic greeting with known content', async () => {
      
      const expandedUserPrompt = repo.expandUserPrompt(prompt, { LOCATION: 'Monaco' });

      const result = await getModelResponse(prompt.systemPrompt, expandedUserPrompt);

      expect(result).toContain('Welcome to the Monaco Grand Prix!');

   }).timeout(10000);

   it('should produce same output with minor difference', async () => {

      const expandedUserPrompt = repo.expandUserPrompt(prompt, { LOCATION: 'Monaco Grand Prix' });

      const result = await getModelResponse(prompt.systemPrompt, expandedUserPrompt);

      expect(result).toContain('Welcome to the Monaco Grand Prix');

   }).timeout(10000);

   it('should produce different output with different location', async () => {

      const expandedUserPrompt = repo.expandUserPrompt(prompt, { LOCATION: 'Spa' });

      const result = await getModelResponse(prompt.systemPrompt, expandedUserPrompt);

      expect(result).toContain('Welcome to the Spa Grand Prix');

      expect(result).not.toContain('Monaco');

   }).timeout(10000);
});
