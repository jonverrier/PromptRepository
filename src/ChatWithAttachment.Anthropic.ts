/**
 * @module ChatWithAttachment.Anthropic
 *
 * Anthropic Claude implementation of IChatWithAttachmentDriver using inline
 * base64 PDFs, images, and plain-text documents via the Messages API.
 */
// Copyright (c) 2025, 2026 Jon Verrier

// @ts-ignore - @anthropic-ai/sdk is a peer dependency
import Anthropic from '@anthropic-ai/sdk';
import type {
   ContentBlockParam,
   DocumentBlockParam,
   ImageBlockParam,
   Message
} from '@anthropic-ai/sdk/resources/messages/messages';
import {
   EVerbosity,
   EModel,
   InvalidStateError,
   InvalidParameterError,
   InvalidOperationError,
   ConnectionError
} from './entry';
import {
   ChatAttachmentInput,
   IChatAttachmentContent,
   IChatAttachmentReference,
   IChatWithAttachmentDriver,
   IChatTableJson
} from './ChatWithAttachment';
import { retryWithExponentialBackoff, MAX_RETRIES } from './DriverHelpers';

const ANTHROPIC_MODELS = {
   LARGE: 'claude-opus-4-7',
   MINI: 'claude-sonnet-4-5'
} as const;

const DEFAULT_MAX_TOKENS_LOW = 2048;
const DEFAULT_MAX_TOKENS_MEDIUM = 4096;
const DEFAULT_MAX_TOKENS_HIGH = 8192;

const SUPPORTED_IMAGE_MEDIA_TYPES = [
   'image/jpeg',
   'image/png',
   'image/gif',
   'image/webp'
] as const;

type SupportedImageMediaType = typeof SUPPORTED_IMAGE_MEDIA_TYPES[number];

/**
 * Anthropic-backed chat driver with inline attachment support.
 */
export class AnthropicChatWithAttachment extends IChatWithAttachmentDriver {
   private readonly client: Anthropic;
   private readonly modelName: string;

   constructor(modelType: EModel, options?: { client?: Anthropic }) {
      super();
      this.modelName = modelType === EModel.kLarge ? ANTHROPIC_MODELS.LARGE : ANTHROPIC_MODELS.MINI;

      if (options?.client) {
         this.client = options.client;
      } else {
         const apiKey = process.env.ANTHROPIC_API_KEY;
         if (!apiKey) {
            throw new InvalidStateError('ANTHROPIC_API_KEY environment variable is not set');
         }
         this.client = new Anthropic({
            apiKey,
            maxRetries: 0
         });
      }
   }

   async getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      attachment?: ChatAttachmentInput,
      tableJson?: IChatTableJson
   ): Promise<string> {
      try {
         if (attachment && !this.isAttachmentContent(attachment)) {
            throw new InvalidParameterError(
               'Anthropic API does not support attachment references. ' +
               'Attachments must be provided inline with each request.'
            );
         }

         const content = this.buildUserContent(userPrompt, attachment, tableJson);
         const requestParams = {
            model: this.modelName,
            max_tokens: this.getMaxTokens(verbosity),
            messages: [{ role: 'user' as const, content }],
            ...(systemPrompt ? { system: systemPrompt } : {})
         };

         const response = await retryWithExponentialBackoff(
            () => this.client.messages.create(requestParams),
            MAX_RETRIES,
            'Anthropic'
         );

         const text = this.extractTextFromContent(response.content);
         if (!text) {
            throw new InvalidOperationError('Anthropic response did not include any text output');
         }
         return text;
      } catch (error) {
         if (
            error instanceof InvalidOperationError ||
            error instanceof InvalidParameterError
         ) {
            throw error;
         }
         if (error instanceof Error) {
            throw new ConnectionError(`Anthropic API error: ${error.message}`);
         }
         throw new ConnectionError('Unknown error occurred while calling Anthropic API');
      }
   }

   /**
    * Returns a synthetic reference for API parity; data stays inline per request.
    */
   async uploadAttachment(attachment: IChatAttachmentContent): Promise<IChatAttachmentReference> {
      this.toBase64(attachment.data);
      return {
         id: `anthropic-inline-${Date.now()}-${Math.random().toString(36).substring(7)}`
      };
   }

   async deleteAttachment(_attachmentId: string): Promise<void> {
      // Inline attachments are ephemeral; no remote Files API in v1.
   }

   private getMaxTokens(verbosity: EVerbosity): number {
      if (verbosity === EVerbosity.kHigh) {
         return DEFAULT_MAX_TOKENS_HIGH;
      }
      if (verbosity === EVerbosity.kMedium) {
         return DEFAULT_MAX_TOKENS_MEDIUM;
      }
      return DEFAULT_MAX_TOKENS_LOW;
   }

   private isAttachmentContent(attachment: ChatAttachmentInput): attachment is IChatAttachmentContent {
      return (attachment as IChatAttachmentContent).data !== undefined;
   }

   private buildUserContent(
      userPrompt: string,
      attachment?: IChatAttachmentContent,
      tableJson?: IChatTableJson
   ): ContentBlockParam[] {
      const blocks: ContentBlockParam[] = [];

      let text = userPrompt;
      if (tableJson) {
         text += this.formatTableJson(tableJson);
      }
      blocks.push({ type: 'text', text });

      if (attachment) {
         blocks.push(this.mapAttachmentToContentBlock(attachment));
      }

      return blocks;
   }

   private mapAttachmentToContentBlock(attachment: IChatAttachmentContent): ContentBlockParam {
      const mimeType = attachment.mimeType.toLowerCase();

      if (mimeType === 'application/pdf') {
         const doc: DocumentBlockParam = {
            type: 'document',
            source: {
               type: 'base64',
               media_type: 'application/pdf',
               data: this.toBase64(attachment.data)
            },
            title: attachment.filename
         };
         return doc;
      }

      if (SUPPORTED_IMAGE_MEDIA_TYPES.includes(mimeType as SupportedImageMediaType)) {
         const img: ImageBlockParam = {
            type: 'image',
            source: {
               type: 'base64',
               media_type: mimeType as SupportedImageMediaType,
               data: this.toBase64(attachment.data)
            }
         };
         return img;
      }

      if (mimeType.startsWith('text/')) {
         const doc: DocumentBlockParam = {
            type: 'document',
            source: {
               type: 'text',
               media_type: 'text/plain',
               data: this.toUtf8String(attachment.data)
            },
            title: attachment.filename
         };
         return doc;
      }

      throw new InvalidParameterError(
         `Unsupported attachment MIME type "${attachment.mimeType}". ` +
         'Supported types: application/pdf, image/jpeg, image/png, image/gif, image/webp, text/*'
      );
   }

   private toBase64(
      data: ArrayBuffer | Buffer | Uint8Array | string
   ): string {
      if (Buffer.isBuffer(data)) {
         return data.toString('base64');
      }
      if (data instanceof ArrayBuffer) {
         return Buffer.from(data).toString('base64');
      }
      if (data instanceof Uint8Array) {
         return Buffer.from(data).toString('base64');
      }
      if (typeof data === 'string') {
         return Buffer.from(data, 'utf8').toString('base64');
      }
      throw new InvalidParameterError(`Unsupported attachment data type: ${typeof data}`);
   }

   private toUtf8String(
      data: ArrayBuffer | Buffer | Uint8Array | string
   ): string {
      if (typeof data === 'string') {
         return data;
      }
      if (Buffer.isBuffer(data)) {
         return data.toString('utf8');
      }
      if (data instanceof ArrayBuffer) {
         return Buffer.from(data).toString('utf8');
      }
      if (data instanceof Uint8Array) {
         return Buffer.from(data).toString('utf8');
      }
      throw new InvalidParameterError(`Unsupported attachment data type: ${typeof data}`);
   }

   private extractTextFromContent(content: Message['content']): string {
      const parts: string[] = [];
      for (const block of content) {
         if (block.type === 'text') {
            parts.push(block.text);
         }
      }
      return parts.join('');
   }

   private formatTableJson(tableJson: IChatTableJson): string {
      const lines: string[] = [];

      lines.push(`\n[Table Data: ${tableJson.name}]`);

      if (tableJson.description) {
         lines.push(`Description: ${tableJson.description}`);
      }

      lines.push('Table JSON:');
      lines.push(JSON.stringify(tableJson.data, null, 2));

      return lines.join('\n');
   }
}
