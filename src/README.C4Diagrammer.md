# PromptRepository Source Code Documentation

## Overview
This directory contains the core TypeScript implementation of the PromptRepository system, which manages AI prompt templates and their interactions with language models.

## File Summaries

### PromptRepository.ts
A core module implementing the prompt repository pattern for managing AI prompts. It provides two repository implementations: `PromptFileRepository` for JSON file-based storage and `PromptInMemoryRepository` for in-memory storage. The module includes functionality for storing prompts with metadata, retrieving prompts by ID, and replacing placeholder values in prompt templates. It also implements parameter validation and type checking for prompt parameters.

### Chat.ts
Implements the OpenAI chat completion API integration through the `ChatDriver` interface. The module provides a factory pattern for creating chat drivers and handles communication with OpenAI's API. It includes error handling for API calls, environment variable validation for API keys, and supports different model configurations (large and mini variants). The implementation focuses on type safety and proper error propagation.

### entry.ts
Defines the core interfaces and types for the PromptRepository system. Contains essential type definitions for prompt parameters, repository interfaces, and chat drivers. Includes enums for parameter types, model sizes, and providers. This module serves as the central type definition file, ensuring type safety across the application. It exports interfaces for prompt templates, parameters, and repository operations.

### Asserts.ts
Provides type-safe assertion utilities for runtime checks in TypeScript. Implements functions for validating undefined, null, and boolean conditions with proper type narrowing. Includes a custom `InvalidParameterError` class for parameter validation. These utilities help maintain runtime type safety and provide clear error messages for debugging.

### MakePromptIds.ts
A utility script that generates TypeScript files containing prompt ID declarations from JSON prompt data. It converts prompt names to camelCase identifiers and creates a mapping to their corresponding IDs. The script supports command-line operation and can process prompt files to generate type-safe ID references. Useful for maintaining consistent prompt identifiers across the codebase. 