/**
 * @module DriverHelpers
 * 
 * Shared utilities and helpers for OpenAI model drivers.
 * Provides common functionality for retry logic, error handling, and backoff strategies.
 */
// Copyright (c) 2025 Jon Verrier

export const MAX_RETRIES = 5;
export const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Implements exponential backoff delay calculation
 * @param retryCount The current retry attempt number (0-based)
 * @returns Promise that resolves after the calculated delay
 */
export async function exponentialBackoff(retryCount: number): Promise<void> {
   const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
   await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Executes an operation with exponential backoff retry logic
 * Handles rate limiting and other retryable errors from OpenAI API
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
         // Handle rate limiting with exponential backoff
         if (error?.status === 429 && retryCount < maxRetries) {
            await exponentialBackoff(retryCount);
            retryCount++;
            continue;
         }
         
         // Handle OpenAI refusal errors - these should not be retried
         if (error?.status === 400) {
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
         
         // Handle other 4xx errors that indicate refusal
         if (error?.status >= 400 && error?.status < 500) {
            if (error?.message?.toLowerCase().includes('refuse') ||
                error?.message?.toLowerCase().includes('cannot') ||
                error?.message?.toLowerCase().includes('unable') ||
                error?.message?.toLowerCase().includes('forbidden')) {
               throw new Error(`OpenAI refused request (${error.status}): ${error?.message || 'Request was refused'}`);
            }
         }
         
         throw error;
      }
   }
} 