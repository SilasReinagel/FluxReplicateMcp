#!/usr/bin/env node

/**
 * Simple Flux Replicate MCP Server
 * Generates images using Flux models via Replicate API
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ReplicateClient } from './replicate.js';
import { ImageProcessor } from './image.js';
import { TempManager } from './temp.js';
import { getConfig, ensureWorkingDirectory } from './config.js';
import { validationError, processingError, McpError } from './errors.js';
import { info, error } from './log.js';
import { join, isAbsolute, basename, dirname } from 'path';
import { promises as fs } from 'fs';

/**
 * Simple MCP Server for Flux image generation
 */
class FluxMcpServer {
  private server: Server;
  private replicateClient: ReplicateClient;
  private imageProcessor: ImageProcessor;
  private tempManager: TempManager;
  private workingDirectory: string = '';

  constructor() {
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

    this.replicateClient = new ReplicateClient();
    this.imageProcessor = new ImageProcessor();
    this.tempManager = new TempManager();

    this.setupHandlers();
  }

  /**
   * Set up MCP request handlers
   */
  private setupHandlers = (): void => {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description: 'Generate images using Flux Pro or Flux Schnell models',
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
                  description: 'Flux model to use (default: flux-pro)',
                },
                output_directory: {
                  type: 'string',
                  description: 'Output directory relative to working directory (optional, defaults to working directory root)',
                },
                filename: {
                  type: 'string',
                  description: 'Output filename with extension (optional, auto-generated if not provided)',
                },
                output_path: {
                  type: 'string',
                  description: 'Complete output path (alternative to output_directory + filename). If provided, takes precedence over output_directory and filename.',
                },
                width: {
                  type: 'number',
                  description: 'Image width in pixels (default: 1024)',
                },
                height: {
                  type: 'number',
                  description: 'Image height in pixels (default: 1024)',
                },
                quality: {
                  type: 'number',
                  minimum: 1,
                  maximum: 100,
                  description: 'Image quality for lossy formats (default: 80)',
                },
              },
              required: ['prompt'],
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
          return await this.handleGenerateImage(args);
        } catch (err) {
          const mcpError = err instanceof McpError ? err : processingError('Unknown error occurred');
          error('Image generation failed', { error: mcpError.message, args });
          
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${mcpError.message}`,
              },
            ],
            isError: true,
          };
        }
      }

      throw validationError(`Unknown tool: ${name}`);
    });
  };

  /**
   * Generate a filename based on prompt and timestamp
   */
  private generateFilename = (prompt: string, format: string): string => {
    // Clean prompt for filename (remove special characters, limit length)
    const cleanPrompt = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    return `${cleanPrompt}_${timestamp}.${format}`;
  };

  /**
   * Resolve output path to working directory
   */
  private resolveOutputPath = (outputDirectory: string | undefined, filename: string | undefined, outputPath: string | undefined, prompt: string, defaultFormat: string): string => {
    // If output_path is provided, use it (legacy support)
    if (outputPath) {
      // If it's an absolute path, extract just the filename and put it in working directory
      if (isAbsolute(outputPath)) {
        const filename = basename(outputPath);
        return join(this.workingDirectory, filename);
      }
      // If it's a relative path, join it with working directory
      return join(this.workingDirectory, outputPath);
    }

    // Use output_directory and filename
    const directory = outputDirectory || '';
    const file = filename || this.generateFilename(prompt, defaultFormat);
    
    // Ensure directory is relative to working directory
    const resolvedDirectory = isAbsolute(directory) 
      ? this.workingDirectory 
      : join(this.workingDirectory, directory);
    
    return join(resolvedDirectory, file);
  };

  /**
   * Handle image generation request
   */
  private handleGenerateImage = async (args: any): Promise<any> => {
    // Validate required parameters
    if (!args.prompt || typeof args.prompt !== 'string' || args.prompt.trim().length === 0) {
      throw validationError('Prompt is required and must be a non-empty string');
    }

    // Validate that we have some way to determine output path
    if (!args.output_path && !args.filename && !args.output_directory) {
      // We'll auto-generate filename, so this is OK
    }

    const prompt = args.prompt.trim();
    const config = getConfig();
    
    // Resolve output path using new logic
    const resolvedOutputPath = this.resolveOutputPath(
      args.output_directory, 
      args.filename, 
      args.output_path, 
      prompt,
      config.outputFormat
    );
    
    // Ensure we have a valid model string
    const modelParam: string = args.model || config.defaultModel;
    const width = args.width || 1024;
    const height = args.height || 1024;
    const quality = args.quality || config.outputQuality;

    // Validate and ensure model is supported
    if (!this.replicateClient.isModelSupported(modelParam)) {
      throw validationError(`Unsupported model: ${modelParam}. Supported models: ${this.replicateClient.getAvailableModels().join(', ')}`);
    }

    // Now we know model is a valid FluxModel
    const model = modelParam;

    info('Starting image generation', { 
      prompt, 
      model, 
      outputDirectory: args.output_directory,
      filename: args.filename,
      outputPath: args.output_path,
      resolvedOutputPath, 
      workingDirectory: this.workingDirectory,
      width, 
      height 
    });

    try {
      // Generate image
      const result = await this.replicateClient.generateImage({
        prompt,
        model,
        width,
        height,
      });

      if (result.imageUrls.length === 0) {
        throw processingError('No images were generated');
      }

      // Download the first image
      const imageUrl = result.imageUrls[0];
      if (!imageUrl) {
        throw processingError('No valid image URL returned');
      }
      
      const imageBuffer = await this.replicateClient.downloadImage(imageUrl);

      // Ensure output directory exists
      const outputDir = dirname(resolvedOutputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Process and save the image
      const processResult = await this.imageProcessor.processImage(imageBuffer, {
        outputPath: resolvedOutputPath,
        quality,
        width: args.width,
        height: args.height,
      });

      info('Image generation completed', {
        outputPath: processResult.outputPath,
        fileSize: processResult.fileSize,
        dimensions: `${processResult.width}x${processResult.height}`,
        processingTime: result.processingTime,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Image generated successfully!\n\nOutput: ${processResult.outputPath}\nDimensions: ${processResult.width}x${processResult.height}\nFile size: ${Math.round(processResult.fileSize / 1024)}KB\nProcessing time: ${result.processingTime}ms\nWorking Directory: ${this.workingDirectory}`,
          },
        ],
      };

    } catch (err) {
      // Clean up any temp files
      await this.tempManager.cleanupAll();
      throw err;
    }
  };

  /**
   * Start the MCP server
   */
  start = async (): Promise<void> => {
    try {
      // Validate configuration
      const config = getConfig();
      
      // Initialize working directory
      this.workingDirectory = await ensureWorkingDirectory(config.workingDirectory);
      
      info('Starting Flux Replicate MCP Server', {
        platform: process.platform,
        workingDirectory: this.workingDirectory
      });
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      info('Server started successfully', {
        workingDirectory: this.workingDirectory
      });
    } catch (err) {
      error('Failed to start server', { error: err instanceof Error ? err.message : 'Unknown error' });
      process.exit(1);
    }
  };

  /**
   * Shutdown the server
   */
  shutdown = async (): Promise<void> => {
    info('Shutting down server');
    await this.tempManager.cleanupAll();
    await this.server.close();
  };
}

/**
 * Main entry point
 */
const main = async (): Promise<void> => {
  const server = new FluxMcpServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.shutdown();
    process.exit(0);
  });

  await server.start();
};

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    error('Server crashed', { error: err instanceof Error ? err.message : 'Unknown error' });
    process.exit(1);
  });
} 