/**
 * Provides type-safe assertion utilities for runtime checks.
 * 
 * This module contains a collection of assertion functions that help verify
 * runtime conditions and provide TypeScript type narrowing. Each function
 * throws an ReferenceError when the condition is not met.
 * 
 * @module Asserts
 */

// Copyright (c) 2025 Jon Verrier

/**
 * Represents an error thrown when an invalid parameter is encountered.
 * @param {string} message - The error message describing the invalid parameter.
 */
export class InvalidParameterError extends Error {
   constructor(message?: string) {
      super(message);
      // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
      Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
      this.name = InvalidParameterError.name; // stack traces display correctly now
   }
}

/**
 * Represents an error thrown when an invalid operation is attempted.
 * @param {string} message - The error message describing the invalid operation.
 */
export class InvalidOperationError extends Error {
   constructor(message?: string) {
      super(message);
      // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
      Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
      this.name = InvalidOperationError.name; // stack traces display correctly now
   }
}

export const throwIfUndefined: <T, >(x: T | undefined) => asserts x is T = x => {
   if (typeof x === "undefined") throw new ReferenceError ("Object is undefined.");
}

export const throwIfNull: <T, >(x: T | null) => asserts x is T = x => {
   if (x === null) throw new ReferenceError ("Object is null.");
}

export const throwIfFalse: (x: boolean) => asserts x is true = x => {
   if (!x) throw new ReferenceError ("Value is false.");
}
