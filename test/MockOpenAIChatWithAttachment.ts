/**
 * @module MockOpenAIChatWithAttachment
 * 
 * Mock implementation of OpenAIChatWithAttachment for testing.
 */
// Copyright (c) 2025 Jon Verrier

import { EVerbosity, IChatAttachmentContent, IChatAttachmentReference } from '../src/entry';
import { OpenAIChatWithAttachment } from '../src/ChatWithAttachment.OpenAI';
import { ChatAttachmentInput, IChatTableJson } from '../src/ChatWithAttachment';

/**
 * Mock class for testing OpenAI ChatWithAttachment driver
 */
export class MockOpenAIChatWithAttachment extends OpenAIChatWithAttachment {
   private mockResponsesCreate?: (config: any) => Promise<any>;
   private mockFilesCreate?: (input: any) => Promise<any>;
   private mockFilesDelete?: (id: string) => Promise<void>;

   constructor() {
      // Create a mock client
      const client: any = {
         responses: {
            create: async (config: any) => {
               if (this.mockResponsesCreate) {
                  return this.mockResponsesCreate(config);
               }
               return {
                  output: [{ type: 'output_text', text: 'default response' }]
               };
            }
         },
         files: {
            create: async (input: any) => {
               if (this.mockFilesCreate) {
                  return this.mockFilesCreate(input);
               }
               return { id: 'file-123' };
            },
            delete: async (id: string) => {
               if (this.mockFilesDelete) {
                  return this.mockFilesDelete(id);
               }
            }
         }
      };

      super({ client, model: 'gpt-test' });
   }

   /**
    * Set mock behavior for responses.create
    */
   setMockResponsesCreate(mockFn: (config: any) => Promise<any>): void {
      this.mockResponsesCreate = mockFn;
      (this as any).openai.responses.create = mockFn;
   }

   /**
    * Set mock behavior for files.create
    */
   setMockFilesCreate(mockFn: (input: any) => Promise<any>): void {
      this.mockFilesCreate = mockFn;
      (this as any).openai.files.create = mockFn;
   }

   /**
    * Set mock behavior for files.delete
    */
   setMockFilesDelete(mockFn: (id: string) => Promise<void>): void {
      this.mockFilesDelete = mockFn;
      (this as any).openai.files.delete = mockFn;
   }

   /**
    * Reset all mocks to defaults
    */
   resetMocks(): void {
      this.mockResponsesCreate = undefined;
      this.mockFilesCreate = undefined;
      this.mockFilesDelete = undefined;
      (this as any).openai.responses.create = async (config: any) => ({
         output: [{ type: 'output_text', text: 'default response' }]
      });
      (this as any).openai.files.create = async () => ({ id: 'file-123' });
      (this as any).openai.files.delete = async () => {};
   }
}

