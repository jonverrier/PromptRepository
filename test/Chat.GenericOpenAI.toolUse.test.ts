/**
 * @module Chat.GenericOpenAI.toolUse.test
 * Unit tests for Responses API multi-round tool calling in GenericOpenAIChatDriver.
 */
// Copyright (c) 2025, 2026 Jon Verrier

import { expect } from 'expect';
import { OpenAIChatDriver } from '../src/Chat.OpenAI';
import { EVerbosity, EModel } from '../src/entry';
import { IFunction, EDataType } from '../src/Function';

const LIST_MEMORIES_CALL_ID = 'call_list_memories';
const SAVE_MEMORY_CALL_ID = 'call_save_memory';

describe('GenericOpenAIChatDriver tool use loop', () => {
   const originalOpenAiKey = process.env.OPENAI_API_KEY;

   beforeAll(() => {
      process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-openai-key';
   });

   afterAll(() => {
      if (originalOpenAiKey !== undefined) {
         process.env.OPENAI_API_KEY = originalOpenAiKey;
      } else {
         delete process.env.OPENAI_API_KEY;
      }
   });

   let apiRound = 0;
   let listMemoriesCalls = 0;
   let saveMemoryCalls = 0;
   const memoryStore: Record<string, string> = {};

   const listMemories: IFunction = {
      name: 'listMemories',
      description: 'Lists stored memories',
      inputSchema: { type: 'object', properties: {}, required: [] },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            count: { type: EDataType.kNumber, description: 'count' }
         },
         required: ['count']
      },
      validateArgs: () => ({}),
      execute: async () => {
         listMemoriesCalls++;
         return { count: Object.keys(memoryStore).length };
      }
   };

   const saveMemory: IFunction = {
      name: 'saveMemory',
      description: 'Saves a memory entry',
      inputSchema: {
         type: 'object',
         properties: {
            key: { type: 'string', description: 'key' },
            value: { type: 'string', description: 'value' }
         },
         required: ['key', 'value']
      },
      outputSchema: {
         type: EDataType.kObject,
         properties: {
            success: { type: EDataType.kBoolean, description: 'success' }
         },
         required: ['success']
      },
      validateArgs: (args) => args,
      execute: async (args) => {
         saveMemoryCalls++;
         memoryStore[String(args.key)] = String(args.value);
         return { success: true };
      }
   };

   beforeEach(() => {
      apiRound = 0;
      listMemoriesCalls = 0;
      saveMemoryCalls = 0;
      for (const key of Object.keys(memoryStore)) {
         delete memoryStore[key];
      }
   });

   it('continues after function_call_output items so later tools can run', async () => {
      const driver = new OpenAIChatDriver(EModel.kLarge);
      const inputsSeen: Array<Array<{ type?: string }>> = [];
      (driver as unknown as { openai: { responses: { create: (config: unknown) => Promise<unknown> } } }).openai = {
         responses: {
            create: async (config: unknown) => {
               const input = (config as { input?: Array<{ type?: string }> }).input ?? [];
               inputsSeen.push(input);
               apiRound++;
               if (apiRound === 1) {
                  return {
                     output: [{
                        type: 'function_call',
                        name: 'listMemories',
                        arguments: '{}',
                        call_id: LIST_MEMORIES_CALL_ID
                     }]
                  };
               }
               if (apiRound === 2) {
                  return {
                     output: [{
                        type: 'function_call',
                        name: 'saveMemory',
                        arguments: JSON.stringify({ key: 'age', value: '50' }),
                        call_id: SAVE_MEMORY_CALL_ID
                     }]
                  };
               }
               return {
                  output: [{
                     type: 'text',
                     text: 'Saved your age as 50 in memory after listing existing memories.'
                  }]
               };
            }
         }
      };

      const result = await driver.getModelResponseWithForcedTools(
         'Use tools to list memories then save new facts.',
         'I am 50 years old.',
         EVerbosity.kMedium,
         undefined,
         [listMemories, saveMemory]
      );

      expect(apiRound).toBe(3);
      expect(listMemoriesCalls).toBe(1);
      expect(saveMemoryCalls).toBe(1);
      expect(memoryStore.age).toBe('50');
      expect(result.toLowerCase()).toContain('50');

      const secondRequestInput = inputsSeen[1] ?? [];
      expect(secondRequestInput.some(item => item.type === 'function_call')).toBe(true);
      expect(secondRequestInput.some(item => item.type === 'function_call_output')).toBe(true);
   });
});
