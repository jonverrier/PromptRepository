/**
 * @module anthropic.driver.test
 *
 * Unit tests for AnthropicChatDriver configuration and schema conversion.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';
import { ChatDriverFactory, EModelProvider, EModel, InvalidStateError } from '../src/entry';
import { AnthropicChatDriver } from '../src/Chat.Anthropic';
import { EDataType, IFunction } from '../src/Function';

describe('AnthropicChatDriver unit tests', () => {
   const originalApiKey = process.env.ANTHROPIC_API_KEY;

   afterEach(() => {
      if (originalApiKey !== undefined) {
         process.env.ANTHROPIC_API_KEY = originalApiKey;
      } else {
         delete process.env.ANTHROPIC_API_KEY;
      }
   });

   it('should throw InvalidStateError when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new AnthropicChatDriver(EModel.kLarge)).toThrow(InvalidStateError);
   });

   it('should map kLarge to claude-opus-4-7', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const driver = new AnthropicChatDriver(EModel.kLarge);
      expect((driver as unknown as { getModelName: () => string }).getModelName()).toBe('claude-opus-4-7');
   });

   it('should map kMini to claude-sonnet-4-5', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const driver = new AnthropicChatDriver(EModel.kMini);
      expect((driver as unknown as { getModelName: () => string }).getModelName()).toBe('claude-sonnet-4-5');
   });

   it('should be created via ChatDriverFactory for kAnthropic provider', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const factory = new ChatDriverFactory();
      const driver = factory.create(EModel.kLarge, EModelProvider.kAnthropic);
      expect(driver).toBeInstanceOf(AnthropicChatDriver);
   });

   it('should convert IFunction to Anthropic tools input_schema', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      const driver = new AnthropicChatDriver(EModel.kLarge);
      const testFunction: IFunction = {
         name: 'get_weather',
         description: 'Get weather for a location',
         inputSchema: {
            type: EDataType.kObject,
            properties: {
               location: {
                  type: EDataType.kString,
                  description: 'City name'
               }
            },
            required: ['location']
         },
         outputSchema: {
            type: EDataType.kObject,
            properties: {
               temp: { type: EDataType.kNumber, description: 'Temperature' }
            },
            required: ['temp']
         },
         validateArgs: (args) => args,
         execute: async (args) => args
      };

      const convert = (driver as unknown as {
         convertFunctionsToAnthropicFormat: (functions: IFunction[]) => Array<{ name: string; input_schema: { type: string; properties: unknown; required: string[] } }>;
      }).convertFunctionsToAnthropicFormat.bind(driver);

      const tools = convert([testFunction]);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('get_weather');
      expect(tools[0].input_schema.type).toBe('object');
      expect(tools[0].input_schema.required).toContain('location');
   });
});
