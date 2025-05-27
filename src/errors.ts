/**
 * Simple error handling for Flux Replicate MCP Server
 */

export type ErrorCode = 'AUTH' | 'API' | 'VALIDATION' | 'PROCESSING';

/**
 * Simple MCP error class
 */
export class McpError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Record<string, any>;

  constructor(message: string, code: ErrorCode, context?: Record<string, any>) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.context = context || {};
  }

  /**
   * Convert to JSON for MCP error response
   */
  toJSON(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      ...(Object.keys(this.context).length > 0 && { context: this.context }),
    };
  }
}

/**
 * Create authentication error
 */
export function authError(message: string, context?: Record<string, any>): McpError {
  return new McpError(message, 'AUTH', context);
}

/**
 * Create API error
 */
export function apiError(message: string, context?: Record<string, any>): McpError {
  return new McpError(message, 'API', context);
}

/**
 * Create validation error
 */
export function validationError(message: string, context?: Record<string, any>): McpError {
  return new McpError(message, 'VALIDATION', context);
}

/**
 * Create processing error
 */
export function processingError(message: string, context?: Record<string, any>): McpError {
  return new McpError(message, 'PROCESSING', context);
} 