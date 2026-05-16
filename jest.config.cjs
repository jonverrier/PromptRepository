/**
 * Jest configuration for PromptRepository tests.
 */
// Copyright (c) 2025, 2026 Jon Verrier

/** @type {import('jest').Config} */
const tsJestTransform = {
   '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }]
};

/** @type {import('jest').Config} */
module.exports = {
   projects: [
      {
         displayName: 'unit',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test'],
         testMatch: ['**/*.test.ts'],
         transform: tsJestTransform,
         collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.unit.js']
      },
      {
         displayName: 'ci',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test'],
         testMatch: [
            '**/promptrepository.test.ts',
            '**/prompts.test.ts',
            '**/makepromptids.test.ts'
         ],
         transform: tsJestTransform,
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.ci.js']
      },
      {
         displayName: 'integration',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test'],
         testMatch: [
            '**/chat.test.ts',
            '**/embed.test.ts',
            '**/function.test.ts',
            '**/prompts.eval.test.ts',
            '**/chatwithattachment.integration.test.ts'
         ],
         transform: tsJestTransform,
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.integration.js'],
         maxWorkers: 1
      },
      {
         displayName: 'mini',
         preset: 'ts-jest',
         testEnvironment: 'node',
         roots: ['<rootDir>/test'],
         testMatch: [
            '**/function.test.ts',
            '**/multiple-tool-calling.test.ts'
         ],
         transform: tsJestTransform,
         setupFilesAfterEnv: ['<rootDir>/test/setup/jest.timeout.mini.js'],
         maxWorkers: 1
      }
   ]
};
