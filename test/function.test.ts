/**
 * @module function.test
 * 
 * Unit tests for the Function module which handles function definitions for LLM interactions.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatDriverFactory, EModelProvider, EModel } from '../src/entry';
import { IFunction, EDataType, IFunctionArgs } from '../src/Function';

const TEST_TIMEOUT_MS = 30000; // 30 second timeout for all tests

// Create chat drivers 
const chatDriverFactory = new ChatDriverFactory();
const providers = [EModelProvider.kAzureOpenAI, EModelProvider.kOpenAI];
const chatDrivers = providers.map(provider => chatDriverFactory.create(EModel.kLarge, provider));

// Mock data for different race series
const mockRaceData: { [key: string]: { driver: string; points: number } } = {
   'Formula 1': { driver: 'Max Verstappen', points: 575 },
   'NASCAR': { driver: 'Kyle Larson', points: 4040 },
   'IndyCar': { driver: 'Alex Palou', points: 656 },
   'Formula E': { driver: 'Jake Dennis', points: 229 },
   'WEC': { driver: 'Toyota Gazoo Racing', points: 172 }
};

// Valid race series for strict validation
const validRaceSeries = ['Formula 1', 'NASCAR', 'IndyCar', 'Formula E', 'WEC'];

// Factory function to create motorsport function with configurable validation
const createMotorsportFunction = (validationLevel: 'basic' | 'strict' = 'basic'): IFunction => {
   const validateArgs = (args: IFunctionArgs): IFunctionArgs => {
      if (!args.raceSeries || typeof args.raceSeries !== 'string') {
         throw new Error('raceSeries is required and must be a string');
      }
      
      if (validationLevel === 'strict') {
         if (args.raceSeries.length < 5) {
            throw new Error('raceSeries must be at least 5 characters long');
         }
         if (!validRaceSeries.includes(args.raceSeries)) {
            throw new Error(`Invalid race series: ${args.raceSeries}. Must be one of: ${validRaceSeries.join(', ')}`);
         }
      }
      
      return args;
   };

   return {
      name: 'get_leading_driver',
      description: 'Get the current leading driver in a specific motorsport race series',
      inputSchema: {
         type: EDataType.kObject,
         properties: {
            raceSeries: {
               type: EDataType.kString,
               description: 'The name of the motorsport race series, e.g. Formula 1, NASCAR, IndyCar'
            }
         },
         required: ['raceSeries']
      },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            leadingDriver: {
               type: EDataType.kString,
               description: 'The name of the current leading driver in the championship'
            },
            raceSeries: {
               type: EDataType.kString,
               description: 'The race series that was queried'
            },
            points: {
               type: EDataType.kNumber,
               description: 'The current championship points of the leading driver'
            }
         },
         required: ['leadingDriver', 'raceSeries', 'points']
      },
      validateArgs,
      execute: async (args: IFunctionArgs): Promise<IFunctionArgs> => {
         const raceSeries = args.raceSeries as string;
         const data = mockRaceData[raceSeries] || { driver: 'Unknown Driver', points: 0 };
         
         return {
            leadingDriver: data.driver,
            raceSeries: raceSeries,
            points: data.points
         };
      }
   };
};

// Helper function to test both streaming and non-streaming responses
const testFunctionIntegration = async (
   chatDriver: any,
   testName: string,
   systemPrompt: string,
   userPrompt: string,
   functions: IFunction[],
   expectedValidation: (result: string) => boolean
) => {
   // Test non-streaming response
   it(`${testName} (getModelResponse)`, async () => {
      const result = await chatDriver.getModelResponse(
         systemPrompt,
         userPrompt,
         undefined, // messageHistory
         functions
      );
      
      expect(expectedValidation(result)).toBe(true);
   }).timeout(TEST_TIMEOUT_MS);

   // Test streaming response
   it(`${testName} (getStreamedModelResponse)`, async () => {
      const iterator = chatDriver.getStreamedModelResponse(
         systemPrompt,
         userPrompt,
         undefined, // messageHistory
         functions
      );
      
      const chunks: string[] = [];
      while (true) {
         const result = await iterator.next();
         if (result.done) break;
         if (result.value) {
            chunks.push(result.value);
         }
      }
      
      const fullText = chunks.join('');
      expect(expectedValidation(fullText)).toBe(true);
   }).timeout(TEST_TIMEOUT_MS);
};

// Run all tests for each provider
providers.forEach((provider, index) => {
  const chatDriver = chatDrivers[index];

  describe(`Function Integration Tests (${provider})`, () => {
    testFunctionIntegration(
      chatDriver,
      'should successfully return chat completion with function definition',
      'You are a helpful assistant that can call functions to get motorsport information.',
      'Who is the leading driver in Formula 1?',
      [createMotorsportFunction('basic')],
      (result: string) => {
         // The model should respond acknowledging the function call capability
         return result.match(/driver|formula|racing|function|call/i) !== null && result.length > 10;
      }
    );

    testFunctionIntegration(
      chatDriver,
      'should handle validation failure and include error information in response',
      'You are a helpful assistant that can call functions to get motorsport information.',
      'Who is the leading driver in F35?',
      [createMotorsportFunction('strict')],
      (result: string) => {
         // The model should respond with error information from validation failure
         // Check for various error indicators that might appear in the response
         return result.toLowerCase().includes('error') ||
                result.toLowerCase().includes('issue') ||
                result.toLowerCase().includes('problem') ||
                result.toLowerCase().includes('misunderstanding') ||         
                result.toLowerCase().includes('not recognized') ||
                result.toLowerCase().includes('not a valid') ||
                result.toLowerCase().includes('no recognized') ||
                result.toLowerCase().includes('not a valid') ||
                result.toLowerCase().includes('not a recognized') ||
                result.toLowerCase().includes('confusion') ||
                result.toLowerCase().includes('no widely recognized');
      }
    );
  });
});

describe('Function Interface Tests', () => {
   it('should validate function interface structure', () => {
      const testFunction: IFunction = {
         name: 'test_function',
         description: 'A test function for validation',
         inputSchema: {
            type: EDataType.kObject,
            properties: {
               testParam: {
                  type: EDataType.kString,
                  description: 'A test parameter'
               }
            },
            required: ['testParam']
         },
         outputSchema: {
            type: EDataType.kObject,
            properties: {
               testResult: {
                  type: EDataType.kString,
                  description: 'A test result'
               }
            },
            required: ['testResult']
         },
         validateArgs: (args: IFunctionArgs): IFunctionArgs => {
            if (!args.testParam || typeof args.testParam !== 'string') {
               throw new Error('testParam is required and must be a string');
            }
            return args;
         },
         execute: async (args: IFunctionArgs): Promise<IFunctionArgs> => {
            const testParam = args.testParam as string;
            return {
               testResult: `Processed: ${testParam}`
            };
         }
      };

      expect(testFunction.name).toBe('test_function');
      expect(testFunction.description).toBe('A test function for validation');
      expect(testFunction.inputSchema.properties.testParam.type).toBe(EDataType.kString);
      expect(testFunction.outputSchema.properties.testResult.type).toBe(EDataType.kString);
      expect(testFunction.inputSchema.required).toContain('testParam');
      expect(testFunction.outputSchema.required).toContain('testResult');
   });

   it('should validate EDataType enum values', () => {
      expect(EDataType.kObject).toBe('object');
      expect(EDataType.kString).toBe('string');
      expect(EDataType.kNumber).toBe('number');
      expect(EDataType.kArray).toBe('array');
   });
});