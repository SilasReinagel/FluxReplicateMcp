#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ConfigManager } from './config.js';
import { SetupManager } from './setup.js';
import { ReplicateClient, type FluxModel, type AspectRatio } from './replicate-client.js';
import { ImageProcessor, type OutputFormat, type ImageProcessingOptions } from './image-processor.js';
import { TempManager } from './temp-manager.js';
import { promises as fs } from 'fs';
import { dirname, extname } from 'path';

/**
 * Flux Replicate MCP Server
 * Provides image generation capabilities using Flux Pro and Flux Schnell models via Replicate API
 */
class FluxReplicateMcpServer {
  private server: Server;
  private configManager: ConfigManager;
  private setupManager: SetupManager;
  private replicateClient: ReplicateClient | null = null;
  private imageProcessor: ImageProcessor;
  private tempManager: TempManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.setupManager = new SetupManager();
    this.imageProcessor = new ImageProcessor();
    this.tempManager = new TempManager();
    this.server = new Server(
      {
        name: 'flux-replicate-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * Set up tool handlers for the MCP server
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate images using Flux Pro or Flux Schnell models via Replicate API',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'Text description of the image to generate',
                },
                model: {
                  type: 'string',
                  enum: ['flux-pro', 'flux-schnell'],
                  description: 'Flux model to use for generation',
                  default: 'flux-pro',
                },
                aspect_ratio: {
                  type: 'string',
                  enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
                  description: 'Aspect ratio for the generated image',
                  default: '1:1',
                },
                output_path: {
                  type: 'string',
                  description: 'Local file path where the generated image will be saved',
                },
                final_width: {
                  type: 'number',
                  description: 'Target width for final image processing (optional)',
                },
                final_height: {
                  type: 'number',
                  description: 'Target height for final image processing (optional)',
                },
                output_format: {
                  type: 'string',
                  enum: ['jpg', 'png', 'webp'],
                  description: 'Output image format',
                  default: 'jpg',
                },
                quality: {
                  type: 'number',
                  minimum: 1,
                  maximum: 100,
                  description: 'Image quality for lossy formats (1-100)',
                  default: 80,
                },
              },
              required: ['prompt', 'output_path'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (name === 'generate_image') {
        try {
          return await this.handleImageGeneration(args);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          return {
            content: [
              {
                type: 'text',
                text: `Error generating image: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw new Error(`Unknown tool: ${name}`);
    });
  }

  /**
   * Handle image generation tool call
   */
  private async handleImageGeneration(args: any): Promise<any> {
    if (!this.replicateClient) {
      throw new Error('Replicate client not initialized');
    }

    // Extract and validate parameters
    const {
      prompt,
      model = this.configManager.getDefaultModel(),
      aspect_ratio = this.configManager.getDefaultAspectRatio(),
      output_path,
      final_width,
      final_height,
      output_format = this.configManager.getDefaultOutputFormat(),
      quality = this.configManager.getDefaultQuality(),
    } = args;

    // Validate required parameters
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    if (!output_path || typeof output_path !== 'string') {
      throw new Error('Output path is required and must be a string');
    }

    // Validate parameters with Replicate client
    const validation = this.replicateClient.validateParams({
      prompt,
      model: model as FluxModel,
      aspect_ratio: aspect_ratio as AspectRatio,
    });

    if (!validation.isValid) {
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    // Ensure output directory exists
    await this.ensureDirectoryExists(output_path);

    // Generate image
    const startTime = Date.now();
    console.error(`Starting image generation...`);

    const result = await this.replicateClient.generateImageWithRetry({
      prompt,
      model: model as FluxModel,
      aspect_ratio: aspect_ratio as AspectRatio,
    });

    if (!result.success) {
      throw new Error(result.error || 'Image generation failed');
    }

    // Download and save the first image
    const imageUrl = result.imageUrls[0];
    if (!imageUrl) {
      throw new Error('No image URL returned from generation');
    }

    console.error(`Downloading image from: ${imageUrl}`);
    const imageBuffer = await this.replicateClient.downloadImage(imageUrl);

    // Check if we need image processing
    const needsProcessing = final_width || final_height || 
                           output_format !== this.determineFormatFromPath(output_path) ||
                           quality !== this.configManager.getDefaultQuality();

    let finalPath = output_path;
    let processingResult;

    if (needsProcessing) {
      // Create temporary file for processing
      const tempPath = await this.tempManager.createTempFile('processing', '.tmp');
      
      try {
        // Prepare processing options
        const processingOptions: ImageProcessingOptions = {
          outputPath: output_path,
          outputFormat: output_format as OutputFormat,
          quality,
        };

        // Add resize options if specified
        if (final_width || final_height) {
          processingOptions.resize = {
            width: final_width,
            height: final_height,
            fit: 'contain', // Maintain aspect ratio by default
          };
        }

        // Validate processing options
        const validation = this.imageProcessor.validateProcessingOptions(processingOptions);
        if (!validation.isValid) {
          throw new Error(`Invalid processing options: ${validation.errors.join(', ')}`);
        }

        // Process the image
        console.error(`Processing image with Sharp...`);
        processingResult = await this.imageProcessor.processImage(imageBuffer, processingOptions);

        if (!processingResult.success) {
          throw new Error(processingResult.error || 'Image processing failed');
        }

        console.error(`Image processing completed in ${processingResult.processingTime}ms`);
        
        // Clean up temp file
        await this.tempManager.cleanupTempFile(tempPath);
      } catch (error) {
        // Clean up temp file on error
        await this.tempManager.cleanupTempFile(tempPath);
        throw error;
      }
    } else {
      // No processing needed, save directly
      await this.ensureDirectoryExists(output_path);
      await fs.writeFile(output_path, imageBuffer);
      
      // Get original image metadata for response
      const metadata = await this.imageProcessor.getImageMetadata(imageBuffer);
      processingResult = {
        success: true,
        outputPath: output_path,
        originalDimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0,
        },
        finalDimensions: {
          width: metadata.width || 0,
          height: metadata.height || 0,
        },
        outputFormat: this.determineFormatFromPath(output_path),
        fileSize: imageBuffer.length,
        processingTime: 0,
      };
    }

    const totalTime = Date.now() - startTime;
    const estimatedCost = this.replicateClient.estimateCost(model as FluxModel);

    console.error(`Image generation completed in ${totalTime}ms`);
    console.error(`Estimated cost: $${estimatedCost.toFixed(4)}`);

    // Return success response
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            local_file_path: processingResult.outputPath,
            generation_cost: estimatedCost,
            model_used: result.model,
            original_dimensions: processingResult.originalDimensions,
            final_dimensions: processingResult.finalDimensions,
            output_format: processingResult.outputFormat,
            file_size: processingResult.fileSize,
            processing_time: totalTime,
            image_processing_time: processingResult.processingTime,
          }, null, 2),
        },
      ],
    };
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
   * Determine output format from file path extension
   */
  private determineFormatFromPath(filePath: string): OutputFormat {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'jpg';
      case '.png':
        return 'png';
      case '.webp':
        return 'webp';
      default:
        return this.configManager.getDefaultOutputFormat();
    }
  }

  /**
   * Set up error handling for the server
   */
  private setupErrorHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    // Handle SIGTERM
    process.on('SIGTERM', async () => {
      console.error('Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Initialize the server (load config, run setup if needed)
   */
  async initialize(): Promise<boolean> {
    try {
      // Initialize configuration
      await this.configManager.initialize();

      // Check if setup is required
      if (this.setupManager.isSetupRequired()) {
        console.error('First-time setup required...');
        const setupSuccess = await this.setupManager.runSetup();
        if (!setupSuccess) {
          return false;
        }
      }

      // Initialize Replicate client
      try {
        this.replicateClient = new ReplicateClient();
        
        // Perform health check
        const healthCheck = await this.replicateClient.healthCheck();
        if (!healthCheck.healthy) {
          console.error('Replicate API health check failed:', healthCheck.error);
          return false;
        }
        
        console.error('Replicate API connection verified');
      } catch (error) {
        console.error('Failed to initialize Replicate client:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize server:', error);
      return false;
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Flux Replicate MCP Server running on stdio');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.error('Shutting down server...');
    await this.tempManager.shutdown();
  }
}

/**
 * Main function to start the server
 */
async function main(): Promise<void> {
  try {
    const server = new FluxReplicateMcpServer();
    
    // Initialize server (config and setup)
    const initialized = await server.initialize();
    if (!initialized) {
      console.error('Server initialization failed');
      process.exit(1);
    }
    
    // Start the MCP server
    await server.start();
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
} 