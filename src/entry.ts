/**
 * @module entry
 * 
 * Core interfaces and types for the PromptRepository system.
 * Defines the structure of prompts, parameters, and repository interfaces
 * used throughout the application for managing and retrieving LLM prompts.
 */

export { PromptFileRepository, PromptInMemoryRepository } from "./PromptRepository";
export { ChatDriverFactory } from "./Chat";
export { throwIfUndefined, throwIfNull, throwIfFalse, InvalidParameterError, InvalidOperationError } from "./Asserts";

/**
 * Enum representing parameter types as strings
 */
export const ParameterTypeNumber = "kNumber";
export const ParameterTypeString = "kString";
export const ParameterTypeEnum = "kEnum";
export type EParameterType = "kNumber" | "kString" | "kEnum";

/**
 * Interface representing a parameter used in prompt templates
 * 
 * @interface IPromptParameter
 * @property {string} name - The name of the parameter used in placeholder substitution
 * @property {string} description - A description of what the parameter represents
 * @property {EType} type - The type of the parameter
 * @property {boolean} required - Whether this parameter must be provided
 * @property {string} defaultValue - The default value to use if parameter is not provided
 * @property {string[]} allowedValues - Array of allowed values for this parameter if type is enum
 */
export interface IPromptParameterSpec {
   name: string,
   description: string,
   type: EParameterType,
   required: boolean,
   defaultValue?: string | undefined,
   allowedValues?: string[] | undefined
} 

/**
 * Interface representing a prompt template
 * 
 * @interface IPrompt
 * @property {string} id - The unique identifier of the prompt
 * @property {string} version - The version of the prompt
 * @property {string} schemaVersion - The version of the prompt schema
 * @property {string} name - The name of the prompt
 * @property {string} [description] - The description of the prompt
 * @property {string} systemPrompt - The system prompt template
 * @property {IPromptParameterSpec[]} [systemPromptParameters] - The parameters for the system prompt
 * @property {string} userPrompt - The user prompt template
 * @property {IPromptParameterSpec[]} [userPromptParameters] - The parameters for the user prompt
 */
export interface IPrompt {
   id: string,
   version: string,
   schemaVersion?: string   
   name: string,
   description?: string,
   systemPrompt?: string,
   systemPromptParameters?: IPromptParameterSpec[] | undefined,
   userPrompt: string,
   userPromptParameters?: IPromptParameterSpec[] | undefined,
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
    * @param params The parameters to expand the prompt with. Optional parameters may be undefined.
    * @returns The expanded prompt
    */
   expandSystemPrompt(prompt: IPrompt, params: { [key: string]: string | undefined }): string;

   /**
    * Expands a prompt with given parameters
    * @param prompt The prompt to expand
    * @param params The parameters to expand the prompt with. Optional parameters may be undefined.
    * @returns The expanded prompt
    */
   expandUserPrompt(prompt: IPrompt, params: { [key: string]: string | undefined }): string;   
}


/**
 * Enum representing model sizes
 */
export enum EModel {
   kLarge = "kLarge",
   kMini = "kMini"  
}

/**
 * Enum representing model providers
 */
export enum EModelProvider {
   kOpenAI = "kOpenAI"
}

/**
 * An enumeration of possible chat roles.
 * Used to identify the sender of a message in chat interactions.
 */
export enum EChatRole {
   kUser = 'user',
   kAssistant = 'assistant'
}

export interface IQueryReturnable {
   id: string | undefined;  // The id of the object. Can be undefined if the object has not yet ben saved to DB
   className: string;       // The class name of the object.   
}

/**
 * A message in a chat interaction.
 */
export interface IChatMessage extends IQueryReturnable {
   role: EChatRole;
   content: string;
   timestamp: Date;
}

export const ChatMessageClassName = "IChatMessage";

/**
 * A request to the chat API.
 */
export interface IChatMessageRequest {
   sessionId: string;
   limit: number;
   continuation?: string | undefined;
}

/**
 * A response from the chat API.
 */
export interface IChatMessageResponse {
   records: IChatMessage[];
   continuation?: string | undefined;
}


/**
 * Interface for a simple chat response
 */
export interface IChatDriver {

   /**
    * Retrieves a chat response from the model
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model
    * @param messageHistory Optional array of previous chat messages
    * @returns The response from the model
    */
   getModelResponse(systemPrompt: string | undefined, userPrompt: string, messageHistory?: IChatMessage[]): Promise<string>;

   /**
    * Retrieves a streamed chat response from the model
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model
    * @param messageHistory Optional array of previous chat messages
    * @returns The response from the model
    */
   getStreamedModelResponse(systemPrompt: string | undefined, userPrompt: string, messageHistory?: IChatMessage[]): AsyncIterator<string>;


   /**
    * Retrieves a chat response from the model with JSON schema validation
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model 
    * @param jsonSchema The JSON schema to constrain the model output
    * @param defaultValue The default value to return if the model output does not match the schema
    * @param messageHistory Optional array of previous chat messages
    * @returns The response from the model as a validated JSON object
    */
   getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[]
   ): Promise<T>;
}

/**
 * Interface for a simple factory class for creating chat drivers
 */
export interface IChatDriverFactory {

   create(model: EModel, provider: EModelProvider): IChatDriver;
}