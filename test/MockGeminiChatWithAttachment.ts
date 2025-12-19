/**
 * @module MockGeminiChatWithAttachment
 * 
 * Mock implementation of GoogleGeminiChatWithAttachment for testing.
 */
// Copyright (c) 2025 Jon Verrier

import { EModel, EVerbosity } from '../src/entry';
import { GoogleGeminiChatWithAttachment } from '../src/ChatWithAttachment.GoogleGemini';
import { ChatAttachmentInput, IChatTableJson } from '../src/ChatWithAttachment';

/**
 * Mock class for testing Gemini ChatWithAttachment driver
 */
export class MockGeminiChatWithAttachment extends GoogleGeminiChatWithAttachment {
   private mockGenerateContent?: (config: any) => Promise<any>;

   constructor(modelType: EModel = EModel.kLarge) {
      super(modelType);
   }

   /**
    * Set mock behavior for generateContent
    */
   setMockGenerateContent(mockFn: (config: any) => Promise<any>): void {
      this.mockGenerateContent = mockFn;
   }

   /**
    * Override getModelResponse to use mock
    */
   async getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      attachment?: ChatAttachmentInput,
      tableJson?: IChatTableJson
   ): Promise<string> {
      if (this.mockGenerateContent) {
         const model = (this as any).genAI.getGenerativeModel({ model: (this as any).modelName });
         const parts = (this as any).buildParts(systemPrompt, userPrompt, attachment, tableJson);
         const result = await this.mockGenerateContent({ contents: [{ role: 'user', parts }] });
         return result.response?.text() || 'mock response';
      }

      // Otherwise call parent implementation
      return super.getModelResponse(systemPrompt, userPrompt, verbosity, attachment, tableJson);
   }

   /**
    * Reset all mocks to defaults
    */
   resetMocks(): void {
      this.mockGenerateContent = undefined;
   }
}

