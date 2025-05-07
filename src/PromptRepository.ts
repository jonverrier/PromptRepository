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
 * - PromptFileRepository implementation using JSON file-based storage
 * - PromptInMemoryRepository implementation using in-memory storage i.e. prompts are definined in a typescript array
 * - Helper function for prompt template placeholder replacement
 */

// Copyright (c) 2025 Jon Verrier

import type * as fs from 'node:fs';

import { IPromptParameterSpec, IPrompt, IPromptRepository, throwIfUndefined, InvalidOperationError } from "./entry";

// Use this to enable future upgrades on the fly. 
// If the prompt author was using an old version, we may be able to patch. 
const currentSchemaVersion = "0.1";

let fsImpl: typeof fs | undefined;
try {
  // Only import fs in Node.js environment
  if (typeof process !== 'undefined' && process.versions?.node) {
    // Use require instead of await import since we're at module level
    fsImpl = require('node:fs');
  }
} catch (error) {
  // In browser environments, fs will remain undefined
}

/**
 * Validates that a parameter value matches its specified type
 * @param paramName The name of the parameter to validate
 * @param paramValue The value of the parameter to validate
 * @param paramSpec Array of parameter specifications to check against
 * @throws {TypeError} If the parameter value does not match its specified type
 */

function validateParameterType(paramName: string,
   paramValue: string | undefined,
   paramSpec: IPromptParameterSpec[]): void {
   const foundParam = paramSpec.find(p => p.name === paramName);
   if (foundParam) {
      if (foundParam.type === "kString") {
         if (typeof paramValue !== "string") {
            throw new TypeError(`Parameter ${paramName} must be a string`);
         }
      } else if (foundParam.type === "kNumber") {
         if (isNaN(Number(paramValue))) {
            throw new TypeError(`Parameter ${paramName} must be a number`);
         }
      } else if (foundParam.type === "kEnum") {
         if (foundParam.allowedValues && paramValue) {
            if (!foundParam.allowedValues.includes(paramValue)) {
               throw new TypeError(`Parameter ${paramName} must be one of: ${foundParam.allowedValues.join(", ")}`);
            }
         }
      }
   }
}

/**
 * Replaces placeholders in a prompt template with actual values
 * @param template The prompt template containing placeholders e.g. "Hello {name}"
 * @param paramSpec The parameter specification for the prompt
 * @param params An object containing key-value pairs for placeholder replacements e.g. { name: "Jon" }, may be undefined for optional parameters
 * @returns The prompt with placeholders replaced by actual values e.g. "Hello Jon"
 */
export function replacePromptPlaceholders(template: string,
   paramSpec: IPromptParameterSpec[] | undefined,
   params: { [key: string]: string | undefined }): string {

   if (paramSpec === undefined) {
      return template;
   }

   for (const param of paramSpec) {
      // Check that all required parameters are provided      
      if (param.required) {
         if (!params.hasOwnProperty(param.name) || params[param.name] === undefined) {
            throw new TypeError(`Missing required parameter: ${param.name}`);
         }
         else {
            validateParameterType(param.name, params[param.name], paramSpec);
         }
      }
      else {
         // Use default value if parameter is optional, not provided, and has default     
         if (!params.hasOwnProperty(param.name) || params[param.name] === undefined) {
            const foundParam = paramSpec.find(p => p.name === param.name);
            if (foundParam) {
               params[param.name] = foundParam.defaultValue ?? "";
            }
         } else {
            validateParameterType(param.name, params[param.name], paramSpec);
         }
      }
   }
   return template.replace(/\{(.*?)}/g, (_, key) => params[key]?.toString() ?? "");
}

/**
 * Implementation of IPromptRepository that uses a JSON file to store prompts
 */
export class PromptFileRepository implements IPromptRepository {
   private prompts: IPrompt[] = [];

   constructor(readonly promptFilePath: string) {
      if (fsImpl === undefined) {
         throw new InvalidOperationError("PromptFileRepository is not supported in the browser");
      }
      this.prompts = JSON.parse(fsImpl.readFileSync(promptFilePath, 'utf8'));
   }

   getPrompt(id: string): IPrompt | undefined {
      return this.prompts.find(p => p.id === id);
   }

   expandSystemPrompt(prompt: IPrompt, systemParams: { [key: string]: string | undefined }): string {
      
      throwIfUndefined(prompt.systemPrompt);
      return replacePromptPlaceholders(prompt.systemPrompt, prompt.systemPromptParameters, systemParams);
   }

   expandUserPrompt(prompt: IPrompt, userParams: { [key: string]: string | undefined }): string {
      return replacePromptPlaceholders(prompt.userPrompt, prompt.userPromptParameters, userParams);
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

   expandSystemPrompt(prompt: IPrompt, params: { [key: string]: string | undefined }): string {
      throwIfUndefined(prompt.systemPrompt);      
      return replacePromptPlaceholders(prompt.systemPrompt, prompt.systemPromptParameters, params);
   }

   expandUserPrompt(prompt: IPrompt, params: { [key: string]: string | undefined }): string {
      return replacePromptPlaceholders(prompt.userPrompt, prompt.userPromptParameters, params);
   }
}