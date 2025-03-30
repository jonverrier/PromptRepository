/**
 * @module makepromptids.test
 * 
 * Unit tests for the MakePromptIds module which generates TypeScript prompt ID declarations.
 * Tests verify:
 * - Correct camelCase conversion of prompt names
 * - Proper handling of special characters and spaces
 * - Generation of valid JSON output mapping prompt names to IDs
 * 
 * Uses temporary test files to validate ID generation functionality.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it, afterEach } from 'mocha';
import fs from 'fs';
import path from 'path';
import { generateJsonIds } from '../src/MakePromptIds';


describe('generateJsonIds', () => {
    const testOutputPath = path.join(__dirname, 'test-promptIds.ts');
    
    // Clean up test file after each test
    afterEach(() => {
        if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
        }
    });

    it('should generate correct camelCase IDs from simple prompt names', () => {
        const testPrompts = [
            { name: 'hello world', id: '123' },
            { name: 'test prompt', id: '456' }
        ];

        generateJsonIds(testPrompts, testOutputPath);

        const result = JSON.parse(fs.readFileSync(testOutputPath, 'utf-8'));
        expect(result).toEqual({
            helloWorldPromptId: '123',
            testPromptPromptId: '456'
        });
    });

    it('should handle special characters and multiple spaces', () => {
        const testPrompts = [
            { name: 'hello!!!world', id: '123' },
            { name: 'test  multiple    spaces', id: '456' }
        ];

        generateJsonIds(testPrompts, testOutputPath);

        const result = JSON.parse(fs.readFileSync(testOutputPath, 'utf-8'));
        expect(result).toEqual({
            helloWorldPromptId: '123',
            testMultipleSpacesPromptId: '456'
        });
    });

    it('should handle empty array of prompts', () => {
        const testPrompts: any[] = [];

        generateJsonIds(testPrompts, testOutputPath);

        const result = JSON.parse(fs.readFileSync(testOutputPath, 'utf-8'));
        expect(result).toEqual({});
    });

    it('should handle numbers in prompt names', () => {
        const testPrompts = [
            { name: 'prompt 123', id: '456' },
            { name: '123 prompt', id: '789' }
        ];

        generateJsonIds(testPrompts, testOutputPath);

        const result = JSON.parse(fs.readFileSync(testOutputPath, 'utf-8'));
        expect(result).toEqual({
            prompt123PromptId: '456',
            '123PromptPromptId': '789'
        });
    });
});