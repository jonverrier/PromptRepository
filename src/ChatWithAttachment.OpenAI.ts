/**
 * @module ChatWithAttachment.OpenAI
 *
 * Provides an OpenAI implementation of the IChatWithAttachment
 * abstraction. The driver uploads attachments when required and
 * executes prompts using the Responses API.
 */

import OpenAI from 'openai';
import { EVerbosity } from './entry';
import { ChatAttachmentInput, IChatAttachmentContent, IChatAttachmentReference, IChatWithAttachment } from './ChatWithAttachment';

const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Maps library verbosity settings to OpenAI verbosity strings.
 */
const VERBOSITY_MAP: Record<EVerbosity, 'low' | 'medium' | 'high'> = {
   [EVerbosity.kLow]: 'low',
   [EVerbosity.kMedium]: 'medium',
   [EVerbosity.kHigh]: 'high'
};

/**
 * OpenAI-backed chat driver with attachment support.
 */
export class OpenAIChatWithAttachment extends IChatWithAttachment {
   private readonly openai: OpenAI;
   private readonly model: string;

   constructor(options?: { client?: OpenAI; model?: string }) {
      super();
      this.model = options?.model ?? DEFAULT_MODEL;

      if (options?.client) {
         this.openai = options.client;
      } else {
         const apiKey = process.env.OPENAI_API_KEY;
         if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
         }
         this.openai = new OpenAI({ apiKey });
      }
   }

   async getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      attachment?: ChatAttachmentInput
   ): Promise<string> {
      let fileId: string | undefined;
      let shouldDeleteAfterUse = false;

      if (attachment) {
         if (this.isAttachmentContent(attachment)) {
            const reference = await this.uploadAttachment(attachment);
            fileId = reference.id;
            shouldDeleteAfterUse = attachment.deleteAfterUse ?? true;
         } else {
            fileId = attachment.id;
            shouldDeleteAfterUse = attachment.deleteAfterUse ?? false;
         }
      }

      try {
         const input = this.buildInput(systemPrompt, userPrompt, fileId);
         const response = await this.openai.responses.create({
            model: this.model,
            input,
            text: { verbosity: VERBOSITY_MAP[verbosity] }
         });

         const outputText = this.extractTextFromOutput((response as any).output ?? []);
         if (!outputText) {
            throw new Error('OpenAI response did not include any text output');
         }
         return outputText;
      } finally {
         if (shouldDeleteAfterUse && fileId) {
            try {
               await this.deleteAttachment(fileId);
            } catch (error) {
               // Swallow deletion errors to avoid masking the primary response.
               console.warn('Failed to delete attachment', error);
            }
         }
      }
   }

   async uploadAttachment(attachment: IChatAttachmentContent): Promise<IChatAttachmentReference> {
      const response = await this.openai.files.create({
         file: attachment.data as any,
         purpose: 'assistants',
         filename: attachment.filename,
         mimeType: attachment.mimeType
      } as any);

      return {
         id: (response as any).id,
      };
   }

   async deleteAttachment(attachmentId: string): Promise<void> {
      await this.openai.files.delete(attachmentId);
   }

   private isAttachmentContent(attachment: ChatAttachmentInput): attachment is IChatAttachmentContent {
      return (attachment as IChatAttachmentContent).data !== undefined;
   }

   private buildInput(systemPrompt: string | undefined, userPrompt: string, fileId: string | undefined) {
      const input: any[] = [];

      if (systemPrompt) {
         input.push({
            role: 'system',
            content: [
               {
                  type: 'input_text',
                  text: systemPrompt
               }
            ]
         });
      }

      const userContent: any[] = [
         {
            type: 'input_text',
            text: userPrompt
         }
      ];

      if (fileId) {
         userContent.push({
            type: 'input_file',
            file_id: fileId
         });
      }

      input.push({
         role: 'user',
         content: userContent
      });

      return input;
   }

   private extractTextFromOutput(outputArr: any[]): string | null {
      for (const item of outputArr) {
         if (!item) {
            continue;
         }

         if (item.type === 'output_text' && typeof item.text === 'string') {
            return item.text;
         }

         if (item.type === 'text' && typeof item.text === 'string') {
            return item.text;
         }

         if (item.type === 'message' && item.content) {
            if (typeof item.content === 'string') {
               return item.content;
            }

            if (Array.isArray(item.content)) {
               for (const contentItem of item.content) {
                  if ((contentItem.type === 'text' || contentItem.type === 'output_text') && typeof contentItem.text === 'string') {
                     return contentItem.text;
                  }
               }
            }
         }

         if (typeof item === 'string') {
            return item;
         }

         if (item.content && typeof item.content === 'string') {
            return item.content;
         }
      }

      return null;
   }
}