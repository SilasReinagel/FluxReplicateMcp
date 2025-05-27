/**
 * Simple temporary file management for Flux Replicate MCP Server
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { processingError } from './errors.js';

/**
 * Simple temp manager
 */
export class TempManager {
  private tempDir: string;
  private tempFiles: Set<string> = new Set();

  constructor() {
    this.tempDir = join(tmpdir(), 'flux-replicate-mcp');
  }

  /**
   * Create a temporary file path
   */
  createTempFile = async (extension: string = '.tmp'): Promise<string> => {
    try {
      // Ensure temp directory exists
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const filename = `flux-${timestamp}-${random}${extension}`;
      const tempPath = join(this.tempDir, filename);
      
      // Track the temp file
      this.tempFiles.add(tempPath);
      
      return tempPath;
    } catch (error) {
      if (error instanceof Error) {
        throw processingError(`Failed to create temp file: ${error.message}`);
      }
      throw processingError('Failed to create temp file');
    }
  };

  /**
   * Clean up a specific temp file
   */
  cleanupFile = async (filePath: string): Promise<void> => {
    try {
      await fs.unlink(filePath);
      this.tempFiles.delete(filePath);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  };

  /**
   * Clean up all tracked temp files
   */
  cleanupAll = async (): Promise<void> => {
    const promises = Array.from(this.tempFiles).map(filePath => this.cleanupFile(filePath));
    await Promise.allSettled(promises);
    this.tempFiles.clear();
  };

  /**
   * Get temp directory path
   */
  getTempDir = (): string => {
    return this.tempDir;
  };
} 