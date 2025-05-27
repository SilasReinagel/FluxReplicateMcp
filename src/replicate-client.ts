import Replicate from 'replicate';
import { ConfigManager } from './config.js';

/**
 * Aspect ratio mappings for Flux models
 */
export const ASPECT_RATIOS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
  '21:9': { width: 1536, height: 640 },
  '9:21': { width: 640, height: 1536 },
} as const;

/**
 * Flux model configurations
 */
export const FLUX_MODELS = {
  'flux-pro': {
    id: 'black-forest-labs/flux-pro',
    name: 'Flux Pro',
    description: 'Highest quality, slower generation',
    costTier: 'high',
  },
  'flux-schnell': {
    id: 'black-forest-labs/flux-schnell',
    name: 'Flux Schnell',
    description: 'Faster generation, good quality',
    costTier: 'low',
  },
} as const;

export type FluxModel = keyof typeof FLUX_MODELS;
export type AspectRatio = keyof typeof ASPECT_RATIOS;

/**
 * Image generation parameters
 */
export interface ImageGenerationParams {
  prompt: string;
  model: FluxModel;
  aspect_ratio: AspectRatio;
  num_outputs?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  success: boolean;
  imageUrls: string[];
  cost?: number;
  model: string;
  dimensions: {
    width: number;
    height: number;
  };
  processingTime: number;
  predictionId: string;
  error?: string;
}

/**
 * Replicate API client wrapper
 */
export class ReplicateClient {
  private client!: Replicate; // Definite assignment assertion - initialized in initializeClient
  private configManager: ConfigManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.initializeClient();
  }

  /**
   * Initialize the Replicate client with API key
   */
  private initializeClient(): void {
    const apiKey = this.configManager.getApiKey();
    if (!apiKey) {
      throw new Error('Replicate API key not configured. Please run setup first.');
    }

    this.client = new Replicate({
      auth: apiKey,
    });
  }

  /**
   * Health check - verify API connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Try to list models as a simple health check
      await this.client.models.list();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(modelId: string): Promise<any> {
    try {
      const [owner, name] = modelId.split('/');
      if (!owner || !name) {
        throw new Error(`Invalid model ID format: ${modelId}. Expected format: owner/name`);
      }
      return await this.client.models.get(owner, name);
    } catch (error) {
      throw new Error(`Failed to get model info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate image using Flux model
   */
  async generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    try {
      // Validate model
      const modelConfig = FLUX_MODELS[params.model];
      if (!modelConfig) {
        throw new Error(`Unsupported model: ${params.model}`);
      }

      // Get dimensions for aspect ratio
      const dimensions = ASPECT_RATIOS[params.aspect_ratio];
      if (!dimensions) {
        throw new Error(`Unsupported aspect ratio: ${params.aspect_ratio}`);
      }

      // Prepare input parameters
      const input = {
        prompt: params.prompt,
        width: dimensions.width,
        height: dimensions.height,
        num_outputs: params.num_outputs || 1,
        guidance_scale: params.guidance_scale || 3.5,
        num_inference_steps: params.num_inference_steps || 28,
        ...(params.seed && { seed: params.seed }),
      };

      console.error(`Generating image with ${modelConfig.name}...`);
      console.error(`Prompt: ${params.prompt}`);
      console.error(`Dimensions: ${dimensions.width}x${dimensions.height}`);

      // Run the prediction
      const prediction = await this.client.run(modelConfig.id, { input });

      const processingTime = Date.now() - startTime;

      // Handle the result
      if (Array.isArray(prediction)) {
        return {
          success: true,
          imageUrls: prediction,
          model: modelConfig.name,
          dimensions,
          processingTime,
          predictionId: 'unknown', // Replicate.run doesn't return prediction ID
        };
      } else if (typeof prediction === 'string') {
        return {
          success: true,
          imageUrls: [prediction],
          model: modelConfig.name,
          dimensions,
          processingTime,
          predictionId: 'unknown',
        };
      } else {
        throw new Error('Unexpected prediction result format');
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        imageUrls: [],
        model: FLUX_MODELS[params.model].name,
        dimensions: ASPECT_RATIOS[params.aspect_ratio],
        processingTime,
        predictionId: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate image with retry logic
   */
  async generateImageWithRetry(
    params: ImageGenerationParams,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<ImageGenerationResult> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.generateImage(params);
        
        if (result.success) {
          return result;
        }

        // If it's a client error (4xx), don't retry
        if (result.error?.includes('400') || result.error?.includes('401') || result.error?.includes('403')) {
          return result;
        }

        lastError = new Error(result.error || 'Generation failed');
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // If it's a client error, don't retry
        if (lastError.message.includes('400') || lastError.message.includes('401') || lastError.message.includes('403')) {
          throw lastError;
        }
      }

      // If this wasn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.error(`Generation attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Download image from URL
   */
  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Estimate generation cost (placeholder - actual costs depend on Replicate pricing)
   */
  estimateCost(model: FluxModel, numOutputs: number = 1): number {
    // These are placeholder values - actual costs should be fetched from Replicate API
    const baseCosts = {
      'flux-pro': 0.055, // per image
      'flux-schnell': 0.003, // per image
    };

    return baseCosts[model] * numOutputs;
  }

  /**
   * Validate generation parameters
   */
  validateParams(params: ImageGenerationParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate prompt
    if (!params.prompt || params.prompt.trim().length === 0) {
      errors.push('Prompt is required and cannot be empty');
    }

    if (params.prompt && params.prompt.length > 1000) {
      errors.push('Prompt is too long (maximum 1000 characters)');
    }

    // Validate model
    if (!FLUX_MODELS[params.model]) {
      errors.push(`Invalid model: ${params.model}. Supported models: ${Object.keys(FLUX_MODELS).join(', ')}`);
    }

    // Validate aspect ratio
    if (!ASPECT_RATIOS[params.aspect_ratio]) {
      errors.push(`Invalid aspect ratio: ${params.aspect_ratio}. Supported ratios: ${Object.keys(ASPECT_RATIOS).join(', ')}`);
    }

    // Validate optional parameters
    if (params.num_outputs !== undefined && (params.num_outputs < 1 || params.num_outputs > 4)) {
      errors.push('num_outputs must be between 1 and 4');
    }

    if (params.guidance_scale !== undefined && (params.guidance_scale < 1 || params.guidance_scale > 20)) {
      errors.push('guidance_scale must be between 1 and 20');
    }

    if (params.num_inference_steps !== undefined && (params.num_inference_steps < 1 || params.num_inference_steps > 50)) {
      errors.push('num_inference_steps must be between 1 and 50');
    }

    if (params.seed !== undefined && (params.seed < 0 || params.seed > 2147483647)) {
      errors.push('seed must be between 0 and 2147483647');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get available models
   */
  getAvailableModels(): typeof FLUX_MODELS {
    return FLUX_MODELS;
  }

  /**
   * Get available aspect ratios
   */
  getAvailableAspectRatios(): typeof ASPECT_RATIOS {
    return ASPECT_RATIOS;
  }
} 