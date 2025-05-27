/**
 * Simple configuration for Flux Replicate MCP Server
 * Environment variable based configuration only
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Config {
  replicateApiKey: string;
  defaultModel: 'flux-pro' | 'flux-schnell';
  outputFormat: 'jpg' | 'png' | 'webp';
  outputQuality: number;
  workingDirectory: string;
}

/**
 * Get platform-specific working directory for generated images
 */
const getPlatformWorkingDirectory = (): string => {
  const platform = process.platform;
  const home = homedir();
  
  switch (platform) {
    case 'win32':
      // Windows: %USERPROFILE%\Documents\FluxImages
      return join(home, 'Documents', 'FluxImages');
    case 'darwin':
      // macOS: ~/Pictures/FluxImages
      return join(home, 'Pictures', 'FluxImages');
    case 'linux':
      // Linux: ~/Pictures/FluxImages (or ~/flux-images if Pictures doesn't exist)
      const picturesDir = join(home, 'Pictures', 'FluxImages');
      const fallbackDir = join(home, 'flux-images');
      return picturesDir; // We'll handle fallback in ensureWorkingDirectory
    default:
      // Other platforms: ~/flux-images
      return join(home, 'flux-images');
  }
};

/**
 * Ensure working directory exists, create if needed
 */
export const ensureWorkingDirectory = async (workingDir: string): Promise<string> => {
  try {
    await fs.mkdir(workingDir, { recursive: true });
    return workingDir;
  } catch (error) {
    // If we're on Linux and Pictures/FluxImages fails, try fallback
    if (process.platform === 'linux' && workingDir.includes('Pictures')) {
      const fallbackDir = join(homedir(), 'flux-images');
      try {
        await fs.mkdir(fallbackDir, { recursive: true });
        return fallbackDir;
      } catch (fallbackError) {
        throw new Error(`Failed to create working directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    throw new Error(`Failed to create working directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Load configuration from environment variables with defaults
 */
export const loadConfig = (): Config => {
  const replicateApiKey = process.env['REPLICATE_API_TOKEN'];
  if (!replicateApiKey) {
    throw new Error('REPLICATE_API_TOKEN environment variable is required');
  }

  // Allow custom working directory via environment variable
  const customWorkingDir = process.env['FLUX_WORKING_DIRECTORY'];
  const workingDirectory = customWorkingDir || getPlatformWorkingDirectory();

  return {
    replicateApiKey,
    defaultModel: (process.env['FLUX_DEFAULT_MODEL'] as 'flux-pro' | 'flux-schnell') || 'flux-pro',
    outputFormat: (process.env['FLUX_OUTPUT_FORMAT'] as 'jpg' | 'png' | 'webp') || 'jpg',
    outputQuality: parseInt(process.env['FLUX_OUTPUT_QUALITY'] || '80', 10),
    workingDirectory,
  };
};

/**
 * Validate that required configuration is present
 */
export const validateConfig = (config: Config): void => {
  if (config.outputQuality < 1 || config.outputQuality > 100) {
    throw new Error('FLUX_OUTPUT_QUALITY must be between 1 and 100');
  }
};

/**
 * Get the global configuration instance
 */
let globalConfig: Config | null = null;

export const getConfig = (): Config => {
  if (!globalConfig) {
    globalConfig = loadConfig();
    validateConfig(globalConfig);
  }
  return globalConfig;
}; 