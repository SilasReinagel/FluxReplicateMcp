import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImageProcessor, type ImageProcessingOptions } from './image-processor.js';
import { ConfigManager } from './config.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import sharp from 'sharp';

describe('ImageProcessor', () => {
  let imageProcessor: ImageProcessor;
  let tempDir: string;
  let testImageBuffer: Buffer;

  beforeEach(async () => {
    // Reset singleton instance
    ConfigManager.resetInstance();
    
    // Create a temporary directory for testing
    tempDir = join(tmpdir(), 'image-processor-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create a custom config directory in the temp directory
    const customConfigDir = join(tempDir, '.flux-replicate-mcp');
    
    // Get a fresh instance with custom config directory
    ConfigManager.getInstance(customConfigDir);
    imageProcessor = new ImageProcessor();

    // Create a test image buffer (100x100 red square)
    testImageBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    })
    .png()
    .toBuffer();
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

  describe('processImage', () => {
    it('should process image without resize', async () => {
      const outputPath = join(tempDir, 'output.jpg');
      const options: ImageProcessingOptions = {
        outputPath,
        outputFormat: 'jpg',
        quality: 80,
      };

      const result = await imageProcessor.processImage(testImageBuffer, options);

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe(outputPath);
      expect(result.originalDimensions).toEqual({ width: 100, height: 100 });
      expect(result.finalDimensions).toEqual({ width: 100, height: 100 });
      expect(result.outputFormat).toBe('jpg');
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify file was created
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should resize image while maintaining aspect ratio', async () => {
      const outputPath = join(tempDir, 'resized.png');
      const options: ImageProcessingOptions = {
        outputPath,
        outputFormat: 'png',
        resize: {
          width: 50,
          height: 50,
          fit: 'contain',
        },
      };

      const result = await imageProcessor.processImage(testImageBuffer, options);

      expect(result.success).toBe(true);
      expect(result.originalDimensions).toEqual({ width: 100, height: 100 });
      expect(result.finalDimensions).toEqual({ width: 50, height: 50 });
      expect(result.outputFormat).toBe('png');
    });

    it('should handle processing errors gracefully', async () => {
      const outputPath = '/invalid/path/output.jpg';
      const options: ImageProcessingOptions = {
        outputPath,
        outputFormat: 'jpg',
      };

      const result = await imageProcessor.processImage(testImageBuffer, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should convert between formats', async () => {
      const outputPath = join(tempDir, 'converted.webp');
      const options: ImageProcessingOptions = {
        outputPath,
        outputFormat: 'webp',
        quality: 90,
      };

      const result = await imageProcessor.processImage(testImageBuffer, options);

      expect(result.success).toBe(true);
      expect(result.outputFormat).toBe('webp');
      
      // Verify the output is actually WebP
      const outputBuffer = await fs.readFile(outputPath);
      const metadata = await sharp(outputBuffer).metadata();
      expect(metadata.format).toBe('webp');
    });
  });

  describe('validateProcessingOptions', () => {
    it('should validate valid options', () => {
      const options: ImageProcessingOptions = {
        outputPath: '/valid/path.jpg',
        outputFormat: 'jpg',
        quality: 80,
        resize: {
          width: 100,
          height: 100,
        },
      };

      const result = imageProcessor.validateProcessingOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid quality values', () => {
      const options: ImageProcessingOptions = {
        outputPath: '/valid/path.jpg',
        quality: 150, // Invalid: > 100
      };

      const result = imageProcessor.validateProcessingOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quality must be between 1 and 100');
    });

    it('should reject invalid resize options', () => {
      const options: ImageProcessingOptions = {
        outputPath: '/valid/path.jpg',
        resize: {
          width: -10, // Invalid: negative
        },
      };

      const result = imageProcessor.validateProcessingOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Resize width must be greater than 0');
    });

    it('should reject invalid output format', () => {
      const options: ImageProcessingOptions = {
        outputPath: '/valid/path.jpg',
        outputFormat: 'invalid' as any,
      };

      const result = imageProcessor.validateProcessingOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output format must be one of: jpg, jpeg, png, webp');
    });
  });

  describe('calculateOptimalDimensions', () => {
    it('should maintain aspect ratio with contain fit', () => {
      const result = imageProcessor.calculateOptimalDimensions(
        200, 100, // 2:1 aspect ratio
        100, 100, // Target square
        'contain'
      );

      expect(result).toEqual({ width: 100, height: 50 });
    });

    it('should fill target dimensions with cover fit', () => {
      const result = imageProcessor.calculateOptimalDimensions(
        200, 100, // 2:1 aspect ratio
        100, 100, // Target square
        'cover'
      );

      expect(result).toEqual({ width: 200, height: 100 });
    });

    it('should return exact dimensions with fill fit', () => {
      const result = imageProcessor.calculateOptimalDimensions(
        200, 100,
        150, 75,
        'fill'
      );

      expect(result).toEqual({ width: 150, height: 75 });
    });

    it('should handle width-only resize', () => {
      const result = imageProcessor.calculateOptimalDimensions(
        200, 100,
        100, undefined
      );

      expect(result).toEqual({ width: 100, height: 50 });
    });

    it('should handle height-only resize', () => {
      const result = imageProcessor.calculateOptimalDimensions(
        200, 100,
        undefined, 50
      );

      expect(result).toEqual({ width: 100, height: 50 });
    });
  });

  describe('getImageMetadata', () => {
    it('should return correct metadata', async () => {
      const metadata = await imageProcessor.getImageMetadata(testImageBuffer);

      expect(metadata.width).toBe(100);
      expect(metadata.height).toBe(100);
      expect(metadata.format).toBe('png');
      expect(metadata.channels).toBe(3);
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = imageProcessor.getSupportedFormats();
      expect(formats).toEqual(['jpg', 'jpeg', 'png', 'webp']);
    });
  });
}); 