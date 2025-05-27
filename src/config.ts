import { z } from 'zod';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Configuration schema using Zod for validation
 */
export const ConfigSchema = z.object({
  replicate_api_key: z.string().optional(),
  default_model: z.enum(['flux-pro', 'flux-schnell']).default('flux-pro'),
  default_aspect_ratio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21']).default('1:1'),
  default_output_format: z.enum(['jpg', 'png', 'webp']).default('jpg'),
  default_quality: z.number().min(1).max(100).default(80),
  temp_directory: z.string().default('./temp'),
  max_concurrent_generations: z.number().min(1).max(10).default(3),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
  replicate_api_key: undefined,
  default_model: 'flux-pro',
  default_aspect_ratio: '1:1',
  default_output_format: 'jpg',
  default_quality: 80,
  temp_directory: './temp',
  max_concurrent_generations: 3,
};

/**
 * Configuration manager class
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  private configPath: string;
  private configDir: string;

  private constructor(customConfigDir?: string) {
    this.configDir = customConfigDir || join(homedir(), '.flux-replicate-mcp');
    this.configPath = join(this.configDir, 'config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get singleton instance of ConfigManager
   */
  static getInstance(customConfigDir?: string): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(customConfigDir);
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize configuration - load from file or create default
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureConfigDirectory();
      await this.loadConfig();
    } catch (error) {
      console.error('Error initializing configuration:', error);
      // Use default config if loading fails
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Ensure configuration directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    try {
      await fs.access(this.configDir);
    } catch {
      // Directory doesn't exist, create it
      await fs.mkdir(this.configDir, { recursive: true });
      // Set secure permissions (700 - owner read/write/execute only)
      await fs.chmod(this.configDir, 0o700);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      await fs.access(this.configPath);
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate and merge with defaults
      const validatedConfig = ConfigSchema.parse({
        ...DEFAULT_CONFIG,
        ...parsedConfig,
      });
      
      this.config = validatedConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Config file doesn't exist, create it with defaults
        await this.saveConfig();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      const configData = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configPath, configData, 'utf-8');
      // Set secure permissions (600 - owner read/write only)
      await fs.chmod(this.configPath, 0o600);
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<Config>): Promise<void> {
    const newConfig = { ...this.config, ...updates };
    
    // Validate the new configuration
    const validatedConfig = ConfigSchema.parse(newConfig);
    
    this.config = validatedConfig;
    await this.saveConfig();
  }

  /**
   * Get Replicate API key
   */
  getApiKey(): string | undefined {
    return this.config.replicate_api_key;
  }

  /**
   * Set Replicate API key
   */
  async setApiKey(apiKey: string): Promise<void> {
    await this.updateConfig({ replicate_api_key: apiKey });
  }

  /**
   * Check if API key is configured
   */
  hasApiKey(): boolean {
    return !!this.config.replicate_api_key && this.config.replicate_api_key.trim().length > 0;
  }

  /**
   * Get default model
   */
  getDefaultModel(): 'flux-pro' | 'flux-schnell' {
    return this.config.default_model;
  }

  /**
   * Get default aspect ratio
   */
  getDefaultAspectRatio(): '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21' {
    return this.config.default_aspect_ratio;
  }

  /**
   * Get default output format
   */
  getDefaultOutputFormat(): 'jpg' | 'png' | 'webp' {
    return this.config.default_output_format;
  }

  /**
   * Get default quality
   */
  getDefaultQuality(): number {
    return this.config.default_quality;
  }

  /**
   * Get temporary directory
   */
  getTempDirectory(): string {
    return this.config.temp_directory;
  }

  /**
   * Get maximum concurrent generations
   */
  getMaxConcurrentGenerations(): number {
    return this.config.max_concurrent_generations;
  }

  /**
   * Get configuration file path (for debugging/info purposes)
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
  }

  /**
   * Validate configuration
   */
  validateConfig(): { isValid: boolean; errors?: string[] } {
    try {
      ConfigSchema.parse(this.config);
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Reset singleton instance (for testing purposes)
   */
  static resetInstance(): void {
    ConfigManager.instance = undefined as any;
  }
} 