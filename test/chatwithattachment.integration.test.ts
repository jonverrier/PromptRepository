/**
 * @module chatwithattachment.integration.test
 * 
 * Integration tests for file content injection that call the actual OpenAI/Azure OpenAI APIs.
 * These tests verify file content understanding by injecting file content directly into prompts
 * using the <file></file> marker pattern and the regular ChatDriver API.
 * 
 * These tests require OPENAI_API_KEY or AZURE_OPENAI_API_KEY to be set.
 */

// Copyright (c) 2025 Jon Verrier

import { describe, it, after } from 'mocha';
import { expect } from 'expect';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ChatDriverFactory, EModelProvider, EModel, EVerbosity } from '../src/entry';

const TEST_TIMEOUT_MS = 60000; // 1 minute timeout for chat requests

// Create drivers for both providers
const factory = new ChatDriverFactory();
const providers = [EModelProvider.kOpenAI, EModelProvider.kAzureOpenAI];
const drivers = providers.map(provider => factory.create(EModel.kLarge, provider));

/**
 * Extracts text content from file data in various formats.
 */
function extractFileContent(data: Buffer | string): string {
   if (typeof data === 'string') {
      return data;
   } else if (Buffer.isBuffer(data)) {
      return data.toString('utf8');
   } else {
      throw new Error(`Unsupported file data type: ${typeof data}`);
   }
}

/**
 * Injects file content into a prompt with <file></file> markers.
 */
function injectFileIntoPrompt(prompt: string, fileContent: string): string {
   return prompt.replace('<file></file>', `<file>${fileContent}</file>`);
}

describe('File Content Injection Integration Tests', () => {
   // Known test file names for cleanup
   const testFileNames = [
      'motor-racing-integration-test.txt',
      'gardening-integration-test.txt',
      'markdown-10pages-integration-test.txt'
   ];

   /**
    * Creates or reuses a temporary test file with the specified content in system temp directory
    */
   const createTestFile = (filename: string, content: string): string => {
      const filePath = path.join(os.tmpdir(), filename);
      if (!fs.existsSync(filePath)) {
         fs.writeFileSync(filePath, content, 'utf8');
      }
      return filePath;
   };

   /**
    * Generates a realistic 10-page markdown file (~20KB) simulating a docx converted to markdown.
    * Each page contains approximately 2000 characters of markdown content.
    */
   const generate10PageMarkdown = (): string => {
      const pages: string[] = [];
      
      for (let page = 1; page <= 10; page++) {
         pages.push(`# Page ${page}\n\n`);
         pages.push(`## Introduction\n\n`);
         pages.push(`This is page ${page} of a document that was converted from a Word document (docx) to markdown format. `);
         pages.push(`The content includes various markdown elements such as headers, paragraphs, lists, and code blocks.\n\n`);
         
         pages.push(`### Section ${page}.1: Content Details\n\n`);
         pages.push(`Here is some detailed content for page ${page}. This paragraph contains information about `);
         pages.push(`various topics that might appear in a typical document. The text includes multiple sentences `);
         pages.push(`and covers different aspects of the subject matter.\n\n`);
         
         pages.push(`#### Subsection ${page}.1.1\n\n`);
         pages.push(`- **Item 1**: This is the first bullet point with some important information.\n`);
         pages.push(`- **Item 2**: This is the second bullet point with additional details.\n`);
         pages.push(`- **Item 3**: This is the third bullet point that completes the list.\n\n`);
         
         pages.push(`#### Subsection ${page}.1.2\n\n`);
         pages.push(`Here is a code block example:\n\n`);
         pages.push(`\`\`\`typescript\n`);
         pages.push(`function example${page}() {\n`);
         pages.push(`   return "This is page ${page} code";\n`);
         pages.push(`}\n`);
         pages.push(`\`\`\`\n\n`);
         
         pages.push(`### Section ${page}.2: Additional Information\n\n`);
         pages.push(`This section provides more context and details about the topic. It includes multiple paragraphs `);
         pages.push(`with varying lengths to simulate realistic document structure. The content is designed to `);
         pages.push(`represent what you might find in a typical business or technical document.\n\n`);
         
         pages.push(`**Key Points for Page ${page}:**\n\n`);
         pages.push(`1. First important point about the content\n`);
         pages.push(`2. Second important point with more details\n`);
         pages.push(`3. Third important point that summarizes the section\n\n`);
         
         pages.push(`> This is a blockquote that emphasizes an important concept on page ${page}.\n\n`);
         
         pages.push(`### Section ${page}.3: Summary\n\n`);
         pages.push(`In summary, page ${page} contains structured markdown content that represents a typical `);
         pages.push(`document page. The content includes headers, paragraphs, lists, code blocks, and other `);
         pages.push(`markdown elements that would be found in a converted document.\n\n`);
         
         pages.push(`---\n\n`);
      }
      
      const content = pages.join('');
      // Ensure we're close to 20KB (20,000 characters)
      const targetSize = 20000;
      if (content.length < targetSize) {
         // Pad with additional content if needed
         const padding = '\n\nAdditional content to reach target size. '.repeat(
            Math.ceil((targetSize - content.length) / 40)
         );
         return content + padding.substring(0, targetSize - content.length);
      } else if (content.length > targetSize) {
         // Truncate if slightly over
         return content.substring(0, targetSize);
      }
      return content;
   };

   /**
    * Clean up temporary test files after all tests complete
    */
   after(() => {
      // Clean up temporary test files
      testFileNames.forEach(filename => {
         const filePath = path.join(os.tmpdir(), filename);
         try {
            if (fs.existsSync(filePath)) {
               fs.unlinkSync(filePath);
               console.log(`Cleaned up test file: ${filename}`);
            }
         } catch (error) {
            console.warn(`Failed to clean up test file ${filename}:`, error);
         }
      });
   });

   // Run tests for each provider
   providers.forEach((provider, index) => {
      const driver = drivers[index];
      const providerName = provider === EModelProvider.kOpenAI ? 'OpenAI' : 'Azure OpenAI';

      describe(`${providerName} - File Content Understanding Tests`, () => {
         it('understands motor racing file content', async () => {
            const filePath = createTestFile('motor-racing-integration-test.txt', 'This file is about motor racing.');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            const userPrompt = 'What is this file about? Answer in one sentence. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, fileContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            expect(result.toLowerCase()).toMatch(/motor/);
            expect(result.toLowerCase()).toMatch(/racing/);
         }).timeout(TEST_TIMEOUT_MS);

         it('understands gardening file content and does not mention motor racing', async () => {
            const filePath = createTestFile('gardening-integration-test.txt', 'This file is about gardening.');
            const fileContent = fs.readFileSync(filePath, 'utf8');

            const userPrompt = 'What is this file about? Answer in one sentence. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, fileContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            expect(result.toLowerCase()).toMatch(/garden/);
            expect(result.toLowerCase()).not.toMatch(/motor.*racing|racing.*motor/);
         }).timeout(TEST_TIMEOUT_MS);
      });

      describe(`${providerName} - Markdown File Content Injection Tests (10 pages, ~20KB)`, () => {
         const markdownContent = generate10PageMarkdown();
         const markdownSizeBytes = Buffer.from(markdownContent, 'utf8').length;

         it('injects markdown file content from Buffer format', async () => {
            const fileBuffer = Buffer.from(markdownContent, 'utf8');
            const fileContent = extractFileContent(fileBuffer);

            const userPrompt = 'How many pages are in this document? Answer with just the number. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, fileContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            // Should successfully process the file content
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
         }).timeout(TEST_TIMEOUT_MS);

         it('injects markdown file content from string format', async () => {
            const userPrompt = 'What is the main topic of this document? Answer in one sentence. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, markdownContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
         }).timeout(TEST_TIMEOUT_MS);

         it('injects markdown file content and processes large files', async () => {
            const userPrompt = 'Summarize the first page of this document in one sentence. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, markdownContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
         }).timeout(TEST_TIMEOUT_MS);

         it('injects markdown file content with different prompts', async () => {
            const userPrompt = 'What type of document is this? Answer in one word. <file></file>';
            const promptWithFile = injectFileIntoPrompt(userPrompt, markdownContent);

            const result = await driver.getModelResponse(
               undefined,
               promptWithFile,
               EVerbosity.kMedium
            );

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
         }).timeout(TEST_TIMEOUT_MS);

         it('verifies markdown file size is approximately 20KB', () => {
            const sizeBytes = Buffer.from(markdownContent, 'utf8').length;
            const sizeKB = sizeBytes / 1024;
            
            // Should be approximately 20KB (allow some variance)
            expect(sizeBytes).toBeGreaterThan(19000); // At least 19KB
            expect(sizeBytes).toBeLessThan(21000);     // At most 21KB
            expect(sizeKB).toBeCloseTo(20, 0);         // Approximately 20KB
            
            console.log(`Markdown file size: ${sizeKB.toFixed(2)}KB (${sizeBytes} bytes)`);
         });

         it('saves markdown test file to disk for inspection', () => {
            const filePath = createTestFile('markdown-10pages-integration-test.txt', markdownContent);
            const savedContent = fs.readFileSync(filePath, 'utf8');
            const savedSize = fs.statSync(filePath).size;
            
            expect(savedContent).toBe(markdownContent);
            expect(savedSize).toBe(markdownSizeBytes);
            expect(fs.existsSync(filePath)).toBe(true);
         });
      });
   });
});

