/**
 * @module Sanitize
 * 
 * Sanitization functions for input and output strings.
 */
// Copyright (c) 2025 Jon Verrier

/**
 * Sanitizes a string input by removing potentially dangerous characters
 * @param input The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInputString(input: string | null | undefined): string {
    if (!input) return '';
    // Remove control characters and HTML tags
    return input.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
                .replace(/<[^>]*>/g, '')
                .trim();
}

/**
 * Sanitizes a string by removing potentially dangerous characters and sensitive information
 * @param input The string to sanitize
 * @param preserveLineFeeds Optional flag to preserve line feeds (\n) and carriage returns (\r). Defaults to false.
 * @returns A sanitized string with control characters, HTML tags, and sensitive data (emails, credit cards, phone numbers) removed
 */
export function sanitizeOutputString (input: string | null | undefined, preserveLineFeeds: boolean = false): string {
   if (!input) return '';
   
   // Create control character regex based on preserveLineFeeds flag
   const controlCharRegex = preserveLineFeeds 
       ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g  // Exclude \x09 (tab), \x0A (LF), \x0D (CR)
       : /[\x00-\x1F\x7F-\x9F]/g;                    // Remove all control characters
   
   return input
       .replace(controlCharRegex, '') // Remove control characters (conditionally preserving line feeds)
       .replace(/<[^>]*>/g, '') // Remove HTML tags
       .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Replace email addresses
       .replace(/[a-zA-Z0-9._%+-]+\\@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]') // Replace escaped email addresses
       .replace(/\b\d{16,19}\b/g, '[CARD]') // Replace credit card numbers
       .replace(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})(?:\s?(?:ext|x|extension)\.?\s?\d+)?/g, '[PHONE]') // Replace US phone numbers
       .replace(/\b0\d{3}\s\d{4}\s\d{3}\b/g, '[PHONE]') // Mobile phone numbers formatted like '0758 4323 309'
       .replace(/\b0\d{2}\s\d{4}\s\d{4}\b/g, '[PHONE]') // Replace UK phone numbers like '020 4576 2064'
       .replace(/\b0\d{4}\s\d{6}\b/g, '[PHONE]') // Replace UK phone numbers like '01246 866275'
       .trim();
}