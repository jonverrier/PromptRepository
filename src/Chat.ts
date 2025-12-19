/**
 * @module Chat
 * 
 * Generic base functionality for interacting with any LLM provider.
 * This class provides the common interface and utilities that all
 * chat drivers should implement, regardless of the underlying provider.
 */
// Copyright (c) 2025 Jon Verrier

import { EChatRole, EVerbosity } from './entry';
import { IChatDriver, EModel, IChatMessage, IFunction } from './entry';

/**
 * Abstract base class for all chat drivers.
 * Provides common functionality that any LLM provider can inherit from,
 * including message handling and basic utilities.
 * 
 * @implements {IChatDriver}
 * @abstract
 * 
 * This class is provider-agnostic and contains no OpenAI-specific code.
 * Provider-specific implementations should inherit from this class.
 */
export abstract class ChatDriver implements IChatDriver {
   constructor(protected modelType: EModel) {}

   /**
    * Returns the provider name for error messages
    * Subclasses must override to return their specific provider name
    */
   protected abstract getProviderName(): string;

   /**
    * Returns the model name/identifier used by this driver
    * Subclasses must override to return their specific model name
    */
   protected abstract getModelName(): string;

   /**
    * Creates a user message with the given prompt
    */
   protected createUserMessage(userPrompt: string): IChatMessage {
      return {
         role: EChatRole.kUser,
         content: userPrompt,
         timestamp: new Date(),
         id: `user-${Date.now()}`,
         className: 'user-message'
      };
   }

   /**
    * Builds the complete message array including history and new user message
    */
   protected buildMessageArray(messageHistory: IChatMessage[] | undefined, userPrompt: string): IChatMessage[] {
      return [
         ...(messageHistory || []),
         this.createUserMessage(userPrompt)
      ];
   }

   // Abstract methods that must be implemented by provider-specific subclasses
   abstract getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string>;

   abstract getStreamedModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string>;

   abstract getModelResponseWithForcedTools(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<string>;

   abstract getStreamedModelResponseWithForcedTools(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): AsyncIterator<string>;

   abstract getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[],
      functions?: IFunction[]
   ): Promise<T>;
}