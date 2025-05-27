/**
 * Simple image processing for Flux Replicate MCP Server
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { getConfig } from './config.js';
import { processingError } from './errors.js';

/**
 * Supported output formats
 */
export type OutputFormat = 'jpg' | 'png' | 'webp';

/**
 * Image processing options
 */
export interface ProcessImageOptions {
  outputPath: string;
  format?: OutputFormat;
  quality?: number;
  width?: number;
  height?: number;
}

/**
 * Image processing result
 */
export interface ProcessImageResult {
  outputPath: string;
  fileSize: number;
  width: number;
  height: number;
  format: string;
}

/**
 * Simple image processor
 */
export class ImageProcessor {
  /**
   * Process image buffer and save to file
   */
  processImage = async (buffer: Buffer, options: ProcessImageOptions): Promise<ProcessImageResult> => {
    try {
      const config = getConfig();
      
      // Ensure output directory exists
      await this.ensureDirectoryExists(options.outputPath);
      
      // Create Sharp instance
      let image = sharp(buffer);
      
      // Apply resize if specified
      if (options.width || options.height) {
        image = image.resize(options.width, options.height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      
      // Apply format and quality
      const format = options.format || config.outputFormat;
      const quality = options.quality || config.outputQuality;
      
      switch (format) {
        case 'jpg':
          image = image.jpeg({ quality });
          break;
        case 'png':
          image = image.png({ compressionLevel: Math.round((100 - quality) / 10) });
          break;
        case 'webp':
          image = image.webp({ quality });
          break;
        default:
          throw processingError(`Unsupported format: ${format}`);
      }
      
      // Save the image
      const outputBuffer = await image.toBuffer();
      await fs.writeFile(options.outputPath, outputBuffer);
      
      // Get final metadata
      const metadata = await sharp(outputBuffer).metadata();
      
      return {
        outputPath: options.outputPath,
        fileSize: outputBuffer.length,
        width: metadata.width || 0,
        height: metadata.height || 0,
        format,
      };
      
    } catch (error) {
      if (error instanceof Error) {
        throw processingError(`Image processing failed: ${error.message}`);
      }
      throw processingError('Image processing failed with unknown error');
    }
  };
  
  /**
   * Ensure directory exists for file path
   */
  private ensureDirectoryExists = async (filePath: string): Promise<void> => {
    try {
      const dir = dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error instanceof Error) {
        throw processingError(`Failed to create directory: ${error.message}`);
      }
      throw processingError('Failed to create directory');
    }
  };
  
  /**
   * Get supported formats
   */
  getSupportedFormats = (): OutputFormat[] => {
    return ['jpg', 'png', 'webp'];
  };
} 