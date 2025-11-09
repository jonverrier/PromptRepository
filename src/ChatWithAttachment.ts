/**
 * @module ChatWithAttachment
 *
 * Defines an abstract interface for chat drivers that support
 * optional file attachments alongside the conversation prompts.
 */

import { EVerbosity } from './entry';

/**
 * Union of supported attachment payloads.
 * This type allows either raw file content or a reference to an
 * already uploaded attachment.
 */
export type ChatAttachmentInput = IChatAttachmentContent | IChatAttachmentReference;

/**
 * Represents a file attachment provided inline with the request.
 */
export interface IChatAttachmentContent {
   /** Name of the file. */
   filename: string;
   /** Mime type describing the file contents. */
   mimeType: string;
   /** Binary payload for the file. */
   data: ArrayBuffer | Buffer | Uint8Array | string;
   /**
    * If true the underlying implementation should delete the file
    * from the provider after the request completes. Defaults to true
    * for inline uploads.
    */
   deleteAfterUse?: boolean;
}

/**
 * Reference to a file that has already been uploaded to the provider.
 */
export interface IChatAttachmentReference {
   /** Provider specific identifier for the uploaded file. */
   id: string;
   /**
    * Optional hint indicating whether the implementation should delete
    * the remote file after completing the request. Defaults to false.
    */
   deleteAfterUse?: boolean;
}

/**
 * Abstract interface for chat drivers that can operate with file attachments.
 *
 * Implementations may choose to upload files on-demand when provided via
 * {@link IChatAttachmentContent} or reference existing uploads via
 * {@link IChatAttachmentReference}.
 */
export abstract class IChatWithAttachment {
   protected constructor() {}

   /**
    * Executes a model call with optional file attachment support.
    *
    * @param systemPrompt Optional system level instructions.
    * @param userPrompt Required user prompt for the turn.
    * @param verbosity Requested verbosity level for the response.
    * @param attachment Optional attachment provided inline or by reference.
    */
   abstract getModelResponse(
      systemPrompt: string | undefined,
      userPrompt: string,
      verbosity: EVerbosity,
      attachment?: ChatAttachmentInput
   ): Promise<string>;

   /**
    * Uploads an attachment and returns a provider specific reference.
    */
   abstract uploadAttachment(attachment: IChatAttachmentContent): Promise<IChatAttachmentReference>;

   /**
    * Deletes a previously uploaded attachment using its identifier.
    */
   abstract deleteAttachment(attachmentId: string): Promise<void>;
}