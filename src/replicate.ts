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
  'flux-1.1-pro': 'black-forest-labs/flux-1.1-pro',
  'flux-pro': 'black-forest-labs/flux-pro',
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-ultra': 'black-forest-labs/flux-ultra',
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
 * Convert width/height to aspect ratio string
 */
const getAspectRatio = (width: number, height: number): string => {
  // Common aspect ratios that Flux supports
  const ratio = width / height;
  
  if (Math.abs(ratio - 1) < 0.01) return "1:1";           // Square
  if (Math.abs(ratio - 4/3) < 0.01) return "4:3";        // Standard
  if (Math.abs(ratio - 3/4) < 0.01) return "3:4";        // Portrait standard
  if (Math.abs(ratio - 16/9) < 0.01) return "16:9";      // Widescreen
  if (Math.abs(ratio - 9/16) < 0.01) return "9:16";      // Portrait widescreen
  if (Math.abs(ratio - 21/9) < 0.01) return "21:9";      // Ultra-wide
  if (Math.abs(ratio - 9/21) < 0.01) return "9:21";      // Ultra-tall
  if (Math.abs(ratio - 2/3) < 0.01) return "2:3";        // Portrait
  if (Math.abs(ratio - 3/2) < 0.01) return "3:2";        // Landscape
  
  // If no exact match, find the closest standard ratio
  if (ratio > 1) {
    // Landscape - choose between 4:3, 3:2, 16:9, 21:9
    if (ratio < 1.4) return "4:3";
    if (ratio < 1.6) return "3:2";
    if (ratio < 2.1) return "16:9";
    return "21:9";
  } else {
    // Portrait - choose between 3:4, 2:3, 9:16, 9:21
    if (ratio > 0.8) return "3:4";
    if (ratio > 0.65) return "2:3";
    if (ratio > 0.5) return "9:16";
    return "9:21";
  }
};

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
      // Convert width/height to aspect ratio
      const width = params.width || 1024;
      const height = params.height || 768;
      const aspectRatio = getAspectRatio(width, height);

      // Prepare base input parameters using aspect_ratio instead of width/height
      const baseInput = {
        prompt: params.prompt.trim(),
        aspect_ratio: aspectRatio,
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