/**
 * Provides functionality for interacting with OpenAI's chat completion API.
 * 
 * @module Chat
 */

// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';
import { IChatDriver, IChatDriverFactory, EModelProvider, EModel } from './entry';

/**
 * Interface for a simple factory class for creating chat drivers
 */
export class ChatDriverFactory implements    IChatDriverFactory {

   create(model: EModel, provider: EModelProvider): IChatDriver {
      return new OpenAIChatDriver(model);
   }
}

class OpenAIChatDriver implements IChatDriver {

   private model = 'gpt-4o';

   constructor(model: EModel) {
      if (model === EModel.kLarge) {
         this.model = 'gpt-4.1';
      } else 
      if (model === EModel.kMini) {
         this.model = 'gpt-4.1-mini';
      }
   }

   getModelResponse(systemPrompt: string | undefined, userPrompt: string): Promise<string> {
      return getModelResponse(this.model,systemPrompt, userPrompt);   
   }

   getStreamedModelResponse(systemPrompt: string | undefined, userPrompt: string): AsyncIterator<string> {
      return getStreamedModelResponse(this.model,systemPrompt, userPrompt);   
   }
}

/**
 * Retrieves a chat completion from the OpenAI API
 * @param model The model to use for the chat completion
 * @param systemPrompt The system prompt to send to the OpenAI API
 * @param userPrompt The user prompt to send to the OpenAI API
 * @returns The response from the OpenAI API
 */

async function getModelResponse(model: string, systemPrompt: string | undefined, userPrompt: string): Promise<string> {

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.responses.create({
      ...(systemPrompt && { 'instructions': systemPrompt }),
      'input': userPrompt,
      'model': model,
      'temperature': 0.25
    });

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

function getStreamedModelResponse(model: string, systemPrompt: string | undefined, userPrompt: string): AsyncIterator<string> {
   const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
   });

   let streamPromise = openai.responses.create({
      ...(systemPrompt && { 'instructions': systemPrompt }),
      'input': userPrompt,
      'model': model,
      'temperature': 0.25,
      'stream': true
   });

   let streamIterator: AsyncIterator<any> | null = null;

   return {
      async next(): Promise<IteratorResult<string>> {
         try {
            if (!streamIterator) {
               const stream = await streamPromise;
               streamIterator = stream[Symbol.asyncIterator]();
            }
            
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
         
            // fali-safe terminate if we kept looking and never got a value
            return { value:'', done: true };
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

