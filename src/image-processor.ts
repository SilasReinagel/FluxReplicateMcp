import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { ConfigManager } from './config.js';

/**
 * Supported output formats
 */
export type OutputFormat = 'jpg' | 'jpeg' | 'png' | 'webp';

/**
 * Resize options for image processing
 */
export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  background?: string;
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  outputPath: string;
  outputFormat?: OutputFormat;
  quality?: number;
  resize?: ResizeOptions;
  progressive?: boolean;
  optimize?: boolean;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  success: boolean;
  outputPath: string;
  originalDimensions: {
    width: number;
    height: number;
  };
  finalDimensions: {
    width: number;
    height: number;
  };
  outputFormat: string;
  fileSize: number;
  processingTime: number;
  error?: string;
}

/**
 * Sharp-based image processor for handling image transformations
 */
export class ImageProcessor {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Process an image buffer with the specified options
   */
  async processImage(
    inputBuffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<ImageProcessingResult> {
    const startTime = Date.now();

    try {
      // Create Sharp instance from buffer
      let sharpInstance = sharp(inputBuffer);

      // Get original image metadata
      const metadata = await sharpInstance.metadata();
      const originalDimensions = {
        width: metadata.width || 0,
        height: metadata.height || 0,
      };

      // Apply resize if specified
      if (options.resize) {
        sharpInstance = this.applyResize(sharpInstance, options.resize);
      }

      // Determine output format
      const outputFormat = this.determineOutputFormat(options.outputPath, options.outputFormat);
      
      // Apply format-specific options
      sharpInstance = this.applyFormatOptions(sharpInstance, outputFormat, options);

      // Ensure output directory exists
      await this.ensureDirectoryExists(options.outputPath);

      // Process and save the image
      const outputBuffer = await sharpInstance.toBuffer();
      await fs.writeFile(options.outputPath, outputBuffer);

      // Get final dimensions
      const finalMetadata = await sharp(outputBuffer).metadata();
      const finalDimensions = {
        width: finalMetadata.width || originalDimensions.width,
        height: finalMetadata.height || originalDimensions.height,
      };

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        outputPath: options.outputPath,
        originalDimensions,
        finalDimensions,
        outputFormat,
        fileSize: outputBuffer.length,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        outputPath: options.outputPath,
        originalDimensions: { width: 0, height: 0 },
        finalDimensions: { width: 0, height: 0 },
        outputFormat: 'unknown',
        fileSize: 0,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown processing error',
      };
    }
  }

  /**
   * Apply resize transformations to Sharp instance
   */
  private applyResize(sharpInstance: sharp.Sharp, resize: ResizeOptions): sharp.Sharp {
    const resizeOptions: sharp.ResizeOptions = {
      fit: resize.fit || 'cover',
      position: resize.position || 'center',
      background: resize.background || { r: 255, g: 255, b: 255, alpha: 1 },
    };

    return sharpInstance.resize(resize.width, resize.height, resizeOptions);
  }

  /**
   * Determine the output format based on file extension and options
   */
  private determineOutputFormat(outputPath: string, explicitFormat?: OutputFormat): OutputFormat {
    if (explicitFormat) {
      return explicitFormat;
    }

    const ext = extname(outputPath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'jpg';
      case '.png':
        return 'png';
      case '.webp':
        return 'webp';
      default:
        // Default to configured format or jpg
        return this.configManager.getDefaultOutputFormat();
    }
  }

  /**
   * Apply format-specific options to Sharp instance
   */
  private applyFormatOptions(
    sharpInstance: sharp.Sharp,
    format: OutputFormat,
    options: ImageProcessingOptions
  ): sharp.Sharp {
    const quality = options.quality || this.configManager.getDefaultQuality();

    switch (format) {
      case 'jpg':
      case 'jpeg':
        return sharpInstance.jpeg({
          quality,
          progressive: options.progressive !== false,
          mozjpeg: true, // Use mozjpeg encoder for better compression
        });

      case 'png':
        return sharpInstance.png({
          progressive: options.progressive !== false,
          compressionLevel: Math.round((100 - quality) / 10), // Convert quality to compression level (0-9)
          adaptiveFiltering: true,
        });

      case 'webp':
        return sharpInstance.webp({
          quality,
          effort: 6, // Good balance between compression and speed
          smartSubsample: true,
        });

      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }

  /**
   * Ensure directory exists for the given file path
   */
  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Get image metadata without processing
   */
  async getImageMetadata(inputBuffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(inputBuffer).metadata();
  }

  /**
   * Validate image processing options
   */
  validateProcessingOptions(options: ImageProcessingOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate output path
    if (!options.outputPath || typeof options.outputPath !== 'string') {
      errors.push('Output path is required and must be a string');
    }

    // Validate quality
    if (options.quality !== undefined && (options.quality < 1 || options.quality > 100)) {
      errors.push('Quality must be between 1 and 100');
    }

    // Validate resize options
    if (options.resize) {
      if (options.resize.width !== undefined && options.resize.width <= 0) {
        errors.push('Resize width must be greater than 0');
      }
      if (options.resize.height !== undefined && options.resize.height <= 0) {
        errors.push('Resize height must be greater than 0');
      }
      if (!options.resize.width && !options.resize.height) {
        errors.push('At least one of width or height must be specified for resize');
      }
    }

    // Validate output format
    if (options.outputFormat && !['jpg', 'jpeg', 'png', 'webp'].includes(options.outputFormat)) {
      errors.push('Output format must be one of: jpg, jpeg, png, webp');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate optimal dimensions while maintaining aspect ratio
   */
  calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth?: number,
    targetHeight?: number,
    fit: 'cover' | 'contain' | 'fill' = 'contain'
  ): { width: number; height: number } {
    if (!targetWidth && !targetHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    if (targetWidth && targetHeight) {
      if (fit === 'fill') {
        return { width: targetWidth, height: targetHeight };
      }

      const originalRatio = originalWidth / originalHeight;
      const targetRatio = targetWidth / targetHeight;

      if (fit === 'contain') {
        if (originalRatio > targetRatio) {
          return { width: targetWidth, height: Math.round(targetWidth / originalRatio) };
        } else {
          return { width: Math.round(targetHeight * originalRatio), height: targetHeight };
        }
      } else if (fit === 'cover') {
        if (originalRatio > targetRatio) {
          return { width: Math.round(targetHeight * originalRatio), height: targetHeight };
        } else {
          return { width: targetWidth, height: Math.round(targetWidth / originalRatio) };
        }
      }
    }

    if (targetWidth) {
      const ratio = originalHeight / originalWidth;
      return { width: targetWidth, height: Math.round(targetWidth * ratio) };
    }

    if (targetHeight) {
      const ratio = originalWidth / originalHeight;
      return { width: Math.round(targetHeight * ratio), height: targetHeight };
    }

    return { width: originalWidth, height: originalHeight };
  }

  /**
   * Get supported formats
   */
  getSupportedFormats(): OutputFormat[] {
    return ['jpg', 'jpeg', 'png', 'webp'];
  }
} 