import { describe, it, after } from 'mocha';
import { expect } from 'expect';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OpenAIChatWithAttachment } from '../src/ChatWithAttachment.OpenAI';
import { AzureOpenAIChatWithAttachment } from '../src/ChatWithAttachment.AzureOpenAI';
import { EVerbosity, IChatAttachmentContent, IChatAttachmentReference, EModel, IChatTableJson } from '../src/entry';

describe('OpenAIChatWithAttachment', () => {
   // Known test file names for cleanup
   const testFileNames: string[] = [];

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

   it('includes table JSON in user content when provided', async () => {
      let capturedConfig: any;
      const tableJson: IChatTableJson = {
         name: 'Test Tables',
         description: 'Test table data',
         data: [
            { table: 'Revenue', rows: [{ quarter: 'Q1', value: 1000 }] }
         ]
      };

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'table response' }]
            };
         }
      });

      const result = await driver.getModelResponse(
         undefined,
         'Analyze the tables',
         EVerbosity.kMedium,
         undefined,
         tableJson
      );

      expect(result).toBe('table response');
      expect(capturedConfig.input[0].content).toHaveLength(2);
      expect(capturedConfig.input[0].content[0]).toEqual({
         type: 'input_text',
         text: 'Analyze the tables'
      });
      // Check that table JSON is included as input_text
      expect(capturedConfig.input[0].content[1].type).toBe('input_text');
      expect(capturedConfig.input[0].content[1].text).toContain('[Table Data: Test Tables]');
      expect(capturedConfig.input[0].content[1].text).toContain('Description: Test table data');
      expect(capturedConfig.input[0].content[1].text).toContain('Table JSON:');
   });

   it('includes table JSON with attachment in user content', async () => {
      let capturedConfig: any;
      const tableJson: IChatTableJson = {
         name: 'Financial Tables',
         data: { revenue: 5000, expenses: 3000 }
      };

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'combined response' }]
            };
         },
         filesCreate: async () => ({ id: 'file-123' }),
         filesDelete: async () => {}
      });

      const attachment: IChatAttachmentContent = {
         filename: 'report.pdf',
         mimeType: 'application/pdf',
         data: Buffer.from('test pdf')
      };

      const result = await driver.getModelResponse(
         'System prompt',
         'Analyze both',
         EVerbosity.kMedium,
         attachment,
         tableJson
      );

      expect(result).toBe('combined response');
      // Should have system prompt, user prompt, file, and table JSON
      expect(capturedConfig.input[0].role).toBe('system');
      expect(capturedConfig.input[1].role).toBe('user');
      expect(capturedConfig.input[1].content).toHaveLength(3);
      expect(capturedConfig.input[1].content[0].type).toBe('input_text');
      expect(capturedConfig.input[1].content[1].type).toBe('input_file');
      expect(capturedConfig.input[1].content[2].type).toBe('input_text');
      expect(capturedConfig.input[1].content[2].text).toContain('[Table Data: Financial Tables]');
   });

   it('formats table JSON without description correctly', async () => {
      let capturedConfig: any;
      const tableJson: IChatTableJson = {
         name: 'Simple Table',
         data: { value: 42 }
      };

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'response' }]
            };
         }
      });

      await driver.getModelResponse(undefined, 'prompt', EVerbosity.kMedium, undefined, tableJson);

      const tableText = capturedConfig.input[0].content[1].text;
      expect(tableText).toContain('[Table Data: Simple Table]');
      expect(tableText).not.toContain('Description:');
      expect(tableText).toContain('Table JSON:');
      expect(tableText).toContain('"value": 42');
   });

   // Note: Motor racing/gardening content understanding tests and markdown upload tests
   // have been moved to test/chatwithattachment.integration.test.ts to test with real API
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

   it('includes table JSON in user content when provided', async () => {
      let capturedConfig: any;
      const tableJson: IChatTableJson = {
         name: 'Azure Test Tables',
         description: 'Azure test table data',
         data: [
            { table: 'Sales', rows: [{ month: 'January', amount: 5000 }] }
         ]
      };

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'azure table response' }]
            };
         }
      });

      const result = await driver.getModelResponse(
         undefined,
         'Analyze the tables',
         EVerbosity.kMedium,
         undefined,
         tableJson
      );

      expect(result).toBe('azure table response');
      expect(capturedConfig.input[0].content).toHaveLength(2);
      expect(capturedConfig.input[0].content[1].text).toContain('[Table Data: Azure Test Tables]');
      expect(capturedConfig.input[0].content[1].text).toContain('Description: Azure test table data');
   });

   it('includes table JSON with attachment in user content', async () => {
      let capturedConfig: any;
      const tableJson: IChatTableJson = {
         name: 'Azure Financial Tables',
         data: { profit: 2000 }
      };

      const driver = buildDriver({
         responsesCreate: async (config) => {
            capturedConfig = config;
            return {
               output: [{ type: 'output_text', text: 'azure combined response' }]
            };
         },
         filesCreate: async () => ({ id: 'azure-file-123' }),
         filesDelete: async () => {}
      });

      const attachment: IChatAttachmentContent = {
         filename: 'azure-report.pdf',
         mimeType: 'application/pdf',
         data: Buffer.from('azure test pdf')
      };

      const result = await driver.getModelResponse(
         'Azure system prompt',
         'Analyze both',
         EVerbosity.kMedium,
         attachment,
         tableJson
      );

      expect(result).toBe('azure combined response');
      expect(capturedConfig.input[1].content).toHaveLength(3);
      expect(capturedConfig.input[1].content[2].text).toContain('[Table Data: Azure Financial Tables]');
   });
});