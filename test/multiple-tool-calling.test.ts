/**
 * @module multiple-tool-calling.test
 * 
 * Comprehensive tests for multiple tool calling functionality.
 * Demonstrates the enhanced tool calling capabilities following OpenAI Responses API patterns.
 * Tests scenarios where the model calls multiple tools in a single interaction.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { ChatDriverFactory, EModelProvider, EModel, EVerbosity } from '../src/entry';
import { IFunction, EDataType, IFunctionArgs } from '../src/Function';

const TEST_TIMEOUT_MS = 90000; // 90 second timeout for complex multi-tool scenarios

// Create chat drivers for testing
const chatDriverFactory = new ChatDriverFactory();
const providers = [EModelProvider.kAzureOpenAI, EModelProvider.kOpenAI];
const chatDrivers = providers.map(provider => chatDriverFactory.create(EModel.kLarge, provider));

// Global execution tracking for testing
let functionExecutions: Array<{functionName: string, args: any, result: any, timestamp: Date}> = [];

// Helper function to reset execution tracking
const resetExecutionTracking = () => {
   functionExecutions = [];
};

// Helper function to get execution count for a specific function
const getExecutionCount = (functionName: string): number => {
   return functionExecutions.filter(exec => exec.functionName === functionName).length;
};

// Mock weather data for different cities
const mockWeatherData: { [key: string]: { temperature: number; condition: string; humidity: number } } = {
   'london': { temperature: 15, condition: 'cloudy', humidity: 78 },
   'paris': { temperature: 18, condition: 'sunny', humidity: 65 },
   'tokyo': { temperature: 22, condition: 'rainy', humidity: 85 },
   'new york': { temperature: 12, condition: 'snowy', humidity: 70 },
   'sydney': { temperature: 25, condition: 'sunny', humidity: 60 }
};

// Mock horoscope data for different signs
const mockHoroscopeData: { [key: string]: string } = {
   'aquarius': 'Next Tuesday you will befriend a baby otter.',
   'taurus': 'The stars align for financial opportunities this week.',
   'gemini': 'Communication will be key to your success today.',
   'cancer': 'Home and family take center stage in your life.',
   'leo': 'Your creativity shines brighter than ever before.',
   'virgo': 'Attention to detail will serve you well today.',
   'libra': 'Balance and harmony guide your decisions.',
   'scorpio': 'Deep transformation awaits you this month.',
   'sagittarius': 'Adventure calls to your restless spirit.',
   'capricorn': 'Hard work will pay off in unexpected ways.',
   'pisces': 'Your intuition is especially strong right now.',
   'aries': 'Bold action leads to exciting opportunities.'
};

/**
 * Creates a weather function following the official OpenAI example pattern
 */
const createWeatherFunction = (): IFunction => {
   return {
      name: 'get_weather',
      description: 'Get current weather information for a specific city',
      inputSchema: {
         type: EDataType.kObject,
         properties: {
            city: {
               type: EDataType.kString,
               description: 'The name of the city to get weather for'
            }
         },
         required: ['city']
      },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            city: {
               type: EDataType.kString,
               description: 'The city name'
            },
            temperature: {
               type: EDataType.kNumber,
               description: 'Temperature in Celsius'
            },
            condition: {
               type: EDataType.kString,
               description: 'Weather condition'
            },
            humidity: {
               type: EDataType.kNumber,
               description: 'Humidity percentage'
            }
         },
         required: ['city', 'temperature', 'condition', 'humidity']
      },
      validateArgs: (args: IFunctionArgs): IFunctionArgs => {
         if (!args.city || typeof args.city !== 'string') {
            throw new Error('city is required and must be a string');
         }
         return args;
      },
      execute: async (args: IFunctionArgs): Promise<IFunctionArgs> => {
         const city = (args.city as string).toLowerCase();
         const weatherData = mockWeatherData[city] || { temperature: 20, condition: 'unknown', humidity: 50 };
         
         const result = {
            city: args.city as string,
            temperature: weatherData.temperature,
            condition: weatherData.condition,
            humidity: weatherData.humidity
         };
         
         // Track execution
         functionExecutions.push({
            functionName: 'get_weather',
            args: args,
            result: result,
            timestamp: new Date()
         });
         
         console.log(`[WEATHER FUNCTION] Called for ${args.city}:`, result);
         return result;
      }
   };
};

/**
 * Creates a horoscope function following the official OpenAI example pattern
 */
const createHoroscopeFunction = (): IFunction => {
   return {
      name: 'get_horoscope',
      description: "Get today's horoscope for an astrological sign",
      inputSchema: {
         type: EDataType.kObject,
         properties: {
            sign: {
               type: EDataType.kString,
               description: 'An astrological sign like Taurus or Aquarius'
            }
         },
         required: ['sign']
      },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            sign: {
               type: EDataType.kString,
               description: 'The astrological sign'
            },
            horoscope: {
               type: EDataType.kString,
               description: 'The horoscope text'
            }
         },
         required: ['sign', 'horoscope']
      },
      validateArgs: (args: IFunctionArgs): IFunctionArgs => {
         if (!args.sign || typeof args.sign !== 'string') {
            throw new Error('sign is required and must be a string');
         }
         return args;
      },
      execute: async (args: IFunctionArgs): Promise<IFunctionArgs> => {
         const sign = (args.sign as string).toLowerCase();
         const horoscope = mockHoroscopeData[sign] || 'The stars are mysterious today.';
         
         const result = {
            sign: args.sign as string,
            horoscope: horoscope
         };
         
         // Track execution
         functionExecutions.push({
            functionName: 'get_horoscope',
            args: args,
            result: result,
            timestamp: new Date()
         });
         
         console.log(`[HOROSCOPE FUNCTION] Called for ${args.sign}:`, result);
         return result;
      }
   };
};

/**
 * Creates a time zone function for testing multiple tool scenarios
 */
const createTimeZoneFunction = (): IFunction => {
   return {
      name: 'get_timezone',
      description: 'Get the current time zone information for a city',
      inputSchema: {
         type: EDataType.kObject,
         properties: {
            city: {
               type: EDataType.kString,
               description: 'The name of the city to get timezone for'
            }
         },
         required: ['city']
      },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            city: {
               type: EDataType.kString,
               description: 'The city name'
            },
            timezone: {
               type: EDataType.kString,
               description: 'The timezone identifier'
            },
            offset: {
               type: EDataType.kString,
               description: 'UTC offset'
            }
         },
         required: ['city', 'timezone', 'offset']
      },
      validateArgs: (args: IFunctionArgs): IFunctionArgs => {
         if (!args.city || typeof args.city !== 'string') {
            throw new Error('city is required and must be a string');
         }
         return args;
      },
      execute: async (args: IFunctionArgs): Promise<IFunctionArgs> => {
         const city = args.city as string;
         const timezoneMap: { [key: string]: { timezone: string, offset: string } } = {
            'london': { timezone: 'Europe/London', offset: '+00:00' },
            'paris': { timezone: 'Europe/Paris', offset: '+01:00' },
            'tokyo': { timezone: 'Asia/Tokyo', offset: '+09:00' },
            'new york': { timezone: 'America/New_York', offset: '-05:00' },
            'sydney': { timezone: 'Australia/Sydney', offset: '+11:00' }
         };
         
         const timezoneData = timezoneMap[city.toLowerCase()] || { timezone: 'UTC', offset: '+00:00' };
         
         const result = {
            city: city,
            timezone: timezoneData.timezone,
            offset: timezoneData.offset
         };
         
         // Track execution
         functionExecutions.push({
            functionName: 'get_timezone',
            args: args,
            result: result,
            timestamp: new Date()
         });
         
         console.log(`[TIMEZONE FUNCTION] Called for ${city}:`, result);
         return result;
      }
   };
};

// Helper function to test multiple tool calling scenarios
const testMultipleToolCalling = async (
   chatDriver: any,
   testName: string,
   systemPrompt: string,
   userPrompt: string,
   functions: IFunction[],
   expectedMinExecutions: number,
   expectedFunctionNames: string[],
   contentValidation: (result: string) => boolean
) => {
   // Test non-streaming response
   it(`${testName} (getModelResponseWithForcedTools)`, async () => {
      resetExecutionTracking();
      
      const result = await chatDriver.getModelResponseWithForcedTools(
         systemPrompt,
         userPrompt,
         EVerbosity.kMedium,
         undefined, // messageHistory
         functions
      );
      
      console.log(`[MULTI-TOOL TEST] ${testName}:`);
      console.log(`User Prompt: ${userPrompt}`);
      console.log(`Model Response: ${result}`);
      console.log(`Function Executions: ${functionExecutions.length}`);
      functionExecutions.forEach((exec, index) => {
         console.log(`  ${index + 1}. ${exec.functionName}(${JSON.stringify(exec.args)}) -> ${JSON.stringify(exec.result)}`);
      });
      console.log('---');
      
      // Verify minimum number of function executions
      expect(functionExecutions.length).toBeGreaterThanOrEqual(expectedMinExecutions);
      
      // Verify expected functions were called
      expectedFunctionNames.forEach(functionName => {
         const executionCount = getExecutionCount(functionName);
         expect(executionCount).toBeGreaterThan(0);
      });
      
      // Verify response content
      expect(contentValidation(result)).toBe(true);
      
      // Verify response is substantial
      expect(result.length).toBeGreaterThan(100);
   }).timeout(TEST_TIMEOUT_MS);

   // Test streaming response
   it(`${testName} (getStreamedModelResponseWithForcedTools)`, async () => {
      resetExecutionTracking();
      
      const iterator = chatDriver.getStreamedModelResponseWithForcedTools(
         systemPrompt,
         userPrompt,
         EVerbosity.kMedium,
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
      
      console.log(`[MULTI-TOOL STREAMING TEST] ${testName}:`);
      console.log(`Streamed Response: ${fullText}`);
      console.log(`Function Executions: ${functionExecutions.length}`);
      console.log('---');
      
      // Verify minimum number of function executions
      expect(functionExecutions.length).toBeGreaterThanOrEqual(expectedMinExecutions);
      
      // Verify expected functions were called
      expectedFunctionNames.forEach(functionName => {
         const executionCount = getExecutionCount(functionName);
         expect(executionCount).toBeGreaterThan(0);
      });
      
      // Verify response content
      expect(contentValidation(fullText)).toBe(true);
      
      // Verify response is substantial
      expect(fullText.length).toBeGreaterThan(100);
   }).timeout(TEST_TIMEOUT_MS);
};

// Run tests for each provider
providers.forEach((provider, index) => {
   const chatDriver = chatDrivers[index];

   describe(`Multiple Tool Calling Tests (${provider})`, () => {
      
      // Test 1: Multiple weather calls for different cities
      testMultipleToolCalling(
         chatDriver,
         'should call weather function multiple times for different cities',
         'You are a helpful assistant with access to weather data. When asked about weather in multiple cities, call the get_weather function for each city separately.',
         'What is the weather like in London and Paris?',
         [createWeatherFunction()],
         2, // Expected minimum executions (one for each city)
         ['get_weather'], // Expected function names
         (result: string) => {
            const lowerResult = result.toLowerCase();
            return lowerResult.includes('london') && lowerResult.includes('paris') && 
                   (lowerResult.includes('weather') || lowerResult.includes('temperature'));
         }
      );

      // Test 2: Mixed function calls (weather + horoscope)
      testMultipleToolCalling(
         chatDriver,
         'should call different types of functions in one interaction',
         'You are a helpful assistant with access to weather and horoscope data. Use the appropriate functions to answer user questions.',
         'What is the weather in Tokyo and what is my horoscope for Aquarius?',
         [createWeatherFunction(), createHoroscopeFunction()],
         2, // Expected minimum executions (weather + horoscope)
         ['get_weather', 'get_horoscope'], // Expected function names
         (result: string) => {
            const lowerResult = result.toLowerCase();
            return lowerResult.includes('tokyo') && lowerResult.includes('aquarius') &&
                   (lowerResult.includes('weather') || lowerResult.includes('temperature')) &&
                   (lowerResult.includes('horoscope') || lowerResult.includes('otter'));
         }
      );

      // Test 3: Complex multi-city, multi-function scenario
      testMultipleToolCalling(
         chatDriver,
         'should handle complex multi-city multi-function requests',
         'You are a travel assistant with access to weather and timezone information. Help users plan their trips by providing comprehensive information.',
         'I am planning to visit London, Paris, and Tokyo. Can you tell me the weather and timezone information for each city?',
         [createWeatherFunction(), createTimeZoneFunction()],
         6, // Expected minimum executions (3 cities × 2 functions each)
         ['get_weather', 'get_timezone'], // Expected function names
         (result: string) => {
            const lowerResult = result.toLowerCase();
            return lowerResult.includes('london') && lowerResult.includes('paris') && lowerResult.includes('tokyo') &&
                   (lowerResult.includes('weather') || lowerResult.includes('temperature')) &&
                   (lowerResult.includes('timezone') || lowerResult.includes('utc'));
         }
      );

      // Test 4: All three functions in one complex request
      testMultipleToolCalling(
         chatDriver,
         'should handle requests requiring all available functions',
         'You are a comprehensive assistant with access to weather, horoscope, and timezone data. Provide complete information when requested.',
         'I am an Aquarius planning a trip to Sydney. Can you give me the weather, timezone, and my horoscope?',
         [createWeatherFunction(), createHoroscopeFunction(), createTimeZoneFunction()],
         3, // Expected minimum executions (one for each function)
         ['get_weather', 'get_horoscope', 'get_timezone'], // Expected function names
         (result: string) => {
            const lowerResult = result.toLowerCase();
            return lowerResult.includes('sydney') && lowerResult.includes('aquarius') &&
                   (lowerResult.includes('weather') || lowerResult.includes('temperature')) &&
                   (lowerResult.includes('horoscope') || lowerResult.includes('otter')) &&
                   (lowerResult.includes('timezone') || lowerResult.includes('australia'));
         }
      );

      // Test 5: Official OpenAI example recreation
      testMultipleToolCalling(
         chatDriver,
         'should recreate the official OpenAI horoscope example pattern',
         'You are a helpful assistant that can provide horoscope information. When asked about horoscopes, use the get_horoscope function.',
         'What is my horoscope? I am an Aquarius.',
         [createHoroscopeFunction()],
         1, // Expected minimum executions
         ['get_horoscope'], // Expected function names
         (result: string) => {
            const lowerResult = result.toLowerCase();
            return lowerResult.includes('aquarius') && 
                   (lowerResult.includes('horoscope') || lowerResult.includes('otter') || lowerResult.includes('tuesday'));
         }
      );
   });
});

describe('Multiple Tool Calling Interface Tests', () => {
   it('should validate multiple function interface structures', () => {
      const weatherFunction = createWeatherFunction();
      const horoscopeFunction = createHoroscopeFunction();
      const timezoneFunction = createTimeZoneFunction();
      
      // Validate weather function
      expect(weatherFunction.name).toBe('get_weather');
      expect(weatherFunction.inputSchema.properties.city.type).toBe(EDataType.kString);
      expect(weatherFunction.outputSchema.properties.temperature.type).toBe(EDataType.kNumber);
      
      // Validate horoscope function
      expect(horoscopeFunction.name).toBe('get_horoscope');
      expect(horoscopeFunction.inputSchema.properties.sign.type).toBe(EDataType.kString);
      expect(horoscopeFunction.outputSchema.properties.horoscope.type).toBe(EDataType.kString);
      
      // Validate timezone function
      expect(timezoneFunction.name).toBe('get_timezone');
      expect(timezoneFunction.inputSchema.properties.city.type).toBe(EDataType.kString);
      expect(timezoneFunction.outputSchema.properties.timezone.type).toBe(EDataType.kString);
   });

   it('should handle function execution tracking correctly', () => {
      resetExecutionTracking();
      expect(functionExecutions.length).toBe(0);
      
      // Simulate some executions
      functionExecutions.push({
         functionName: 'get_weather',
         args: { city: 'London' },
         result: { temperature: 15 },
         timestamp: new Date()
      });
      
      expect(getExecutionCount('get_weather')).toBe(1);
      expect(getExecutionCount('get_horoscope')).toBe(0);
   });
});
