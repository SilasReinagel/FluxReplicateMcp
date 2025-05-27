import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager, ConfigSchema } from './config.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    // Reset singleton instance
    ConfigManager.resetInstance();
    
    // Create a temporary directory for testing
    tempDir = join(tmpdir(), 'flux-mcp-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a custom config directory in the temp directory
    const customConfigDir = join(tempDir, '.flux-replicate-mcp');
    
    // Get a fresh instance with custom config directory
    configManager = ConfigManager.getInstance(customConfigDir);
  });

  afterEach(async () => {
    // Reset singleton instance
    ConfigManager.resetInstance();
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should create default configuration', async () => {
    await configManager.initialize();
    
    const config = configManager.getConfig();
    expect(config.default_model).toBe('flux-pro');
    expect(config.default_aspect_ratio).toBe('1:1');
    expect(config.default_output_format).toBe('jpg');
    expect(config.default_quality).toBe(80);
  });

  it('should validate configuration schema', () => {
    const validConfig = {
      default_model: 'flux-pro' as const,
      default_aspect_ratio: '16:9' as const,
      default_output_format: 'png' as const,
      default_quality: 90,
      temp_directory: './temp',
      max_concurrent_generations: 2,
    };

    const result = ConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid configuration', () => {
    const invalidConfig = {
      default_model: 'invalid-model',
      default_quality: 150, // Invalid quality > 100
    };

    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should handle API key operations', async () => {
    await configManager.initialize();
    
    expect(configManager.hasApiKey()).toBe(false);
    
    await configManager.setApiKey('r8_test_key_123456789012345678901234567890');
    expect(configManager.hasApiKey()).toBe(true);
    expect(configManager.getApiKey()).toBe('r8_test_key_123456789012345678901234567890');
  });
}); 