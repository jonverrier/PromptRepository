/**
 * @module Embed
 * 
 * Base functionality for interacting with OpenAI's embedding API.
 * Provides abstract base class and common utilities for embedding services.
 */
// Copyright (c) 2025 Jon Verrier

import OpenAI, { AzureOpenAI } from 'openai';
import { EModel, EModelProvider, IEmbeddingModelDriver, InvalidParameterError } from './entry';
import { retryWithExponentialBackoff } from './DriverHelpers';

/**
 * Calculates the cosine similarity between two embedding vectors.
 * Cosine similarity measures the cosine of the angle between two vectors,
 * providing a value between -1 and 1 where 1 indicates identical vectors.
 * 
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity value between -1 and 1
 * @throws Error if vectors have different lengths
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
   if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding vectors must have the same length');
   }

   if (embedding1.length === 0) {
      throw new InvalidParameterError('Embedding vectors cannot be empty');
   }

   // Calculate dot product
   const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
   
   // Calculate magnitudes
   const magnitude1 = Math.sqrt(embedding1.reduce((sum, val) => sum + val * val, 0));
   const magnitude2 = Math.sqrt(embedding2.reduce((sum, val) => sum + val * val, 0));
   
   // Handle zero magnitude vectors
   if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
   }
   
   // Calculate cosine similarity
   return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Abstract base class for OpenAI embedding model drivers.
 * Provides common functionality for interacting with OpenAI's embedding API
 * including authentication and error handling.
 * 
 * @implements {IEmbeddingModelDriver}
 * @abstract
 * 
 * @property {string} deploymentName - The deployment/model name to use
 * @property {EModel} drivenModelType - The model type (large or mini)
 * @property {EModelProvider} drivenModelProvider - The provider type
 * @property {OpenAI} openai - Instance of OpenAI API client
 */
export abstract class OpenAIModelEmbeddingDriver implements IEmbeddingModelDriver {
   public abstract deploymentName: string;
   public drivenModelType: EModel;
   public drivenModelProvider: EModelProvider;
   protected openai!: OpenAI | AzureOpenAI;

   constructor(modelType: EModel, provider: EModelProvider) {
      this.drivenModelType = modelType;
      this.drivenModelProvider = provider;
   }

   protected abstract getModelName(): string;

   /**
    * Converts text into a vector embedding representation.
    * 
    * @param {string} text - The input text to be embedded
    * @returns {Promise<Array<number>>} A promise that resolves to an array of numbers 
    *         representing the text embedding vector
    */
   async embed(text: string): Promise<Array<number>> {
      try {
         const response = await retryWithExponentialBackoff(() => 
            this.openai.embeddings.create({
               input: text,
               model: this.getModelName()
            })
         );

         if (!response.data || response.data.length === 0) {
            throw new Error('No embedding data received from OpenAI');
         }

         return response.data[0].embedding;
      } catch (error) {
         if (error instanceof Error) {
            throw new Error(`OpenAI embedding API error: ${error.message}`);
         }
         throw new Error('Unknown error occurred while calling OpenAI embedding API');
      }
   }
}