/**
 * @module IPromptRepository
 * 
 * This module provides interfaces and implementations for managing AI prompt storage
 * and retrieval. It includes functionality for:
 * - Storing prompts with metadata (id, version, parameter details)
 * - Retrieving stored prompts by unique identifier
 * - Replacing placeholder values in prompt templates
 * 
 * The module exports:
 * - IPromptRepository interface for prompt storage/retrieval
 * - PromptFileRepository implementation using JSON file-based storage
 * - PromptInMemoryRepository implementation using in-memory storage i.e. prompts are definined in a typescript array
 * - Helper function for prompt template placeholder replacement
 */

// Copyright (c) 2025 Jon Verrier

import fs from 'fs';

import { IPromptParameterSpec, IPrompt, IPromptRepository } from "./entry";

/**
 * Replaces placeholders in a prompt template with actual values
 * @param template The prompt template containing placeholders e.g. "Hello {name}"
 * @param paramSpec The parameter specification for the prompt
 * @param params An object containing key-value pairs for placeholder replacements e.g. { name: "Jon" } 
 * @returns The prompt with placeholders replaced by actual values e.g. "Hello Jon"
 */
export function replacePromptPlaceholders(template: string, 
   paramSpec: IPromptParameterSpec[] | undefined, 
   params: { [key: string]: string }): string {

   if (paramSpec === undefined) {
      return template;
   }

   for (const param of paramSpec) {
      // Check that all required parameters are provided      
      if (param.required) {
         if (!params.hasOwnProperty(param.name)) {
            if (param.required) {
               throw new TypeError(`Missing required parameter: ${param.name}`);
            }
         }
      }
      else {
         // Use default value if parameter is optional and has default         
         if (!params.hasOwnProperty(param.name)) {
            params[param.name] = param.defaultValue ?? "";
         }
      }
   }
   return template.replace(/\{(.*?)}/g, (_, key) => params[key].toString());
}

/**
 * Implementation of IPromptRepository that uses a JSON file to store prompts
 */
export class PromptFileRepository implements IPromptRepository {
   private prompts: IPrompt[] = [];

   constructor(readonly promptFilePath: string) {
      this.prompts = JSON.parse(fs.readFileSync(promptFilePath, 'utf8'));
   }

   getPrompt(id: string): IPrompt | undefined {
      return this.prompts.find(p => p.id === id);
   }

   expandSystemPrompt(prompt: IPrompt, systemParams: { [key: string]: string }): string {
      return replacePromptPlaceholders(prompt.systemPrompt, prompt.systemPromptParameters, systemParams);
   }

   expandUserPrompt(prompt: IPrompt, userParams: { [key: string]: string }): string {
      return replacePromptPlaceholders(prompt.userPrompt, prompt.userPromptsParameters, userParams);
   }
}

/**
 * Implementation of IPromptRepository that uses an in-memory array to store prompts
 */
export class PromptInMemoryRepository implements IPromptRepository {
   private prompts: IPrompt[] = [];

   constructor(prompts: IPrompt[]) {
      this.prompts = prompts;
   }

   getPrompt(id: string): IPrompt | undefined {
      return this.prompts.find(p => p.id === id);
   }

   expandSystemPrompt(prompt: IPrompt, params: { [key: string]: string }): string {
      return replacePromptPlaceholders(prompt.systemPrompt, prompt.systemPromptParameters, params);
   }

   expandUserPrompt(prompt: IPrompt, params: { [key: string]: string }): string {
      return replacePromptPlaceholders(prompt.userPrompt, prompt.userPromptsParameters, params);
   }
}