/**
 * Simple Replicate client for Flux image generation
 */

import Replicate from 'replicate';
import { getConfig } from './config.js';
import { apiError, validationError } from './errors.js';

/**
 * Supported Flux models
 */
export const FLUX_MODELS = {
  'flux-pro': 'black-forest-labs/flux-pro',
  'flux-schnell': 'black-forest-labs/flux-schnell',
} as const;

export type FluxModel = keyof typeof FLUX_MODELS;

/**
 * Image generation parameters
 */
export interface GenerateImageParams {
  prompt: string;
  model?: FluxModel;
  width?: number;
  height?: number;
  num_outputs?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
}

/**
 * Image generation result
 */
export interface GenerateImageResult {
  imageUrls: string[];
  model: string;
  processingTime: number;
}

/**
 * Simple Replicate client
 */
export class ReplicateClient {
  private client: Replicate;

  constructor() {
    const config = getConfig();
    this.client = new Replicate({
      auth: config.replicateApiKey,
    });
  }

  /**
   * Generate image using Flux model
   */
  async generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
    const startTime = Date.now();
    
    // Validate parameters
    if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim().length === 0) {
      throw validationError('Prompt is required and must be a non-empty string');
    }

    const config = getConfig();
    const model = params.model || config.defaultModel;
    
    if (!FLUX_MODELS[model]) {
      throw validationError(`Unsupported model: ${model}. Supported models: ${Object.keys(FLUX_MODELS).join(', ')}`);
    }

    try {
      // Prepare input parameters
      const input = {
        prompt: params.prompt.trim(),
        width: params.width || 1024,
        height: params.height || 1024,
        num_outputs: params.num_outputs || 1,
        guidance_scale: params.guidance_scale || 3.5,
        num_inference_steps: params.num_inference_steps || 28,
        ...(params.seed && { seed: params.seed }),
      };

      // Run the prediction
      const prediction = await this.client.run(FLUX_MODELS[model], { input });
      
      const processingTime = Date.now() - startTime;

      // Handle the result
      let imageUrls: string[];
      if (Array.isArray(prediction)) {
        imageUrls = prediction;
      } else if (typeof prediction === 'string') {
        imageUrls = [prediction];
      } else {
        throw apiError('Unexpected prediction result format');
      }

      return {
        imageUrls,
        model,
        processingTime,
      };

    } catch (error) {
      if (error instanceof Error) {
        throw apiError(`Image generation failed: ${error.message}`);
      }
      throw apiError('Image generation failed with unknown error');
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof Error) {
        throw apiError(`Failed to download image: ${error.message}`);
      }
      throw apiError('Failed to download image with unknown error');
    }
  }

  /**
   * Check if model is supported
   */
  isModelSupported(model: string): model is FluxModel {
    return model in FLUX_MODELS;
  }

  /**
   * Get available models
   */
  getAvailableModels(): FluxModel[] {
    return Object.keys(FLUX_MODELS) as FluxModel[];
  }
} 