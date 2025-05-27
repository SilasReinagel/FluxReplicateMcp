/**
 * Simple configuration for Flux Replicate MCP Server
 * Environment variable based configuration only
 */

export interface Config {
  replicateApiKey: string;
  defaultModel: 'flux-pro' | 'flux-schnell';
  outputFormat: 'jpg' | 'png' | 'webp';
  outputQuality: number;
}

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): Config {
  const replicateApiKey = process.env['REPLICATE_API_TOKEN'];
  if (!replicateApiKey) {
    throw new Error('REPLICATE_API_TOKEN environment variable is required');
  }

  return {
    replicateApiKey,
    defaultModel: (process.env['FLUX_DEFAULT_MODEL'] as 'flux-pro' | 'flux-schnell') || 'flux-pro',
    outputFormat: (process.env['FLUX_OUTPUT_FORMAT'] as 'jpg' | 'png' | 'webp') || 'jpg',
    outputQuality: parseInt(process.env['FLUX_OUTPUT_QUALITY'] || '80', 10),
  };
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(config: Config): void {
  if (config.outputQuality < 1 || config.outputQuality > 100) {
    throw new Error('FLUX_OUTPUT_QUALITY must be between 1 and 100');
  }
}

/**
 * Get the global configuration instance
 */
let globalConfig: Config | null = null;

export function getConfig(): Config {
  if (!globalConfig) {
    globalConfig = loadConfig();
    validateConfig(globalConfig);
  }
  return globalConfig;
} 