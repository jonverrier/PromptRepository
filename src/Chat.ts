/**
 * Provides functionality for interacting with OpenAI's chat completion API.
 * 
 * @module Chat
 */

// Copyright (c) 2025 Jon Verrier

import OpenAI from 'openai';

/**
 * Retrieves a chat completion from the OpenAI API
 * @param systemPrompt The system prompt to send to the OpenAI API
 * @param userPrompt The user prompt to send to the OpenAI API
 * @returns The response from the OpenAI API
 */

export async function getModelResponse(systemPrompt: string, userPrompt: string): Promise<string> {

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const response = await openai.responses.create({
      'instructions' : systemPrompt,
      'input' : userPrompt,
      'model' : 'gpt-4o', 
      'temperature' : 0.25
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