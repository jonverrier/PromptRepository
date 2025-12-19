/**
 * Test module for evaluating prompt responses.
 * Contains integration tests that verify prompts produce consistent and appropriate 
 * responses when processed by the LLM. 
 * Tests cover three cases: 
 * 1) Simple input/output with known content, 
 * 2) Similar input that should produce same output, and 
 * 3) Variant input that should produce different output.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { IPrompt, IPromptRepository, EModel, EVerbosity, TEST_TARGET_SUPPORTS_VERBOSITY } from '../src/entry';
import { PromptInMemoryRepository } from '../src/PromptRepository';
import { CHAT_TEST_PROVIDERS, createChatDrivers, TEST_TIMEOUT_MS } from './ChatTestConfig';
import prompts from './template-prompt.json';

const typedPrompts = prompts as IPrompt[];

// Create chat drivers for all providers outside describe blocks
const providers = CHAT_TEST_PROVIDERS;
const chatDrivers = createChatDrivers(EModel.kLarge);

// Run tests for each provider
providers.forEach((provider, index) => {
   const chatDriver = chatDrivers[index];

   // Skip tests if driver failed to initialize (e.g., missing API key)
   if (!chatDriver) {
      console.warn(`Skipping tests for ${provider} - driver initialization failed (likely missing API key)`);
      return;
   }

   describe(`Motor Racing Welcome Prompt Tests (${provider})`, () => {
      let prompt: IPrompt = typedPrompts.find(p => p.id === "template-prompt-002")!;
      const promptRepo : IPromptRepository= new PromptInMemoryRepository([prompt]);

      it('should generate appropriate welcome message for Monaco', async () => {
         const prompt = promptRepo.getPrompt('template-prompt-002');
         expect(prompt).toBeDefined();
         
         const systemPrompt = promptRepo.expandSystemPrompt(prompt!, {});
         const userPrompt = promptRepo.expandUserPrompt(prompt!, { LOCATION: 'Monaco' });
         
         const response = await chatDriver.getModelResponse(systemPrompt, userPrompt, EVerbosity.kMedium);
         
         // The response should contain 'Monaco' but not duplicate these words
         expect(response).toContain('Monaco');
         expect(response.toLowerCase()).toMatch(/welcome|greetings/);
         expect(response.split('Monaco').length).toBe(2); // Only one occurrence
         
      }).timeout(TEST_TIMEOUT_MS);

      it('should generate same welcome pattern for Monaco Monaco', async () => {
         const prompt = promptRepo.getPrompt('template-prompt-002');
         expect(prompt).toBeDefined();
         
         const systemPrompt = promptRepo.expandSystemPrompt(prompt!, {});
         const userPrompt = promptRepo.expandUserPrompt(prompt!, { LOCATION: 'Monaco Monaco' });
         
         const response = await chatDriver.getModelResponse(systemPrompt, userPrompt, EVerbosity.kMedium);
         
         // Should follow same pattern as Monaco test since Monte Carlo is the same location
         expect(response).toContain('Monaco');
         expect(response.toLowerCase()).toMatch(/welcome|greetings/);
         expect(response.split('Monaco').length).toBe(2); // Only one occurrence
         
      }).timeout(TEST_TIMEOUT_MS);

      it('should generate same welcome pattern for Monaco Grand Prix', async () => {
         const prompt = promptRepo.getPrompt('template-prompt-002');
         expect(prompt).toBeDefined();
         
         const systemPrompt = promptRepo.expandSystemPrompt(prompt!, {});
         const userPrompt = promptRepo.expandUserPrompt(prompt!, { LOCATION: 'Monaco Grand Prix' });
         
         const response = await chatDriver.getModelResponse(systemPrompt, userPrompt, EVerbosity.kMedium);
         
         // Should follow same pattern as Monaco test since Monte Carlo is the same location
         expect(response).toContain('Monaco');
         expect(response.toLowerCase()).toMatch(/welcome|greetings/);
         expect(response.split('Grand Prix').length).toBe(2); // Only one occurrence
         
      }).timeout(TEST_TIMEOUT_MS);

      it('should generate different welcome message for Silverstone', async () => {
         const prompt = promptRepo.getPrompt('template-prompt-002');
         expect(prompt).toBeDefined();
         
         const systemPrompt = promptRepo.expandSystemPrompt(prompt!, {});
         const userPrompt = promptRepo.expandUserPrompt(prompt!, { LOCATION: 'Silverstone' });
         
         const response = await chatDriver.getModelResponse(systemPrompt, userPrompt, EVerbosity.kMedium);
         
         // Should contain Silverstone-specific content
         expect(response).toContain('Silverstone');
         expect(response.toLowerCase()).toMatch(/welcome|greetings|delighted/);
         expect(response.split('Silverstone').length).toBe(2); // Only one occurrence
         // Verify it's different from Monaco/Monte Carlo responses
         expect(response).not.toContain('Monaco');
         expect(response).not.toContain('Monte Carlo');

      }).timeout(TEST_TIMEOUT_MS);
   });
});
