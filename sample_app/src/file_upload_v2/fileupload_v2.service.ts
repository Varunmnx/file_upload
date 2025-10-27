/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-misused-promises */
// src/chunk-upload/fileupload_v2.service.ts
import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ChunkUploadResponse, UploadStatusResponse } from './dto';
import { pipeline } from 'stream/promises';

interface ActiveUpload {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  storageMethod: 'disk' | 'memory';
  lastUpdated: Date;
  locked?: boolean; // Concurrency protection
}

@Injectable()
export class ChunkUploadService implements OnModuleInit {
  private readonly logger = new Logger(ChunkUploadService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly tempDir = path.join(this.uploadDir, 'temp');
  private readonly statusFile = path.join(this.uploadDir, 'upload-status.json');
  private activeUploads: Map<string, ActiveUpload> = new Map();
  private readonly maxActiveUploads = 1000; // Prevent memory leaks
  private cleanupInterval?: NodeJS.Timeout;
  private isInitialized = false;

  async onModuleInit() {
    await this.initialize();
  }

  private async initialize() {
    try {
      await this.ensureDirectoryExists(this.uploadDir);
      await this.ensureDirectoryExists(this.tempDir);
      await this.loadUploadStatus();
      this.startCleanupScheduler();
      this.isInitialized = true;
      this.logger.log('ChunkUploadService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ChunkUploadService', error);
      throw error;
    }
  }

  private async loadUploadStatus() {
    try {
      const fileExists = await fs.promises
        .access(this.statusFile)
        .then(() => true)
        .catch(() => false);

      if (fileExists) {
        const data = await fs.promises.readFile(this.statusFile, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, ActiveUpload>;

        // Convert to Map and restore Date objects
        this.activeUploads = new Map(
          Object.entries(parsed).map(([key, value]) => [key, { ...value, lastUpdated: new Date(value.lastUpdated) }]),
        );

        this.logger.log(`Loaded ${this.activeUploads.size} active uploads`);
      }
    } catch (error) {
      this.logger.error('Failed to load upload status', error);
      this.activeUploads = new Map();
    }
  }

  private async saveUploadStatus() {
    try {
      const obj = Object.fromEntries(this.activeUploads);
      await fs.promises.writeFile(this.statusFile, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save upload status', error);
      throw new InternalServerErrorException('Failed to persist upload status');
    }
  }

  async getUploadStatus(fileId: string): Promise<UploadStatusResponse> {
    const upload = this.activeUploads.get(fileId);
    if (!upload) {
      return { exists: false };
    }

    const chunkDir = this.getChunkDir(fileId);
    let existingChunks: number[] = [];

    try {
      const dirExists = await fs.promises
        .access(chunkDir)
        .then(() => true)
        .catch(() => false);

      if (dirExists) {
        const files = await fs.promises.readdir(chunkDir);
        existingChunks = files.map((f) => parseInt(f.split('.')[0])).filter((n) => !isNaN(n));
      }
    } catch (error) {
      this.logger.error(`Error reading chunks for ${fileId}:`, error);
    }

    // Combine chunks from metadata and filesystem
    const allChunks = Array.from(new Set([...(upload.uploadedChunks || []), ...existingChunks])).sort((a, b) => a - b);

    return {
      exists: true,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      totalChunks: upload.totalChunks,
      uploadedChunks: allChunks,
      storageMethod: upload.storageMethod,
      lastUpdated: upload.lastUpdated.toISOString(),
    };
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.promises.mkdir(dir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory ${dir}:`, error);
      throw error;
    }
  }

  async startChunkUpload(
    fileName: string,
    fileSize: number,
    totalChunks: number,
    storageMethod: 'disk' | 'memory' = 'disk',
  ): Promise<ChunkUploadResponse> {
    this.checkInitialized();
    this.checkUploadLimit();

    const fileId = uuidv4();
    const chunkDir = this.getChunkDir(fileId);
    await this.ensureDirectoryExists(chunkDir);

    this.activeUploads.set(fileId, {
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: [],
      storageMethod,
      lastUpdated: new Date(),
      locked: false,
    });

    await this.saveUploadStatus();

    this.logger.log(`Started upload session ${fileId} for ${fileName}`);

    return {
      fileId,
      message: 'Chunk upload session started',
    };
  }

  async resumeChunkUpload(
    fileName: string,
    fileSize: number,
    totalChunks: number,
    fileId: string,
    storageMethod: 'disk' | 'memory' = 'disk',
  ): Promise<ChunkUploadResponse> {
    this.checkInitialized();

    const existingUpload = this.activeUploads.get(fileId);
    if (!existingUpload) {
      throw new InternalServerErrorException('Upload session not found');
    }

    // Verify the existing upload matches the resume request
    if (
      existingUpload.fileName !== fileName ||
      existingUpload.fileSize !== fileSize ||
      existingUpload.totalChunks !== totalChunks ||
      existingUpload.storageMethod !== storageMethod
    ) {
      throw new InternalServerErrorException('Upload parameters do not match existing session');
    }

    // Ensure the chunk directory exists
    const chunkDir = this.getChunkDir(fileId);
    await this.ensureDirectoryExists(chunkDir);

    // Update the last modified time
    existingUpload.lastUpdated = new Date();
    await this.saveUploadStatus();

    const status = await this.getUploadStatus(fileId);

    this.logger.log(`Resumed upload session ${fileId} for ${fileName}`);

    return {
      fileId,
      message: 'Chunk upload session resumed',
      resumed: true,
      uploadedChunks: status.uploadedChunks,
    };
  }

  async uploadChunk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    chunk: Express.Multer.File,
    storageMethod: 'disk' | 'memory' = 'disk',
  ): Promise<ChunkUploadResponse> {
    this.checkInitialized();

    const upload = this.activeUploads.get(fileId);
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }

    // Check if locked
    if (upload.locked) {
      throw new InternalServerErrorException('Upload is being finalized');
    }

    // Verify the chunk index is within bounds
    if (chunkIndex < 0 || chunkIndex >= totalChunks) {
      throw new InternalServerErrorException(`Invalid chunk index: ${chunkIndex}`);
    }

    const chunkDir = this.getChunkDir(fileId);
    const chunkFilename = this.getChunkFilename(chunkIndex);
    const chunkPath = path.join(chunkDir, chunkFilename);

    // Check if this chunk was already uploaded
    const chunkExists = await fs.promises
      .access(chunkPath)
      .then(() => true)
      .catch(() => false);

    if (chunkExists) {
      this.logger.log(`Chunk ${chunkIndex} for ${fileId} already exists, skipping`);
      return {
        fileId,
        chunkIndex,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} already uploaded`,
        skipped: true,
      };
    }

    await this.ensureDirectoryExists(chunkDir);

    try {
      if (storageMethod === 'disk' && chunk.path) {
        // Move the uploaded file
        await fs.promises.rename(chunk.path, chunkPath);
      } else if (chunk.buffer) {
        // Write from buffer
        await fs.promises.writeFile(chunkPath, chunk.buffer);
      } else {
        throw new InternalServerErrorException('No chunk data available');
      }

      // Update upload status
      upload.uploadedChunks = Array.from(new Set([...upload.uploadedChunks, chunkIndex])).sort((a, b) => a - b);
      upload.lastUpdated = new Date();
      await this.saveUploadStatus();

      this.logger.log(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} for ${fileId}`);

      return {
        fileId,
        chunkIndex,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to save chunk ${chunkIndex} for ${fileId}:`, error);
      throw new InternalServerErrorException(`Failed to save chunk ${chunkIndex}: ${error.message}`);
    }
  }

  async completeChunkUpload(
    fileId: string,
    fileName: string,
    totalChunks: number,
    storageMethod?: 'disk' | 'memory',
  ): Promise<ChunkUploadResponse> {
    this.checkInitialized();

    const upload = this.activeUploads.get(fileId);
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }

    // Lock the upload to prevent concurrent modifications
    if (upload.locked) {
      throw new InternalServerErrorException('Upload is already being finalized');
    }
    upload.locked = true;

    try {
      const chunkDir = this.getChunkDir(fileId);
      const finalPath = path.join(this.uploadDir, fileName);

      // Verify all chunks are present
      const chunks = await fs.promises.readdir(chunkDir);
      if (chunks.length !== totalChunks) {
        throw new InternalServerErrorException(`Incomplete upload. Found ${chunks.length} of ${totalChunks} chunks.`);
      }

      // Sort chunks numerically
      const sortedChunks = chunks.sort((a, b) => parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]));

      // Merge chunks using streaming
      await this.mergeChunksStreaming(chunkDir, sortedChunks, finalPath);

      // Clean up chunk directory
      await fs.promises.rm(chunkDir, { recursive: true, force: true });

      // Clean up upload status
      this.activeUploads.delete(fileId);
      await this.saveUploadStatus();

      this.logger.log(`Completed upload ${fileId}: ${fileName}`);

      return {
        fileId,
        finalPath,
        message: 'File successfully merged',
      };
    } catch (error) {
      upload.locked = false; // Unlock on error
      this.logger.error(`Failed to complete upload ${fileId}:`, error);
      throw new InternalServerErrorException(`Failed to merge file: ${error.message}`);
    }
  }

  private async mergeChunksStreaming(chunkDir: string, sortedChunks: string[], finalPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(finalPath);
      let currentIndex = 0;

      writeStream.on('error', (error) => {
        this.logger.error('Write stream error:', error);
        reject(error);
      });

      const writeNext = async () => {
        if (currentIndex >= sortedChunks.length) {
          writeStream.end();
          return;
        }

        const chunkPath = path.join(chunkDir, sortedChunks[currentIndex]);
        const readStream = fs.createReadStream(chunkPath);

        readStream.on('error', (error) => {
          this.logger.error(`Read stream error for chunk ${currentIndex}:`, error);
          reject(error);
        });

        readStream.on('end', async () => {
          try {
            await fs.promises.unlink(chunkPath);
            currentIndex++;
            await writeNext();
          } catch (error) {
            this.logger.error(`Failed to delete chunk ${currentIndex}:`, error);
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(error);
          }
        });

        readStream.pipe(writeStream, { end: false });
      };

      writeStream.on('finish', () => {
        this.logger.log('All chunks merged successfully');
        resolve();
      });

      writeNext();
    });
  }

  private getChunkDir(fileId: string): string {
    return path.join(this.tempDir, fileId);
  }

  private getChunkFilename(chunkIndex: number): string {
    return `${chunkIndex}.chunk`;
  }

  async cleanupAbandonedUploads(): Promise<void> {
    const now = new Date();
    const abandonedThreshold = 24 * 60 * 60 * 1000; // 24 hours

    let cleanedCount = 0;

    for (const [fileId, upload] of this.activeUploads.entries()) {
      if (upload.locked) {
        continue; // Skip locked uploads
      }

      const lastUpdated = new Date(upload.lastUpdated);
      if (now.getTime() - lastUpdated.getTime() > abandonedThreshold) {
        try {
          const chunkDir = this.getChunkDir(fileId);
          const dirExists = await fs.promises
            .access(chunkDir)
            .then(() => true)
            .catch(() => false);

          if (dirExists) {
            await fs.promises.rm(chunkDir, { recursive: true, force: true });
          }

          this.activeUploads.delete(fileId);
          cleanedCount++;
        } catch (error) {
          this.logger.error(`Error cleaning up upload ${fileId}:`, error);
        }
      }
    }

    if (cleanedCount > 0) {
      await this.saveUploadStatus();
      this.logger.log(`Cleaned up ${cleanedCount} abandoned uploads`);
    }
  }

  private startCleanupScheduler() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupAbandonedUploads().catch((error) => {
          this.logger.error('Cleanup scheduler error:', error);
        });
      },
      60 * 60 * 1000,
    );
  }

  private checkInitialized() {
    if (!this.isInitialized) {
      throw new InternalServerErrorException('Service not initialized');
    }
  }

  private checkUploadLimit() {
    if (this.activeUploads.size >= this.maxActiveUploads) {
      throw new InternalServerErrorException('Maximum concurrent uploads reached. Please try again later.');
    }
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.saveUploadStatus();
    this.logger.log('ChunkUploadService destroyed');
  }
}
