/**
 * @module promptrepository.test
 * 
 * Unit tests for the PromptRepository module which handles storage and retrieval
 * of AI conversation prompts. Tests verify:
 * - Loading prompts from JSON file storage
 * - Retrieving individual prompts by ID
 * - Proper handling of prompt metadata (version, persona, templates)
 * 
 * Uses temporary test files to validate repository functionality in isolation.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it, before } from 'mocha';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PromptFileRepository, replacePromptPlaceholders } from '../src/PromptRepository';
import { IPrompt, IPromptParameterSpec, ParameterTypeNumber, ParameterTypeString } from '../src/entry';
import { throwIfUndefined } from '../src/Asserts';

let requiredNameParam : IPromptParameterSpec = {
   name: "name",
   description: "A person's name",
   type: ParameterTypeString,
   required: true,
   defaultValue: undefined
}

let optionalNameParam : IPromptParameterSpec = {
   name: "name",
   description: "A person's name",
   type: ParameterTypeString,
   required: false,
   defaultValue: "Name"
}

let optionalAgeParam : IPromptParameterSpec = {
   name: "age",
   description: "A person's age",
   type: ParameterTypeNumber,
   required: false,
   defaultValue: "20"
}

describe('PromptRepository', function () {
   
   let tempDir: string;
   let samplePromptsFile: string;

   before(async function () {
      // Create temporary directory and file
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-prompts-'));
      samplePromptsFile = path.join(tempDir, 'test_prompts.json');

      // Create test data
      const prompts = [{
         "id": "test-prompt-1",
         "version": "1.0",
         "schemaVersion": "1.0",
         "personaName": "TestBot",
         "systemPrompt": "You are a test bot",
         "userPrompt": "Hello {name}"
      }];

      // Write test data to file
      fs.writeFileSync(samplePromptsFile, JSON.stringify(prompts));
   });

   it('should load a single prompt', async function () {
      // Initialize repository with test file
      const repo = new PromptFileRepository(samplePromptsFile);

      // Test loading a specific prompt
      const prompt = repo.getPrompt("test-prompt-1");

      // Verify the prompt data
      expect(prompt).toBeDefined();
      expect(prompt?.id).toEqual("test-prompt-1");
      expect(prompt?.version).toEqual("1.0");
      expect(prompt?.systemPrompt).toEqual("You are a test bot");
      expect(prompt?.userPrompt).toEqual("Hello {name}");
   });

   it('should correctly load schema version from prompt', async function () {

      // Test loading the prompt
      const repo = new PromptFileRepository(samplePromptsFile);      
      const prompt = repo.getPrompt("test-prompt-1");

      // Verify schema version
      expect(prompt).toBeDefined();
      expect(prompt?.schemaVersion).toEqual("1.0");
   });

   it('should correctly replace required parameters for a prompt', async function () {
      // Initialize repository with test file
      const repo = new PromptFileRepository(samplePromptsFile);

      // Test loading a specific prompt
      const prompt: IPrompt | undefined = await repo.getPrompt("test-prompt-1");

      // Verify the prompt data
      expect(prompt).toBeDefined();
      expect(prompt?.id).toEqual("test-prompt-1");
      expect(prompt?.version).toEqual("1.0");
      expect(prompt?.systemPrompt).toEqual("You are a test bot");
      expect(prompt?.userPrompt).toEqual("Hello {name}");

      throwIfUndefined(prompt);
      let result = replacePromptPlaceholders(prompt.userPrompt, [requiredNameParam], { name: "Jon" });
      expect(result).toEqual("Hello Jon");
   });

   it('should correctly replace optional parameters for a prompt', async function () {
      // Initialize repository with test file
      const repo = new PromptFileRepository(samplePromptsFile);

      // Test loading a specific prompt
      const prompt: IPrompt | undefined = repo.getPrompt("test-prompt-1");

      // Verify the prompt data
      expect(prompt).toBeDefined();
      expect(prompt?.id).toEqual("test-prompt-1");
      expect(prompt?.version).toEqual("1.0");
      expect(prompt?.systemPrompt).toEqual("You are a test bot");
      expect(prompt?.userPrompt).toEqual("Hello {name}");

      throwIfUndefined(prompt);
      let result = replacePromptPlaceholders(prompt.userPrompt, [optionalNameParam], {});
      expect(result).toEqual("Hello Name");
   });

   it('should correctly replace optional numeric parameters for a prompt', async function () {
      // Initialize repository with test file
      const repo = new PromptFileRepository(samplePromptsFile);

      // Test loading a specific prompt
      let prompt: IPrompt | undefined = repo.getPrompt("test-prompt-1");

      // Verify the prompt data
      expect(prompt).toBeDefined();
      throwIfUndefined(prompt);      
      prompt.userPrompt = "Hello {age}";      
      expect(prompt?.id).toEqual("test-prompt-1");
      expect(prompt?.version).toEqual("1.0");
      expect(prompt?.systemPrompt).toEqual("You are a test bot");

      let result = replacePromptPlaceholders(prompt.userPrompt, [optionalAgeParam], { age: "30" });
      expect(result).toEqual("Hello 30");
   });

   it('should throw an exception if there is a missing required parameter for a prompt', async function () {
      // Initialize repository with test file
      const repo = new PromptFileRepository(samplePromptsFile);

      // Test loading a specific prompt
      const prompt: IPrompt | undefined = await repo.getPrompt("test-prompt-1");

      // Verify the prompt data
      expect(prompt).toBeDefined();
      expect(prompt?.id).toEqual("test-prompt-1");
      expect(prompt?.version).toEqual("1.0");
      expect(prompt?.systemPrompt).toEqual("You are a test bot");
      expect(prompt?.userPrompt).toEqual("Hello {name}");

      throwIfUndefined(prompt);
      expect(() => replacePromptPlaceholders(prompt.userPrompt, [requiredNameParam], {})).toThrow();
   });

   it('should correctly load target prompts with replacement parameters', async function () {
      const fileName = "template-prompt.json";
      const filePath = path.join(__dirname, fileName);

      // Initialize repository with test file
      const repo = new PromptFileRepository(filePath);

      const promptId1 = "template-prompt-001";

      // Test loading a specific prompt
      const prompt: IPrompt | undefined = await repo.getPrompt(promptId1);
      expect(prompt).toBeDefined();
      throwIfUndefined(prompt);

      let result = repo.expandSystemPrompt(prompt, { ROLE_DESCRIPTION: "Teaches French", TASK_DESCRIPTION: "Teach the user how to say 'Hello' in French" });
      expect(result).toContain("Teaches French");
      expect(result).toContain("Teach the user how to say 'Hello' in French");

      let result2 = repo.expandUserPrompt(prompt, { USER_REQUEST: "How do I say 'Hello' in French?", CONTEXT: "The user is a beginner to French" });
      expect(result2).toContain("How do I say 'Hello' in French?");
      expect(result2).toContain("The user is a beginner to French");
   });
});