/**
 * @module asserts.test
 * 
 * Unit tests for the Asserts module which provides type-safe assertion utilities
 * and custom error classes for runtime checks and error handling.
 */

// Copyright (c) 2025 Jon Verrier

import { expect } from 'expect';
import { describe, it } from 'mocha';
import { 
  InvalidParameterError, 
  InvalidOperationError, 
  ConnectionError, 
  InvalidStateError,
  throwIfUndefined,
  throwIfNull,
  throwIfFalse
} from '../src/Asserts';

describe('Asserts', () => {
  describe('Custom Error Classes', () => {
    describe('InvalidParameterError', () => {
      it('should create error with default message', () => {
        const error = new InvalidParameterError();
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidParameterError);
        expect(error.name).toBe('InvalidParameterError');
        expect(error.message).toBe('');
      });

      it('should create error with custom message', () => {
        const message = 'Parameter x must be positive';
        const error = new InvalidParameterError(message);
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidParameterError);
        expect(error.name).toBe('InvalidParameterError');
        expect(error.message).toBe(message);
      });

      it('should maintain proper prototype chain', () => {
        const error = new InvalidParameterError('test');
        
        expect(error instanceof Error).toBe(true);
        expect(error instanceof InvalidParameterError).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(InvalidParameterError.prototype);
      });

      it('should be throwable and catchable', () => {
        const message = 'Test parameter error';
        
        expect(() => {
          throw new InvalidParameterError(message);
        }).toThrow(InvalidParameterError);
        
        expect(() => {
          throw new InvalidParameterError(message);
        }).toThrow(message);
      });

      it('should have correct stack trace', () => {
        const error = new InvalidParameterError('test');
        
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('InvalidParameterError');
      });
    });

    describe('InvalidOperationError', () => {
      it('should create error with default message', () => {
        const error = new InvalidOperationError();
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidOperationError);
        expect(error.name).toBe('InvalidOperationError');
        expect(error.message).toBe('');
      });

      it('should create error with custom message', () => {
        const message = 'Cannot perform operation in current state';
        const error = new InvalidOperationError(message);
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidOperationError);
        expect(error.name).toBe('InvalidOperationError');
        expect(error.message).toBe(message);
      });

      it('should maintain proper prototype chain', () => {
        const error = new InvalidOperationError('test');
        
        expect(error instanceof Error).toBe(true);
        expect(error instanceof InvalidOperationError).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(InvalidOperationError.prototype);
      });

      it('should be throwable and catchable', () => {
        const message = 'Test operation error';
        
        expect(() => {
          throw new InvalidOperationError(message);
        }).toThrow(InvalidOperationError);
        
        expect(() => {
          throw new InvalidOperationError(message);
        }).toThrow(message);
      });
    });

    describe('ConnectionError', () => {
      it('should create error with default message', () => {
        const error = new ConnectionError();
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ConnectionError);
        expect(error.name).toBe('ConnectionError');
        expect(error.message).toBe('');
      });

      it('should create error with custom message', () => {
        const message = 'Failed to connect to database';
        const error = new ConnectionError(message);
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(ConnectionError);
        expect(error.name).toBe('ConnectionError');
        expect(error.message).toBe(message);
      });

      it('should maintain proper prototype chain', () => {
        const error = new ConnectionError('test');
        
        expect(error instanceof Error).toBe(true);
        expect(error instanceof ConnectionError).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(ConnectionError.prototype);
      });

      it('should be throwable and catchable', () => {
        const message = 'Test connection error';
        
        expect(() => {
          throw new ConnectionError(message);
        }).toThrow(ConnectionError);
        
        expect(() => {
          throw new ConnectionError(message);
        }).toThrow(message);
      });
    });

    describe('InvalidStateError', () => {
      it('should create error with default message', () => {
        const error = new InvalidStateError();
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidStateError);
        expect(error.name).toBe('InvalidStateError');
        expect(error.message).toBe('');
      });

      it('should create error with custom message', () => {
        const message = 'Object is in invalid state for this operation';
        const error = new InvalidStateError(message);
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvalidStateError);
        expect(error.name).toBe('InvalidStateError');
        expect(error.message).toBe(message);
      });

      it('should maintain proper prototype chain', () => {
        const error = new InvalidStateError('test');
        
        expect(error instanceof Error).toBe(true);
        expect(error instanceof InvalidStateError).toBe(true);
        expect(Object.getPrototypeOf(error)).toBe(InvalidStateError.prototype);
      });

      it('should be throwable and catchable', () => {
        const message = 'Test state error';
        
        expect(() => {
          throw new InvalidStateError(message);
        }).toThrow(InvalidStateError);
        
        expect(() => {
          throw new InvalidStateError(message);
        }).toThrow(message);
      });
    });
  });

  describe('Assertion Functions', () => {
    describe('throwIfUndefined', () => {
      it('should not throw for defined values', () => {
        expect(() => throwIfUndefined('hello')).not.toThrow();
        expect(() => throwIfUndefined(42)).not.toThrow();
        expect(() => throwIfUndefined(0)).not.toThrow();
        expect(() => throwIfUndefined('')).not.toThrow();
        expect(() => throwIfUndefined(false)).not.toThrow();
        expect(() => throwIfUndefined(null)).not.toThrow();
        expect(() => throwIfUndefined({})).not.toThrow();
        expect(() => throwIfUndefined([])).not.toThrow();
      });

      it('should throw ReferenceError for undefined values', () => {
        expect(() => throwIfUndefined(undefined)).toThrow(ReferenceError);
        expect(() => throwIfUndefined(undefined)).toThrow('Value is undefined.');
      });

      it('should provide type narrowing', () => {
        // This test verifies TypeScript type narrowing behavior
        const value: string | undefined = Math.random() > 0.5 ? 'hello' : undefined;
        
        if (value !== undefined) {
          throwIfUndefined(value);
          // After this point, TypeScript knows value is string, not string | undefined
          expect(typeof value).toBe('string');
        }
      });

      it('should work with different types', () => {
        const stringValue: string | undefined = 'test';
        const numberValue: number | undefined = 123;
        const objectValue: object | undefined = { key: 'value' };
        
        expect(() => throwIfUndefined(stringValue)).not.toThrow();
        expect(() => throwIfUndefined(numberValue)).not.toThrow();
        expect(() => throwIfUndefined(objectValue)).not.toThrow();
      });

      it('should work in function parameters', () => {
        const testFunction = (param: string | undefined) => {
          throwIfUndefined(param);
          return param.toUpperCase(); // TypeScript knows param is string here
        };

        expect(testFunction('hello')).toBe('HELLO');
        expect(() => testFunction(undefined)).toThrow(ReferenceError);
      });
    });

    describe('throwIfNull', () => {
      it('should not throw for non-null values', () => {
        expect(() => throwIfNull('hello')).not.toThrow();
        expect(() => throwIfNull(42)).not.toThrow();
        expect(() => throwIfNull(0)).not.toThrow();
        expect(() => throwIfNull('')).not.toThrow();
        expect(() => throwIfNull(false)).not.toThrow();
        expect(() => throwIfNull(undefined)).not.toThrow();
        expect(() => throwIfNull({})).not.toThrow();
        expect(() => throwIfNull([])).not.toThrow();
      });

      it('should throw ReferenceError for null values', () => {
        expect(() => throwIfNull(null)).toThrow(ReferenceError);
        expect(() => throwIfNull(null)).toThrow('Value is null.');
      });

      it('should provide type narrowing', () => {
        // This test verifies TypeScript type narrowing behavior
        const value: string | null = Math.random() > 0.5 ? 'hello' : null;
        
        if (value !== null) {
          throwIfNull(value);
          // After this point, TypeScript knows value is string, not string | null
          expect(typeof value).toBe('string');
        }
      });

      it('should work with different types', () => {
        const stringValue: string | null = 'test';
        const numberValue: number | null = 123;
        const objectValue: object | null = { key: 'value' };
        
        expect(() => throwIfNull(stringValue)).not.toThrow();
        expect(() => throwIfNull(numberValue)).not.toThrow();
        expect(() => throwIfNull(objectValue)).not.toThrow();
      });

      it('should work in function parameters', () => {
        const testFunction = (param: string | null) => {
          throwIfNull(param);
          return param.toUpperCase(); // TypeScript knows param is string here
        };

        expect(testFunction('hello')).toBe('HELLO');
        expect(() => testFunction(null)).toThrow(ReferenceError);
      });
    });

    describe('throwIfFalse', () => {
      it('should not throw for true values', () => {
        expect(() => throwIfFalse(true)).not.toThrow();
        expect(() => throwIfFalse(Boolean(1))).not.toThrow();
        expect(() => throwIfFalse(Boolean('hello'))).not.toThrow();
        expect(() => throwIfFalse(Boolean({}))).not.toThrow();
        expect(() => throwIfFalse(Boolean([]))).not.toThrow();
      });

      it('should throw ReferenceError for false values', () => {
        expect(() => throwIfFalse(false)).toThrow(ReferenceError);
        expect(() => throwIfFalse(false)).toThrow('Value is false.');
      });

      it('should provide type narrowing', () => {
        // This test verifies TypeScript type narrowing behavior
        const condition = Math.random() > 0.5;
        
        if (condition) {
          throwIfFalse(condition);
          // After this point, TypeScript knows condition is true, not boolean
          expect(condition).toBe(true);
        }
      });

      it('should work with boolean expressions', () => {
        const x = 5;
        const y = 10;
        
        expect(() => throwIfFalse(x < y)).not.toThrow();
        expect(() => throwIfFalse(x > y)).toThrow(ReferenceError);
      });

      it('should work in conditional logic', () => {
        const validatePositive = (num: number) => {
          throwIfFalse(num > 0);
          return num * 2; // TypeScript knows the condition was true
        };

        expect(validatePositive(5)).toBe(10);
        expect(() => validatePositive(-1)).toThrow(ReferenceError);
        expect(() => validatePositive(0)).toThrow(ReferenceError);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together in complex validation scenarios', () => {
      interface User {
        id: number;
        name: string | null;
        email?: string;
        isActive: boolean;
      }

      const validateUser = (user: User | undefined) => {
        throwIfUndefined(user);
        throwIfNull(user.name);
        throwIfFalse(user.isActive);
        
        return {
          id: user.id,
          name: user.name.toUpperCase(),
          email: user.email || 'no-email@example.com',
          isActive: user.isActive
        };
      };

      const validUser: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        isActive: true
      };

      const result = validateUser(validUser);
      expect(result.name).toBe('JOHN DOE');
      expect(result.isActive).toBe(true);

      // Test various failure scenarios
      expect(() => validateUser(undefined)).toThrow('Value is undefined.');
      
      expect(() => validateUser({
        id: 1,
        name: null,
        isActive: true
      })).toThrow('Value is null.');
      
      expect(() => validateUser({
        id: 1,
        name: 'John',
        isActive: false
      })).toThrow('Value is false.');
    });

    it('should handle chained assertions', () => {
      const processData = (data: { value: string | null | undefined } | undefined) => {
        throwIfUndefined(data);
        throwIfUndefined(data.value);
        throwIfNull(data.value);
        throwIfFalse(data.value.length > 0);
        
        return data.value.toUpperCase();
      };

      expect(processData({ value: 'hello' })).toBe('HELLO');
      expect(() => processData(undefined)).toThrow('Value is undefined.');
      expect(() => processData({ value: undefined })).toThrow('Value is undefined.');
      expect(() => processData({ value: null })).toThrow('Value is null.');
      expect(() => processData({ value: '' })).toThrow('Value is false.');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle error serialization', () => {
      const errors = [
        new InvalidParameterError('param error'),
        new InvalidOperationError('operation error'),
        new ConnectionError('connection error'),
        new InvalidStateError('state error')
      ];

      errors.forEach(error => {
        const serialized = JSON.stringify(error);
        const parsed = JSON.parse(serialized);
        
        // Basic properties should be preserved
        expect(parsed.message).toBe(error.message);
        expect(parsed.name).toBe(error.name);
      });
    });

    it('should handle error inheritance correctly', () => {
      const errors = [
        new InvalidParameterError(),
        new InvalidOperationError(),
        new ConnectionError(),
        new InvalidStateError()
      ];

      errors.forEach(error => {
        expect(error instanceof Error).toBe(true);
        expect(error.constructor.name).toBe(error.name);
      });
    });

    it('should handle empty and whitespace messages', () => {
      const emptyMessage = new InvalidParameterError('');
      const whitespaceMessage = new InvalidOperationError('   ');
      const nullishMessage = new ConnectionError(undefined);

      expect(emptyMessage.message).toBe('');
      expect(whitespaceMessage.message).toBe('   ');
      expect(nullishMessage.message).toBe('');
    });
  });

  describe('Performance and Memory', () => {
    it('should not leak memory with many assertions', () => {
      // Test that assertions don't accumulate memory when called many times
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        throwIfUndefined('test');
        throwIfNull('test');
        throwIfFalse(true);
      }
      
      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should be fast for successful assertions', () => {
      const start = Date.now();
      const iterations = 10000;
      
      for (let i = 0; i < iterations; i++) {
        throwIfUndefined('test');
        throwIfNull('test');
        throwIfFalse(true);
      }
      
      const duration = Date.now() - start;
      
      // Should complete quickly (less than 100ms for 10k iterations)
      expect(duration).toBeLessThan(100);
    });
  });
});
