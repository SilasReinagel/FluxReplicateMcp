import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { ConfigManager } from './config.js';

/**
 * Temporary file information
 */
export interface TempFileInfo {
  path: string;
  createdAt: Date;
  size: number;
  purpose: string;
}

/**
 * Disk space information
 */
export interface DiskSpaceInfo {
  available: number;
  total: number;
  used: number;
  percentUsed: number;
}

/**
 * Temporary file manager for handling temp files and cleanup
 */
export class TempManager {
  private configManager: ConfigManager;
  private tempDir: string;
  private tempFiles: Map<string, TempFileInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.configManager = ConfigManager.getInstance();
    this.tempDir = this.getTempDirectory();
    this.startCleanupScheduler();
  }

  /**
   * Get the temporary directory path
   */
  private getTempDirectory(): string {
    const configTempDir = this.configManager.getTempDirectory();
    
    // If it's a relative path, make it relative to the system temp directory
    if (configTempDir.startsWith('./') || configTempDir.startsWith('../')) {
      return join(tmpdir(), 'flux-replicate-mcp', configTempDir.replace(/^\.\//, ''));
    }
    
    // If it's an absolute path, use it directly
    if (configTempDir.startsWith('/') || configTempDir.match(/^[A-Za-z]:/)) {
      return configTempDir;
    }
    
    // Otherwise, treat it as a subdirectory of the system temp
    return join(tmpdir(), 'flux-replicate-mcp', configTempDir);
  }

  /**
   * Ensure temporary directory exists
   */
  async ensureTempDirectory(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
      // Set secure permissions (700 - owner read/write/execute only)
      await fs.chmod(this.tempDir, 0o700);
    }
  }

  /**
   * Create a temporary file path
   */
  async createTempFile(purpose: string, extension: string = ''): Promise<string> {
    await this.ensureTempDirectory();
    
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `flux-${purpose}-${timestamp}-${random}${extension}`;
    const tempPath = join(this.tempDir, filename);
    
    // Register the temp file
    this.tempFiles.set(tempPath, {
      path: tempPath,
      createdAt: new Date(),
      size: 0,
      purpose,
    });
    
    return tempPath;
  }

  /**
   * Create a temporary directory
   */
  async createTempDirectory(purpose: string): Promise<string> {
    await this.ensureTempDirectory();
    
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const dirname = `flux-${purpose}-${timestamp}-${random}`;
    const tempDirPath = join(this.tempDir, dirname);
    
    await fs.mkdir(tempDirPath, { recursive: true });
    await fs.chmod(tempDirPath, 0o700);
    
    // Register the temp directory
    this.tempFiles.set(tempDirPath, {
      path: tempDirPath,
      createdAt: new Date(),
      size: 0,
      purpose,
    });
    
    return tempDirPath;
  }

  /**
   * Update file size for a tracked temp file
   */
  async updateFileSize(filePath: string): Promise<void> {
    if (this.tempFiles.has(filePath)) {
      try {
        const stats = await fs.stat(filePath);
        const fileInfo = this.tempFiles.get(filePath)!;
        fileInfo.size = stats.size;
        this.tempFiles.set(filePath, fileInfo);
      } catch (error) {
        // File might not exist yet, ignore
      }
    }
  }

  /**
   * Clean up a specific temporary file or directory
   */
  async cleanupTempFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      
      this.tempFiles.delete(filePath);
      return true;
    } catch (error) {
      console.error(`Failed to cleanup temp file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Clean up all temporary files older than the specified age (in minutes)
   */
  async cleanupOldFiles(maxAgeMinutes: number = 60): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [filePath, fileInfo] of this.tempFiles.entries()) {
      if (fileInfo.createdAt < cutoffTime) {
        const success = await this.cleanupTempFile(filePath);
        if (success) {
          cleanedCount++;
        }
      }
    }
    
    return cleanedCount;
  }

  /**
   * Clean up all temporary files
   */
  async cleanupAllFiles(): Promise<number> {
    let cleanedCount = 0;
    
    for (const filePath of this.tempFiles.keys()) {
      const success = await this.cleanupTempFile(filePath);
      if (success) {
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Get disk space information for the temp directory
   */
  async getDiskSpaceInfo(): Promise<DiskSpaceInfo> {
    try {
      // Try to use statfs if available (Node.js 19+)
      if ('statfs' in fs) {
        const stats = await (fs as any).statfs(this.tempDir);
        
        const total = stats.blocks * stats.bsize;
        const available = stats.bavail * stats.bsize;
        const used = total - available;
        const percentUsed = total > 0 ? (used / total) * 100 : 0;
        
        return {
          total,
          available,
          used,
          percentUsed,
        };
      }
    } catch (error) {
      // Fallback if statfs is not available or fails
    }
    
    // Fallback: return default values
    console.warn('Could not get disk space info, using fallback method');
    return {
      total: 0,
      available: 0,
      used: 0,
      percentUsed: 0,
    };
  }

  /**
   * Check if there's enough disk space for a file of the given size
   */
  async hasEnoughSpace(requiredBytes: number, bufferPercentage: number = 10): Promise<boolean> {
    try {
      const diskInfo = await this.getDiskSpaceInfo();
      const bufferBytes = (diskInfo.total * bufferPercentage) / 100;
      const availableWithBuffer = diskInfo.available - bufferBytes;
      
      return availableWithBuffer >= requiredBytes;
    } catch (error) {
      console.warn('Could not check disk space, assuming sufficient space');
      return true; // Assume we have space if we can't check
    }
  }

  /**
   * Get information about all tracked temporary files
   */
  getTempFileInfo(): TempFileInfo[] {
    return Array.from(this.tempFiles.values());
  }

  /**
   * Get total size of all tracked temporary files
   */
  getTotalTempSize(): number {
    return Array.from(this.tempFiles.values()).reduce((total, file) => total + file.size, 0);
  }

  /**
   * Start automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Clean up old files every 30 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        const cleaned = await this.cleanupOldFiles(60); // Clean files older than 1 hour
        if (cleaned > 0) {
          console.error(`Cleaned up ${cleaned} old temporary files`);
        }
      } catch (error) {
        console.error('Error during scheduled cleanup:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Stop automatic cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Validate file path to prevent directory traversal attacks
   */
  validateFilePath(filePath: string): boolean {
    try {
      // Resolve the path and check if it's within the temp directory
      const resolvedPath = join(this.tempDir, filePath);
      const normalizedTempDir = join(this.tempDir, '/');
      const normalizedPath = join(resolvedPath, '/');
      
      return normalizedPath.startsWith(normalizedTempDir);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the temp directory path (for external use)
   */
  getTempDirectoryPath(): string {
    return this.tempDir;
  }

  /**
   * Graceful shutdown - cleanup all files and stop scheduler
   */
  async shutdown(): Promise<void> {
    this.stopCleanupScheduler();
    await this.cleanupAllFiles();
  }
} 