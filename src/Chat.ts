/**
 * @module Chat
 * 
 * Base functionality for interacting with OpenAI's chat completion API.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { EChatRole } from './entry';
import { IChatDriver, EModel, IChatMessage } from './entry';

interface AsyncResponse {
    [Symbol.asyncIterator](): AsyncIterator<any>;
}

/**
 * Abstract base class for OpenAI model drivers.
 * Provides common functionality for interacting with OpenAI's API
 * including authentication and error handling.
 * 
 * @implements {IChatDriver}
 * @abstract
 * 
 * @property {string} model - The OpenAI model identifier to use
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export abstract class OpenAIModelChatDriver implements IChatDriver {
   protected openai!: OpenAI;

   constructor(protected modelType: EModel) {}

   protected abstract createCompletionConfig(systemPrompt: string | undefined, messages: IChatMessage[]): any;

   async getModelResponse(systemPrompt: string | undefined, userPrompt: string, messageHistory?: IChatMessage[]): Promise<string> {
      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      try {
         const config = this.createCompletionConfig(systemPrompt, messages);
         const response = await this.openai.responses.create(config);

         if (!response.output_text) {
            throw new Error('No response content received from OpenAI');
         }

         return response.output_text;
      } catch (error) {
         if (error instanceof Error) {
            throw new Error(`OpenAI API error: ${error.message}`);
         }
         throw new Error('Unknown error occurred while calling OpenAI API');
      }
   }

   getStreamedModelResponse(systemPrompt: string | undefined, userPrompt: string, messageHistory?: IChatMessage[]): AsyncIterator<string> {
      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      const config = this.createCompletionConfig(systemPrompt, messages);
      config.stream = true;

      let streamPromise = this.openai.responses.create(config);
      let streamIterator: AsyncIterator<any> | null = null;

      return {
         async next(): Promise<IteratorResult<string>> {
            try {
               if (!streamIterator) {
                  const stream = await streamPromise;
                  if (Symbol.asyncIterator in stream) {
                     streamIterator = (stream as unknown as AsyncResponse)[Symbol.asyncIterator]();
                  } else {
                     throw new Error('Stream does not support async iteration');
                  }
               }

               if (streamIterator) {
                  let looking = true;
                  while (looking) {
                     const chunk = await streamIterator.next();
                     if (chunk.done) {
                        streamIterator = null;
                        return { value: '', done: true };
                     }

                     if ('delta' in chunk.value && typeof chunk.value.delta === 'string') {
                        looking = false;
                        return { value: chunk.value.delta, done: false };
                     }
                  }
               }

               return { value: '', done: true };
            } catch (error) {
               streamIterator = null;
               if (error instanceof Error) {
                  throw new Error(`Stream error: ${error.message}`);
               }
               throw error;
            }
         },
         return(): Promise<IteratorResult<string>> {
            streamIterator = null;
            return Promise.resolve({ value: '', done: true });
         },
         throw(error: any): Promise<IteratorResult<string>> {
            streamIterator = null;
            return Promise.reject(error);
         }
      };
   }

   async getConstrainedModelResponse<T>(
      systemPrompt: string | undefined,
      userPrompt: string,
      jsonSchema: Record<string, unknown>,
      defaultValue: T,
      messageHistory?: IChatMessage[]
   ): Promise<T> {
      const messages: IChatMessage[] = [
         ...(messageHistory || []),
         {
            role: EChatRole.kUser,
            content: userPrompt,
            timestamp: new Date(),
            id: `user-${Date.now()}`,
            className: 'user-message'
         }
      ];

      const config = this.createCompletionConfig(systemPrompt, messages);
      config.text = { format: { type: "json_schema", strict: true, name: "constrainedOutput", schema: jsonSchema } };

      const response = await this.openai.responses.parse(config);
      return (response.output_parsed as T) ?? defaultValue;
   }
}
