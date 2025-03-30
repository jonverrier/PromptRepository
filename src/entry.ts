/**
 * @module entry
 * 
 * Core interfaces and types for the PromptRepository system.
 * Defines the structure of prompts, parameters, and repository interfaces
 * used throughout the application for managing and retrieving LLM prompts.
 */

export { PromptFileRepository, PromptInMemoryRepository } from "./PromptRepository";
export { getModelResponse } from "./Chat";
export { throwIfUndefined, throwIfNull, throwIfFalse } from "./Asserts";

/**
 * Enum representing parameter types as strings
 */
export const ParamTypeNumber = "kNumber";
export const ParamTypeString = "kString";
export type EType = "kNumber" | "kString";

/**
 * Interface representing a parameter used in prompt templates
 * 
 * @interface IPromptParameter
 * @property {string} name - The name of the parameter used in placeholder substitution
 * @property {string} description - A description of what the parameter represents
 * @property {EType} type - The type of the parameter
 * @property {boolean} required - Whether this parameter must be provided
 * @property {string} defaultValue - The default value to use if parameter is not provided
 */
export interface IPromptParameterSpec {
   name: string,
   description: string,
   type: EType,
   required: boolean,
   defaultValue?: string | undefined
} 

/**
 * Interface representing a prompt template
 * 
 * @interface IPrompt
 * @property {string} name - The name of the prompt
 * @property {string} systemPrompt - The system prompt template
 * @property {IPromptParameter[]} systemPromptParameters - The parameters for the system prompt
 * @property {string} userPrompt - The user prompt template
 * @property {IPromptParameter[]} userPromptsParameters - The parameters for the user prompt
 */
export interface IPrompt {
   id: string,
   version: string,
   name: string,
   systemPrompt: string,
   systemPromptParameters?: IPromptParameterSpec[] | undefined,
   userPrompt: string,
   userPromptParameters?: IPromptParameterSpec[] | undefined
}

/**
 * Interface for a repository that manages prompt storage and retrieval
 */
export interface IPromptRepository {
   /**
    * Retrieves a stored prompt by its unique identifier
    * @param id The unique identifier of the prompt
    * @returns The stored prompt if found
    */
   getPrompt(id: string): IPrompt | undefined;

   /**
    * Expands a prompt with given parameters
    * @param prompt The prompt to expand
    * @param params The parameters to expand the prompt with
    * @returns The expanded prompt
    */
   expandSystemPrompt(prompt: IPrompt, params: { [key: string]: string }): string;

   /**
    * Expands a prompt with given parameters
    * @param prompt The prompt to expand
    * @param params The parameters to expand the prompt with
    * @returns The expanded prompt
    */
   expandUserPrompt(prompt: IPrompt, params: { [key: string]: string }): string;   
}



