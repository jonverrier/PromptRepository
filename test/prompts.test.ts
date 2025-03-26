/**
 * Test module for prompt validation and verification.
 * Contains utilities for validating prompt structures and their parameters.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { IPrompt, IPromptParameterSpec } from '../src/entry';
import prompts from '../src/Prompts.json';

export class PromptValidationError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'PromptValidationError';
   }
}

export class PromptValidator {

   static validatePrompt(prompt: Partial<IPrompt>): void {
      // Check required top-level fields
      const requiredFields = ['id', 'version', 'name', 'systemPrompt', 'userPrompt'];
      for (const field of requiredFields) {
         if (!prompt[field as keyof IPrompt]) {
            throw new PromptValidationError(`Missing required field: ${field}`);
         }
      }

      // Validate parameters
      if (!Array.isArray(prompt.userPromptsParameters)) {
         throw new PromptValidationError('userPromptsParameters must be an array');
      }

      // Check parameter structure
      if (prompt.userPromptsParameters) {
         for (const param of prompt.userPromptsParameters) {
            this.validateParameter(param);
         }
      }
      if (prompt.systemPromptParameters) {
         for (const param of prompt.systemPromptParameters) {
            this.validateParameter(param);
         }
      }

      // Ensure at least one required parameter exists
      const hasRequiredParam = prompt.userPromptsParameters.some(param => param.required);
      if (!hasRequiredParam) {
         throw new PromptValidationError('Prompt must have at least one required parameter');
      }
   }

   private static validateParameter(param: Partial<IPromptParameterSpec>): void {
      // Check required parameter fields
      const requiredFields = ['name', 'description', 'required'];
      for (const field of requiredFields) {
         if (param[field as keyof IPromptParameterSpec] === undefined) {
            throw new PromptValidationError(`Missing required field in parameter: ${field}`);
         }
      }

      // Validate defaultValue presence for optional parameters
      if (param.required === false && !param.defaultValue) {
         throw new PromptValidationError(
            `Optional parameter "${param.name}" must have a default value`
         );
      }
   }
}

describe('PromptValidator', () => {
   // Test data
   const validUnitTestPrompt: IPrompt = prompts.find(p => p.id === "f6596917-628b-4901-b41d-a2fbfaca63e2")!;

   describe('Basic Structure Validation', () => {
      it('should validate a correct prompt structure', () => {
         expect(() => PromptValidator.validatePrompt(validUnitTestPrompt)).not.toThrow();
      });

      it('should fail when missing id', () => {
         const invalidPrompt = { ...validUnitTestPrompt, id: undefined };
         expect(() => PromptValidator.validatePrompt(invalidPrompt))
            .toThrow(PromptValidationError);
      });

      it('should fail when missing version', () => {
         const invalidPrompt = { ...validUnitTestPrompt, version: undefined };
         expect(() => PromptValidator.validatePrompt(invalidPrompt))
            .toThrow(PromptValidationError);
      });

      it('should fail when userPromptsParameters is not an array', () => {
         const invalidPrompt = {
            ...validUnitTestPrompt,
            userPromptsParameters: 'not an array' as any
         };
         expect(() => PromptValidator.validatePrompt(invalidPrompt))
            .toThrow(PromptValidationError);
      });
   });

   describe('Parameter Validation', () => {
      it('should validate parameter structure when missing description', () => {
         const invalidParam = {
            ...validUnitTestPrompt,
            userPromptsParameters: [{
               name: "test",
               // missing description
               required: true
            }]
         };
         expect(() => PromptValidator.validatePrompt(invalidParam as unknown as Partial<IPrompt>))
            .toThrow(PromptValidationError);
      });

      it('should validate parameter structure when missing \'required\'', () => {
         const invalidParam = {
            ...validUnitTestPrompt,
            userPromptsParameters: [{
               name: "test",
               // missing required
               description: "test param"
            }]
         };
         expect(() => PromptValidator.validatePrompt(invalidParam as unknown as Partial<IPrompt>))
            .toThrow(PromptValidationError);
      });

      it('should require default values for optional parameters', () => {
         const missingDefault = {
            ...validUnitTestPrompt,
            userPromptsParameters: [{
               name: "test",
               description: "test param",
               required: false
            }]
         };
         expect(() => PromptValidator.validatePrompt(missingDefault))
            .toThrow(PromptValidationError);
      });

      it('should require all required parameters', () => {
         const noRequiredParams = {
            ...validUnitTestPrompt,
            userPromptsParameters: [
               {
                  name: "language",
                  description: "The language in which to generate tests.",
                  required: false,
                  defaultValue: "typescript"
               }
            ]
         };
         expect(() => PromptValidator.validatePrompt(noRequiredParams))
            .toThrow(PromptValidationError);
      });
   });
});


