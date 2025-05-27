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
  generateImage = async (params: GenerateImageParams): Promise<GenerateImageResult> => {
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
      // Prepare base input parameters
      const baseInput = {
        prompt: params.prompt.trim(),
        width: params.width || 1024,
        height: params.height || 1024,
        num_outputs: params.num_outputs || 1,
        ...(params.seed && { seed: params.seed }),
      };

      // Add model-specific parameters
      let input: any;
      if (model === 'flux-schnell') {
        // Flux Schnell has different parameter constraints
        input = {
          ...baseInput,
          num_inference_steps: Math.min(params.num_inference_steps || 4, 4), // Max 4 for schnell
          // Flux Schnell doesn't use guidance_scale
        };
      } else {
        // Flux Pro parameters
        input = {
          ...baseInput,
          guidance_scale: params.guidance_scale || 3.5,
          num_inference_steps: params.num_inference_steps || 28,
        };
      }

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
  };

  /**
   * Download image from URL
   */
  downloadImage = async (url: string): Promise<Buffer> => {
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
  };

  /**
   * Check if model is supported
   */
  isModelSupported = (model: string): model is FluxModel => {
    return model in FLUX_MODELS;
  };

  /**
   * Get available models
   */
  getAvailableModels = (): FluxModel[] => {
    return Object.keys(FLUX_MODELS) as FluxModel[];
  };
} 