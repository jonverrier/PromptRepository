/**
 * @module entry
 * 
 * Core interfaces and types for the PromptRepository system.
 * Defines the structure of prompts, parameters, and repository interfaces
 * used throughout the application for managing and retrieving LLM prompts.
 */

import { IFunction } from './Function';

export { PromptFileRepository, PromptInMemoryRepository } from "./PromptRepository";
export { ChatDriverFactory } from "./ChatFactory";
export { EmbeddingDriverFactory } from "./EmbedFactory";
export { cosineSimilarity as CosineSimilarity } from "./Embed";
export { throwIfUndefined, throwIfNull, throwIfFalse, InvalidParameterError, InvalidOperationError } from "./Asserts";
export { formatChatMessageTimestamp, renderChatMessageAsText } from "./FormatChatMessage";
export { IFunction, IFunctionArgs, EDataType } from "./Function";
export { sanitizeInputString, sanitizeOutputString } from "./Sanitize";

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
   kOpenAI = "kOpenAI",
   kAzureOpenAI = "kAzureOpenAI"
}

/**
 * An enumeration of possible chat roles.
 * Used to identify the sender of a message in chat interactions.
 * Follows OpenAI's chat completion API guidelines.
 */
export enum EChatRole {
   kUser = 'user',
   kAssistant = 'assistant',
   kFunction = 'function',
   kTool = 'tool'
}

export interface IQueryReturnable {
   id: string | undefined;  // The id of the object. Can be undefined if the object has not yet ben saved to DB
   className: string;       // The class name of the object.   
}

/**
 * Interface for function call information in assistant messages.
 * Follows OpenAI's function calling format.
 */
export interface IFunctionCall {
   name: string;
   arguments: string; // JSON string of arguments
}

/**
 * A message in a chat interaction.
 * Supports OpenAI's function calling format with optional function_call and name properties.
 */   
export interface IChatMessage extends IQueryReturnable {
   role: EChatRole;
   content: string | undefined; // undefined for assistant messages with function_call
   timestamp: Date;
   name?: string; // Required for function/tool messages, optional for others
   function_call?: IFunctionCall; // Present in assistant messages when calling a function
   tool_call_id?: string; // For tool use pattern
}

export const ChatMessageClassName = "IChatMessage";

/**
 * A data structure for a user session core details.
 * Used to specify the user's session core details for a chat session
 * This is the minimum data required to identify a user session, exchnaged betwen the client and server
 */
export interface IUserSessionSummary {
   sessionId: string;
   email: string
};

/**
 * A request to the chat API.
 */
export interface IChatMessageRequest {
   sessionSummary: IUserSessionSummary;
   limit: number;
   createdAfter?: string;
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
 * Request parameters for archiving chat messages.
 * Used to specify which messages should be archived based on various criteria.
 */
export interface IArchiveMessageRequest {

   limit: number;            // Maximum number of records to archive
   sessionSummary: IUserSessionSummary; // Session identifier to scope the archive operation
   createdAfter: string;     // Only archive records created after this date
   createdBefore: string;    // Only archive records created before this date
   continuation: string | undefined;  // Token for paginating through results
}

/**
 * A response from the archive API.
 */
export interface IArchiveMessageResponse {

   updatedCount: number;              // Number of records updated
   continuation: string | undefined;  // Continuation token for pagination
}

/**
 * Interface for chat driver - has a number of concrete sub-classes, each of which implements the methods below
 */
export interface IChatDriver {

   /**
    * Retrieves a chat response from the model
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model
    * @param messageHistory Optional array of previous chat messages
    * @param functions Optional array of functions to pass to the model
    * @returns The response from the model
    */
   getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string>;

   /**
    * Retrieves a streamed chat response from the model
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model
    * @param messageHistory Optional array of previous chat messages
    * @param functions Optional array of functions to pass to the model
    * @returns The response from the model
    */
   getStreamedModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string>;


   /**
    * Retrieves a chat response from the model with JSON schema validation
    * @param systemPrompt The system prompt to send to the model
    * @param userPrompt The user prompt to send to the model 
    * @param jsonSchema The JSON schema to constrain the model output
    * @param defaultValue The default value to return if the model output does not match the schema
    * @param messageHistory Optional array of previous chat messages
    * @param functions Optional array of functions to pass to the model
    * @returns The response from the model as a validated JSON object
    */
   getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T>;
}

/**
 * Interface for a simple factory class for creating chat drivers
 */
export interface IChatDriverFactory {

   create(model: EModel, provider: EModelProvider): IChatDriver;
}

/**
 * Interface for drivers that provide text embedding capabilities.
 * Text embeddings are vector representations of text that capture semantic meaning,
 * allowing for operations like semantic search and similarity comparisons.
 * 
 * @interface IEmbeddingModelDriver
 */
export interface IEmbeddingModelDriver {

   deploymentName : string;
   drivenModelType: EModel;
   drivenModelProvider: EModelProvider;
   
   
    /**
     * Converts text into a vector embedding representation.
     * 
     * @param {string} text - The input text to be embedded
     * @returns {Promise<Array<number>>} A promise that resolves to an array of numbers 
     *         representing the text embedding vector
     */
    embed(text: string): Promise<Array<number>>;
}

/**
 * Interface for a simple factory class for creating embedding drivers
 */
export interface IEmbeddingDriverFactory {

   create(model: EModel, provider: EModelProvider): IEmbeddingModelDriver;
}

/**
 * Interface for a chunk of text and its embedding
 */
export interface IChunk {
   text: string;
   embedding: number[];
}

/**
 * Interface for a store of chunks of text and their embeddings
 */
export interface IChunkStore {
   checkCount: number;
   chunks: IChunk[];
}