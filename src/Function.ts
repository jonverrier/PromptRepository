/**
 * Interface for functions to pass to the LLM
 */
// Copyright (c) 2025 Jon Verrier

/**
 * Enum for basic data types
 */
export enum EDataType {
   kObject = "object",
   kString = "string",
   kNumber = "number",
   kBoolean = "boolean",
   kArray = "array"
}

/**
 * Base interface for argument objects
 */
export interface IFunctionArgs {
   [key: string]: string | number | boolean | string[] | number[] | boolean[] | object | object[] | undefined;   
}

/**
 * Function type for validating function arguments
 */
export type FnValidateFunctionArgs = (args: IFunctionArgs) => IFunctionArgs;

/**
 * Function type for executing functions
 */
export type FnExecuteFunction = (args: IFunctionArgs) => Promise<IFunctionArgs>;

export interface ISchemaProperty {
   type: EDataType | string; // Accepts both enum and string literal
   description: string;
   properties?: { [key: string]: ISchemaProperty };
   items?: ISchemaProperty;
   required?: string[] | readonly string[];
   additionalProperties?: boolean;
 }
 
 export interface ISchema {
   type: EDataType | string;
   properties: { [key: string]: ISchemaProperty };
   required?: string[] | readonly string[];
   additionalProperties?: boolean;
 }
 
 /**
 * Interface for a function
 * 
 * @interface IFunction
 * @property {string} name - The name of the function
 * @property {string} description - The description of the function
 * @property {object} inputSchema - The input schema of the function
 * @property {object} outputSchema - The output schema of the function
 */
 export interface IFunction {
   name: string;
   description: string;
   inputSchema: ISchema;
   outputSchema: ISchema;
   validateArgs: (args: any) => any;
   execute: (args: any) => Promise<any>;
 }
