/**
 * @module DriverHelpers
 * 
 * Shared utilities and helpers for OpenAI model drivers.
 * Provides common functionality for retry logic, error handling, and backoff strategies.
 * Includes rate limit detection with Retry-After header support and exponential backoff.
 */
// Copyright (c) 2025 Jon Verrier

export const MAX_RETRIES = 5;
export const INITIAL_RETRY_DELAY = 1000; // 1 second
export const MAX_RETRY_DELAY = 60000; // 60 seconds maximum (prevents excessive wait times)

/**
 * Implements exponential backoff delay calculation
 * @param retryCount The current retry attempt number (0-based)
 * @returns Promise that resolves after the calculated delay
 */
export async function exponentialBackoff(retryCount: number): Promise<void> {
   const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
   await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Extracts HTTP status code from error in various formats
 * Handles multiple error formats from OpenAI SDK
 * @param error The error to extract status from
 * @returns The HTTP status code, or null if not found
 */
function getErrorStatus(error: any): number | null {
   const status = error?.status || 
                  error?.statusCode || 
                  error?.response?.status || 
                  error?.response?.statusCode ||
                  (error?.code && typeof error.code === 'number' ? error.code : null);
   
   if (status === null || status === undefined) {
      return null;
   }
   
   // Convert string status codes to numbers
   const numericStatus = typeof status === 'string' ? parseInt(status, 10) : status;
   return isNaN(numericStatus) ? null : numericStatus;
}

/**
 * Checks if an error is a rate limit error (429 status code)
 * Handles multiple error formats from OpenAI SDK
 * @param error The error to check
 * @returns true if the error is a rate limit error
 */
function isRateLimitError(error: any): boolean {
   const status = getErrorStatus(error);
   return status === 429;
}

/**
 * Checks if an error is a transient server error (5xx status codes)
 * These errors are typically retryable
 * @param error The error to check
 * @returns true if the error is a transient server error
 */
function isTransientServerError(error: any): boolean {
   const status = getErrorStatus(error);
   return status !== null && status >= 500 && status < 600;
}

/**
 * Parses Retry-After header from error response
 * Returns the retry delay in milliseconds, or null if not available
 * @param error The error object that may contain retry-after information
 * @returns Retry delay in milliseconds, or null if not available
 */
function parseRetryAfter(error: any): number | null {
   // Check various locations for retry-after header
   const retryAfter = error?.headers?.['retry-after'] ||
                     error?.headers?.['Retry-After'] ||
                     error?.response?.headers?.['retry-after'] ||
                     error?.response?.headers?.['Retry-After'] ||
                     error?.retry_after ||
                     error?.retryAfter;
   
   if (!retryAfter) {
      return null;
   }
   
   // Parse as seconds (most common format)
   const seconds = parseInt(String(retryAfter), 10);
   if (!isNaN(seconds) && seconds > 0) {
      // Add small jitter (10%) to avoid thundering herd
      // Jitter is calculated in milliseconds to match the retry delay unit
      const jitter = seconds * 0.1 * Math.random() * 1000;
      return Math.min((seconds * 1000) + jitter, MAX_RETRY_DELAY);
   }
   
   return null;
}

/**
 * Executes an operation with exponential backoff retry logic
 * Handles rate limiting and other retryable errors from OpenAI API
 * Automatically detects rate limit errors and respects Retry-After headers
 * 
 * @param operation The async operation to execute
 * @param maxRetries Maximum number of retry attempts (default: MAX_RETRIES)
 * @returns Promise resolving to the operation result
 * @throws Error for non-retryable errors or after max retries exceeded
 */
export async function retryWithExponentialBackoff<T>(
   operation: () => Promise<T>,
   maxRetries: number = MAX_RETRIES
): Promise<T> {
   let retryCount = 0;
   
   while (true) {
      try {
         return await operation();
      } catch (error: any) {
         const status = getErrorStatus(error);
         
         // Handle rate limiting with exponential backoff
         if (isRateLimitError(error) && retryCount < maxRetries) {
            // Check for Retry-After header first
            const retryAfterMs = parseRetryAfter(error);
            
            if (retryAfterMs !== null) {
               // Use Retry-After header value if available
               console.warn(`Rate limit detected (429). Retrying after ${Math.round(retryAfterMs)}ms (attempt ${retryCount + 1}/${maxRetries})`);
               await new Promise(resolve => setTimeout(resolve, retryAfterMs));
            } else {
               // Fall back to exponential backoff
               const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
               console.warn(`Rate limit detected (429). Retrying after ${delay}ms (exponential backoff, attempt ${retryCount + 1}/${maxRetries})`);
               await exponentialBackoff(retryCount);
            }
            
            retryCount++;
            continue;
         }
         
         // Handle transient server errors (5xx) with exponential backoff
         if (isTransientServerError(error) && retryCount < maxRetries) {
            const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, retryCount), MAX_RETRY_DELAY);
            console.warn(`Transient server error (${status}). Retrying after ${delay}ms (exponential backoff, attempt ${retryCount + 1}/${maxRetries})`);
            await exponentialBackoff(retryCount);
            retryCount++;
            continue;
         }
         
         // Handle OpenAI refusal errors - these should not be retried
         if (status === 400) {
            // Check for specific refusal error types
            if (error?.error?.type === 'content_filter' || 
                error?.error?.code === 'content_filter' ||
                error?.message?.toLowerCase().includes('content filter')) {
               throw new Error(`OpenAI content filter triggered: ${error?.error?.message || error?.message || 'Content violates OpenAI safety policies'}`);
            }
            
            if (error?.error?.type === 'safety' || 
                error?.error?.code === 'safety' ||
                error?.message?.toLowerCase().includes('safety')) {
               throw new Error(`OpenAI safety system triggered: ${error?.error?.message || error?.message || 'Content violates OpenAI safety guidelines'}`);
            }
            
            if (error?.error?.type === 'invalid_request' && 
                (error?.error?.message?.toLowerCase().includes('refuse') ||
                 error?.error?.message?.toLowerCase().includes('cannot') ||
                 error?.error?.message?.toLowerCase().includes('unable'))) {
               throw new Error(`OpenAI refused request: ${error?.error?.message || error?.message || 'Request was refused by OpenAI'}`);
            }
         }
         
         // Handle other 4xx errors that indicate refusal (but not 429, which is handled above)
         if (status !== null && status >= 400 && status < 500 && status !== 429) {
            if (error?.message?.toLowerCase().includes('refuse') ||
                error?.message?.toLowerCase().includes('cannot') ||
                error?.message?.toLowerCase().includes('unable') ||
                error?.message?.toLowerCase().includes('forbidden')) {
               throw new Error(`OpenAI refused request (${status}): ${error?.message || 'Request was refused'}`);
            }
         }
         
         throw error;
      }
   }
} 