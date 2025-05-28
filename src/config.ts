/**
 * Simple configuration for Flux Replicate MCP Server
 * Configuration priority: CLI args > Environment variables > Defaults
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

export interface CliArgs {
  replicateApiKey?: string;
  defaultModel?: 'flux-pro' | 'flux-schnell';
  outputFormat?: 'jpg' | 'png' | 'webp';
  outputQuality?: number;
  workingDirectory?: string;
  help?: boolean;
}

/**
 * Parse command line arguments
 */
export const parseCliArgs = (): CliArgs => {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const nextArg = argv[i + 1];

    switch (arg) {
      case '--replicate-api-key':
      case '--api-key':
      case '-k':
        if (nextArg && !nextArg.startsWith('-')) {
          args.replicateApiKey = nextArg;
          i++;
        }
        break;
      
      case '--model':
      case '-m':
        if (nextArg && (nextArg === 'flux-pro' || nextArg === 'flux-schnell')) {
          args.defaultModel = nextArg;
          i++;
        }
        break;
      
      case '--format':
      case '-f':
        if (nextArg && ['jpg', 'png', 'webp'].includes(nextArg)) {
          args.outputFormat = nextArg as 'jpg' | 'png' | 'webp';
          i++;
        }
        break;
      
      case '--quality':
      case '-q':
        if (nextArg && !nextArg.startsWith('-')) {
          const quality = parseInt(nextArg, 10);
          if (!isNaN(quality) && quality >= 1 && quality <= 100) {
            args.outputQuality = quality;
            i++;
          }
        }
        break;
      
      case '--working-directory':
      case '--dir':
      case '-d':
        if (nextArg && !nextArg.startsWith('-')) {
          args.workingDirectory = nextArg;
          i++;
        }
        break;
      
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
};

/**
 * Display help message
 */
export const showHelp = (): void => {
  console.log(`
Flux Replicate MCP Server

USAGE:
  flux-replicate-mcp-server [OPTIONS]

OPTIONS:
  -k, --api-key, --replicate-api-key <token>
                        Replicate API token (required)
  
  -m, --model <model>   Default model: flux-pro or flux-schnell
                        (default: flux-pro)
  
  -f, --format <format> Default output format: jpg, png, or webp
                        (default: jpg)
  
  -q, --quality <1-100> Default quality for lossy formats
                        (default: 80)
  
  -d, --dir, --working-directory <path>
                        Custom working directory for generated images
                        (default: platform-specific)
  
  -h, --help           Show this help message

ENVIRONMENT VARIABLES:
  REPLICATE_API_TOKEN          Replicate API token
  FLUX_DEFAULT_MODEL           Default model (flux-pro|flux-schnell)
  FLUX_OUTPUT_FORMAT           Default format (jpg|png|webp)
  FLUX_OUTPUT_QUALITY          Default quality (1-100)
  FLUX_WORKING_DIRECTORY       Custom working directory

EXAMPLES:
  # Using CLI arguments
  flux-replicate-mcp-server --api-key r8_your_token_here --model flux-schnell
  
  # Using environment variables
  export REPLICATE_API_TOKEN=r8_your_token_here
  flux-replicate-mcp-server
  
  # Mixed (CLI takes priority)
  export REPLICATE_API_TOKEN=r8_your_token_here
  flux-replicate-mcp-server --model flux-pro --quality 95

WORKING DIRECTORIES (platform-specific defaults):
  Windows: %USERPROFILE%\\Documents\\FluxImages
  macOS:   ~/Pictures/FluxImages
  Linux:   ~/Pictures/FluxImages (fallback: ~/flux-images)
`);
};

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
 * Load configuration from CLI args, environment variables, and defaults
 * Priority: CLI args > Environment variables > Defaults
 */
export const loadConfig = (cliArgs?: CliArgs): Config => {
  const args = cliArgs || parseCliArgs();
  
  // Show help if requested
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Get API key from CLI args or environment
  const replicateApiKey = args.replicateApiKey || process.env['REPLICATE_API_TOKEN'];
  
  if (!replicateApiKey) {
    console.error('\n❌ Error: Replicate API token is required!\n');
    console.error('Provide it via:');
    console.error('  CLI: --api-key r8_your_token_here');
    console.error('  ENV: export REPLICATE_API_TOKEN=r8_your_token_here\n');
    console.error('Get your token at: https://replicate.com/account/api-tokens\n');
    showHelp();
    process.exit(1);
  }

  // Allow custom working directory via CLI args or environment variable
  const customWorkingDir = args.workingDirectory || process.env['FLUX_WORKING_DIRECTORY'];
  const workingDirectory = customWorkingDir || getPlatformWorkingDirectory();

  return {
    replicateApiKey,
    defaultModel: args.defaultModel || (process.env['FLUX_DEFAULT_MODEL'] as 'flux-pro' | 'flux-schnell') || 'flux-pro',
    outputFormat: args.outputFormat || (process.env['FLUX_OUTPUT_FORMAT'] as 'jpg' | 'png' | 'webp') || 'jpg',
    outputQuality: args.outputQuality || parseInt(process.env['FLUX_OUTPUT_QUALITY'] || '80', 10),
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