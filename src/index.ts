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
import { getConfig } from './config.js';
import { validationError, processingError, McpError } from './errors.js';
import { info, error } from './log.js';

/**
 * Simple MCP Server for Flux image generation
 */
class FluxMcpServer {
  private server: Server;
  private replicateClient: ReplicateClient;
  private imageProcessor: ImageProcessor;
  private tempManager: TempManager;

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
  private setupHandlers(): void {
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
                output_path: {
                  type: 'string',
                  description: 'Local file path where the image will be saved',
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
  }

  /**
   * Handle image generation request
   */
  private async handleGenerateImage(args: any): Promise<any> {
    // Validate required parameters
    if (!args.prompt || typeof args.prompt !== 'string' || args.prompt.trim().length === 0) {
      throw validationError('Prompt is required and must be a non-empty string');
    }

    if (!args.output_path || typeof args.output_path !== 'string') {
      throw validationError('Output path is required and must be a valid file path');
    }

    const prompt = args.prompt.trim();
    const outputPath = args.output_path;
    const config = getConfig();
    
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

    info('Starting image generation', { prompt, model, outputPath, width, height });

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

      // Process and save the image
      const processResult = await this.imageProcessor.processImage(imageBuffer, {
        outputPath,
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
            text: `Image generated successfully!\n\nOutput: ${processResult.outputPath}\nDimensions: ${processResult.width}x${processResult.height}\nFile size: ${Math.round(processResult.fileSize / 1024)}KB\nProcessing time: ${result.processingTime}ms`,
          },
        ],
      };

    } catch (err) {
      // Clean up any temp files
      await this.tempManager.cleanupAll();
      throw err;
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      // Validate configuration
      getConfig(); // This will throw if config is invalid
      
      info('Starting Flux Replicate MCP Server');
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      info('Server started successfully');
    } catch (err) {
      error('Failed to start server', { error: err instanceof Error ? err.message : 'Unknown error' });
      process.exit(1);
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    info('Shutting down server');
    await this.tempManager.cleanupAll();
    await this.server.close();
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
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
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    error('Server crashed', { error: err instanceof Error ? err.message : 'Unknown error' });
    process.exit(1);
  });
} 