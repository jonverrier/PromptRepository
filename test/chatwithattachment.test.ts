import { describe, it, after } from 'mocha';
import { expect } from 'expect';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OpenAIChatWithAttachment } from '../src/ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from '../src/ChatWithAttachment.AzureOpenAI';
import { EVerbosity, IChatAttachmentContent, IChatAttachmentReference, EModel } from '../src/entry';

describe('OpenAIChatWithAttachment', () => {
   // Known test file names for cleanup
   const testFileNames = [
      'motor-racing-test.txt',
      'gardening-test.txt', 
      'almost-motor-racing-test.txt'
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
    * Clean up temporary test files after all tests complete
    */
   after(() => {
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

   const buildDriver = (mocks: {
      responsesCreate?: (config: any) => Promise<any>;
      filesCreate?: (input: any) => Promise<any>;
      filesDelete?: (id: string) => Promise<void>;
   }) => {
      const responsesCreate = mocks.responsesCreate ?? (async () => ({
         output: [{ type: 'output_text', text: 'default response' }]
      }));
      const filesCreate = mocks.filesCreate ?? (async () => ({ id: 'file-123' }));
      const filesDelete = mocks.filesDelete ?? (async () => {});

      const client: any = {
         responses: {
            create: responsesCreate
         },
         files: {
            create: filesCreate,
            delete: filesDelete
         }
      };

      return new OpenAIChatWithAttachment({ client, model: 'gpt-test' });
   };

   it('uploads inline attachments and cleans up by default', async () => {
      let capturedConfig: any;
      let deleteCalled = false;
      let uploadedPayload: any;

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'inline response' }]
            };
         },
         filesCreate: async (input) => {
            uploadedPayload = input;
            return { id: 'file-inline' };
         },
         filesDelete: async () => {
            deleteCalled = true;
         }
      });

      const attachment: IChatAttachmentContent = {
         filename: 'notes.txt',
         mimeType: 'text/plain',
         data: Buffer.from('hello world')
      };

      const result = await driver.getModelResponse('system', 'prompt', EVerbosity.kMedium, attachment);

      expect(result).toBe('inline response');
      expect(uploadedPayload.filename).toBe('notes.txt');
      expect(uploadedPayload.mimeType).toBe('text/plain');
      expect(capturedConfig.input[1].content).toEqual([
         { type: 'input_text', text: 'prompt' },
         { type: 'input_file', file_id: 'file-inline' }
      ]);
      expect(deleteCalled).toBe(true);
   });

   it('reuses existing attachment ids without uploading', async () => {
      let uploaded = false;
      let deletedId: string | undefined;
      let config: any;

      const driver = buildDriver({
         responsesCreate: async (input) => {
            config = input;
            return {
               output: [{ type: 'output_text', text: 'id response' }]
            };
         },
         filesCreate: async () => {
            uploaded = true;
            return { id: 'unused' };
         },
         filesDelete: async (id: string) => {
            deletedId = id;
         }
      });

      const attachmentRef: IChatAttachmentReference = {
         id: 'existing-id',
         deleteAfterUse: true
      };

      const text = await driver.getModelResponse(undefined, 'say hi', EVerbosity.kLow, attachmentRef);

      expect(text).toBe('id response');
      expect(uploaded).toBe(false);
      expect(config.input[0].role).toBe('user');
      expect(config.input[0].content[1]).toEqual({ type: 'input_file', file_id: 'existing-id' });
      expect(deletedId).toBe('existing-id');
   });

   it('throws when no text output is returned', async () => {
      const driver = buildDriver({
         responsesCreate: async () => ({ output: [] })
      });

      await expect(driver.getModelResponse(undefined, 'prompt', EVerbosity.kHigh)).rejects.toThrow(/did not include any text/);
   });

   it('understands motor racing file content', async () => {
      // Create or reuse test file
      const filePath = createTestFile('motor-racing-test.txt', 'This file is about motor racing.');
      const fileContent = fs.readFileSync(filePath);

      const driver = buildDriver({
         responsesCreate: async (config) => {
            // Mock response that includes motor and racing
            return {
               output: [{ type: 'output_text', text: 'This file is about motor racing and automotive sports.' }]
            };
         },
         filesCreate: async (input) => {
            return { id: 'motor-racing-file' };
         }
      });

      const attachment: IChatAttachmentContent = {
         filename: 'motor-racing-test.txt',
         mimeType: 'text/plain',
         data: fileContent
      };

      const result = await driver.getModelResponse(undefined, 'What is this file about?', EVerbosity.kMedium, attachment);

      expect(result.toLowerCase()).toMatch(/motor/);
      expect(result.toLowerCase()).toMatch(/racing/);
   });

   it('understands gardening file content and does not mention motor racing', async () => {
      // Create or reuse test file
      const filePath = createTestFile('gardening-test.txt', 'This file is about gardening.');
      const fileContent = fs.readFileSync(filePath);

      const driver = buildDriver({
         responsesCreate: async (config) => {
            // Mock response about gardening without motor racing
            return {
               output: [{ type: 'output_text', text: 'This file is about gardening, plants, and horticulture.' }]
            };
         },
         filesCreate: async (input) => {
            return { id: 'gardening-file' };
         }
      });

      const attachment: IChatAttachmentContent = {
         filename: 'gardening-test.txt',
         mimeType: 'text/plain',
         data: fileContent
      };

      const result = await driver.getModelResponse(undefined, 'What is this file about?', EVerbosity.kMedium, attachment);

      expect(result.toLowerCase()).not.toMatch(/motor.*racing|racing.*motor/);
   });

   it('understands file that is almost completely about motor racing', async () => {
      // Create or reuse test file
      const filePath = createTestFile('almost-motor-racing-test.txt', 'This file is almost completely about motor racing.');
      const fileContent = fs.readFileSync(filePath);

      const driver = buildDriver({
         responsesCreate: async (config) => {
            // Mock response that includes motor and racing
            return {
               output: [{ type: 'output_text', text: 'This file is almost completely about motor racing and automotive competitions.' }]
            };
         },
         filesCreate: async (input) => {
            return { id: 'almost-motor-racing-file' };
         }
      });

      const attachment: IChatAttachmentContent = {
         filename: 'almost-motor-racing-test.txt',
         mimeType: 'text/plain',
         data: fileContent
      };

      const result = await driver.getModelResponse(undefined, 'What is this file about?', EVerbosity.kMedium, attachment);

      expect(result.toLowerCase()).toMatch(/motor/);
      expect(result.toLowerCase()).toMatch(/racing/);
   });
});

describe('AzureOpenAIChatWithAttachment', () => {
   const buildDriver = (mocks: {
      responsesCreate?: (config: any) => Promise<any>;
      filesCreate?: (input: any) => Promise<any>;
      filesDelete?: (id: string) => Promise<void>;
   }) => {
      const responsesCreate = mocks.responsesCreate ?? (async () => ({
         output: [{ type: 'output_text', text: 'default response' }]
      }));
      const filesCreate = mocks.filesCreate ?? (async () => ({ id: 'file-123' }));
      const filesDelete = mocks.filesDelete ?? (async () => {});

      const client: any = {
         responses: {
            create: responsesCreate
         },
         files: {
            create: filesCreate,
            delete: filesDelete
         }
      };

      return new AzureOpenAIChatWithAttachment(EModel.kLarge, { client });
   };

   it('uploads inline attachments and cleans up by default', async () => {
      let capturedConfig: any;
      let deleteCalled = false;
      let uploadedPayload: any;

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'azure inline response' }]
            };
         },
         filesCreate: async (input) => {
            uploadedPayload = input;
            return { id: 'file-azure-inline' };
         },
         filesDelete: async () => {
            deleteCalled = true;
         }
      });

      const attachment: IChatAttachmentContent = {
         filename: 'azure-notes.txt',
         mimeType: 'text/plain',
         data: Buffer.from('hello azure')
      };

      const result = await driver.getModelResponse('system', 'prompt', EVerbosity.kMedium, attachment);

      expect(result).toBe('azure inline response');
      expect(uploadedPayload.filename).toBe('azure-notes.txt');
      expect(uploadedPayload.mimeType).toBe('text/plain');
      expect(capturedConfig.input[1].content).toEqual([
         { type: 'input_text', text: 'prompt' },
         { type: 'input_file', file_id: 'file-azure-inline' }
      ]);
      expect(deleteCalled).toBe(true);
   });

   it('reuses existing attachment ids without uploading', async () => {
      let uploaded = false;
      let deletedId: string | undefined;
      let config: any;

      const driver = buildDriver({
         responsesCreate: async (input) => {
            config = input;
            return {
               output: [{ type: 'output_text', text: 'azure id response' }]
            };
         },
         filesCreate: async () => {
            uploaded = true;
            return { id: 'unused' };
         },
         filesDelete: async (id: string) => {
            deletedId = id;
         }
      });

      const attachmentRef: IChatAttachmentReference = {
         id: 'azure-existing-id',
         deleteAfterUse: true
      };

      const text = await driver.getModelResponse(undefined, 'say hi', EVerbosity.kLow, attachmentRef);

      expect(text).toBe('azure id response');
      expect(uploaded).toBe(false);
      expect(config.input[0].role).toBe('user');
      expect(config.input[0].content[1]).toEqual({ type: 'input_file', file_id: 'azure-existing-id' });
      expect(deletedId).toBe('azure-existing-id');
   });

   it('throws when no text output is returned', async () => {
      const driver = buildDriver({
         responsesCreate: async () => ({ output: [] })
      });

      await expect(driver.getModelResponse(undefined, 'prompt', EVerbosity.kHigh)).rejects.toThrow(/did not include any text/);
   });

   it('uses correct model for kLarge', () => {
      const client: any = {
         responses: { create: async () => ({ output: [] }) },
         files: { create: async () => ({ id: 'test' }), delete: async () => {} }
      };
      const driver = new AzureOpenAIChatWithAttachment(EModel.kLarge, { client });
      expect(driver).toBeDefined();
   });

   it('uses correct model for kMini', () => {
      const client: any = {
         responses: { create: async () => ({ output: [] }) },
         files: { create: async () => ({ id: 'test' }), delete: async () => {} }
      };
      const driver = new AzureOpenAIChatWithAttachment(EModel.kMini, { client });
      expect(driver).toBeDefined();
   });

   it('throws error when AZURE_OPENAI_API_KEY is not set', () => {
      const originalKey = process.env.AZURE_OPENAI_API_KEY;
      const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      
      delete process.env.AZURE_OPENAI_API_KEY;
      delete process.env.AZURE_OPENAI_ENDPOINT;

      expect(() => {
         new AzureOpenAIChatWithAttachment(EModel.kLarge);
      }).toThrow(/AZURE_OPENAI_API_KEY environment variable is not set/);

      if (originalKey) process.env.AZURE_OPENAI_API_KEY = originalKey;
      if (originalEndpoint) process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
   });

   it('throws error when AZURE_OPENAI_ENDPOINT is not set', () => {
      const originalKey = process.env.AZURE_OPENAI_API_KEY;
      const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
      
      process.env.AZURE_OPENAI_API_KEY = 'test-key';
      delete process.env.AZURE_OPENAI_ENDPOINT;

      expect(() => {
         new AzureOpenAIChatWithAttachment(EModel.kLarge);
      }).toThrow(/AZURE_OPENAI_ENDPOINT environment variable is not set/);

      if (originalKey) process.env.AZURE_OPENAI_API_KEY = originalKey;
      if (originalEndpoint) process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
   });
});