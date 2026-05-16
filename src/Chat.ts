/**
 * @module Chat
 * 
 * Generic base functionality for interacting with any LLM provider.
 * This class provides the common interface and utilities that all
 * chat drivers should implement, regardless of the underlying provider.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// ===Start StrongAI Generated Comment (20260516)===
// Provider-agnostic base infrastructure for chat-based LLM integrations. This module defines ChatDriver, an abstract class that implements IChatDriver and standardizes how concrete provider drivers request model output. ChatDriver is constructed with a model type (EModel) and requires subclasses to identify themselves via getProviderName and getModelName. It also provides shared message utilities: createUserMessage builds a user IChatMessage with role, content, timestamp, id, and a CSS-friendly className, and buildMessageArray appends a new user message to optional prior history.
// 
// Concrete drivers must implement the core request methods: getModelResponse for full text responses, getStreamedModelResponse for token streaming via AsyncIterator<string>, and corresponding “WithForcedTools” variants that require tool/function usage. getConstrainedModelResponse returns a typed value validated against a caller-supplied JSON schema and default value.
// 
// Key dependencies imported from ./entry include EChatRole and EVerbosity, plus the shared types IChatDriver, IChatMessage, IFunction, and EModel.
// ===End StrongAI Generated Comment===


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