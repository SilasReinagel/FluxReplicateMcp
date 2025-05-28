/**
 * Simple logging for Flux Replicate MCP Server
 * JSON structured output to stderr for MCP compatibility
 */

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error';
  message: string;
  context?: Record<string, any>;
}

/**
 * Log an info message
 */
export const info = (message: string, context?: Record<string, any>): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message,
    ...(context && { context }),
  };
  
  console.info(JSON.stringify(entry));
};

/**
 * Log an error message
 */
export const error = (message: string, context?: Record<string, any>): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    ...(context && { context }),
  };
  
  console.error(JSON.stringify(entry));
}; 