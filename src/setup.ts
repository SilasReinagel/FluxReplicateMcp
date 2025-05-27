import { ConfigManager } from './config.js';
import { createInterface } from 'readline';

/**
 * Setup manager for handling first-run configuration
 */
export class SetupManager {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Check if setup is required (API key not configured)
   */
  isSetupRequired(): boolean {
    return !this.configManager.hasApiKey();
  }

  /**
   * Display setup instructions
   */
  displaySetupInstructions(): void {
    console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    Welcome to Flux Replicate MCP Server!                    ║
╚══════════════════════════════════════════════════════════════════════════════╝

To get started, you need a Replicate API key:

1. Visit https://replicate.com/account/api-tokens
2. Sign up or log in to your account
3. Create a new API token
4. Copy the token and paste it below

Your API key will be securely stored in: ${this.configManager.getConfigPath()}

Note: The API key is required to generate images using Flux models.
      You can update it later by running the setup again.
`);
  }

  /**
   * Prompt user for API key input
   */
  async promptForApiKey(): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr, // Use stderr to avoid interfering with MCP protocol
    });

    return new Promise((resolve) => {
      rl.question('Enter your Replicate API key: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Validate API key format
   */
  validateApiKeyFormat(apiKey: string): { isValid: boolean; error?: string } {
    if (!apiKey || apiKey.trim().length === 0) {
      return { isValid: false, error: 'API key cannot be empty' };
    }

    // Basic format validation for Replicate API keys
    // Replicate API keys typically start with 'r8_' and are followed by alphanumeric characters
    const apiKeyPattern = /^r8_[a-zA-Z0-9]{32,}$/;
    
    if (!apiKeyPattern.test(apiKey)) {
      return { 
        isValid: false, 
        error: 'Invalid API key format. Replicate API keys should start with "r8_" followed by alphanumeric characters.' 
      };
    }

    return { isValid: true };
  }

  /**
   * Test API key by making a simple request to Replicate
   */
  async validateApiKeyWithReplicate(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Import Replicate dynamically to avoid issues if not installed
      const Replicate = (await import('replicate')).default;
      
      const replicate = new Replicate({
        auth: apiKey,
      });

      // Make a simple request to validate the API key
      // We'll try to list models which is a lightweight operation
      await replicate.models.list();
      
      return { isValid: true };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          return { isValid: false, error: 'Invalid API key. Please check your Replicate API key and try again.' };
        }
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          return { isValid: false, error: 'API key does not have sufficient permissions.' };
        }
        if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          return { isValid: false, error: 'Network error. Please check your internet connection and try again.' };
        }
      }
      
      return { 
        isValid: false, 
        error: `Failed to validate API key: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Save API key to configuration
   */
  async saveApiKey(apiKey: string): Promise<void> {
    try {
      await this.configManager.setApiKey(apiKey);
    } catch (error) {
      throw new Error(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run the complete setup process
   */
  async runSetup(): Promise<boolean> {
    try {
      this.displaySetupInstructions();

      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        const apiKey = await this.promptForApiKey();

        // Validate format first
        const formatValidation = this.validateApiKeyFormat(apiKey);
        if (!formatValidation.isValid) {
          console.error(`\nError: ${formatValidation.error}\n`);
          attempts++;
          if (attempts < maxAttempts) {
            console.error(`Please try again (${maxAttempts - attempts} attempts remaining):\n`);
          }
          continue;
        }

        // Validate with Replicate API
        console.error('\nValidating API key with Replicate...');
        const apiValidation = await this.validateApiKeyWithReplicate(apiKey);
        
        if (!apiValidation.isValid) {
          console.error(`\nError: ${apiValidation.error}\n`);
          attempts++;
          if (attempts < maxAttempts) {
            console.error(`Please try again (${maxAttempts - attempts} attempts remaining):\n`);
          }
          continue;
        }

        // Save the API key
        await this.saveApiKey(apiKey);
        
        console.error(`
✅ Setup completed successfully!

Your API key has been saved securely to: ${this.configManager.getConfigPath()}

You can now use the Flux Replicate MCP Server to generate images.

Configuration summary:
- Default model: ${this.configManager.getDefaultModel()}
- Default aspect ratio: ${this.configManager.getDefaultAspectRatio()}
- Default output format: ${this.configManager.getDefaultOutputFormat()}
- Default quality: ${this.configManager.getDefaultQuality()}

The server is now ready to use!
`);
        
        return true;
      }

      console.error(`\n❌ Setup failed after ${maxAttempts} attempts.`);
      console.error('Please check your API key and try running the server again.');
      return false;

    } catch (error) {
      console.error(`\n❌ Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Update existing API key
   */
  async updateApiKey(): Promise<boolean> {
    console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         Update Replicate API Key                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

Current configuration file: ${this.configManager.getConfigPath()}

Enter your new Replicate API key:
`);

    try {
      const apiKey = await this.promptForApiKey();

      // Validate format
      const formatValidation = this.validateApiKeyFormat(apiKey);
      if (!formatValidation.isValid) {
        console.error(`\nError: ${formatValidation.error}`);
        return false;
      }

      // Validate with Replicate API
      console.error('\nValidating new API key with Replicate...');
      const apiValidation = await this.validateApiKeyWithReplicate(apiKey);
      
      if (!apiValidation.isValid) {
        console.error(`\nError: ${apiValidation.error}`);
        return false;
      }

      // Save the new API key
      await this.saveApiKey(apiKey);
      
      console.error('\n✅ API key updated successfully!');
      return true;

    } catch (error) {
      console.error(`\n❌ Failed to update API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Display current configuration status
   */
  displayConfigStatus(): void {
    const config = this.configManager.getConfig();
    const hasApiKey = this.configManager.hasApiKey();

    console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                         Configuration Status                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

Configuration file: ${this.configManager.getConfigPath()}
API Key configured: ${hasApiKey ? '✅ Yes' : '❌ No'}
Default model: ${config.default_model}
Default aspect ratio: ${config.default_aspect_ratio}
Default output format: ${config.default_output_format}
Default quality: ${config.default_quality}
Temp directory: ${config.temp_directory}
Max concurrent generations: ${config.max_concurrent_generations}

${!hasApiKey ? '\n⚠️  API key is required to generate images. Run setup to configure it.' : ''}
`);
  }
} 