// src/chunk-upload/chunk-upload.service.ts
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ChunkUploadResponse, UploadStatusResponse } from './dto';

@Injectable()
export class ChunkUploadService {
  private readonly logger = new Logger(ChunkUploadService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly tempDir = path.join(this.uploadDir, 'temp');
  private readonly statusFile = path.join(this.uploadDir, 'upload-status.json');

  // Track active uploads in memory
  private activeUploads: Record<
    string,
    {
      fileName: string;
      fileSize: number;
      totalChunks: number;
      uploadedChunks: number[];
      storageMethod: 'disk' | 'memory';
      lastUpdated: Date;
    }
  > = {};

  constructor() {
    this.ensureDirectoryExists(this.uploadDir);
    this.ensureDirectoryExists(this.tempDir);
    this.loadUploadStatus();
    // this.loadUploadStatus();
  }

  private async loadUploadStatus() {
    try {
      if (fs.existsSync(this.statusFile)) {
        const data = await fs.promises.readFile(this.statusFile, 'utf-8');
        this.activeUploads = JSON.parse(data) as Record<string, any>;
      }
    } catch (error) {
      this.logger.error('Failed to load upload status', error);
    }
  }

  private async saveUploadStatus() {
    try {
      await fs.promises.writeFile(this.statusFile, JSON.stringify(this.activeUploads, null, 2));
    } catch (error) {
      this.logger.error('Failed to save upload status', error);
    }
  }

  getUploadStatus(fileId: string): UploadStatusResponse {
    const upload = this.activeUploads[fileId];
    if (!upload) return { exists: false };

    const chunkDir = this.getChunkDir(fileId);
    let existingChunks: number[] = [];

    try {
      existingChunks = fs.existsSync(chunkDir)
        ? fs
            .readdirSync(chunkDir)
            .map((f) => parseInt(f.split('.')[0]))
            .filter((n) => !isNaN(n))
        : [];
    } catch (error) {
      this.logger.error(`Error reading chunks: ${error}`);
    }

    return {
      exists: true,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      totalChunks: upload.totalChunks,
      uploadedChunks: Array.from(new Set([...(upload.uploadedChunks || []), ...existingChunks])).sort((a, b) => a - b),
      storageMethod: upload.storageMethod,
    };
  }

  private ensureDirectoryExists(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // private loadUploadStatus() {
  //   try {
  //     if (fs.existsSync(this.statusFile)) {
  //       const data = fs.readFileSync(this.statusFile, 'utf-8');
  //       // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  //       this.activeUploads = JSON.parse(data);
  //     }
  //   } catch (error) {
  //     this.logger.error('Failed to load upload status', error);
  //   }
  // }

  // private saveUploadStatus() {
  //   try {
  //     fs.writeFileSync(this.statusFile, JSON.stringify(this.activeUploads));
  //   } catch (error) {
  //     this.logger.error('Failed to save upload status', error);
  //   }
  // }

  startChunkUpload(
    fileName: string,
    fileSize: number,
    totalChunks: number,
    storageMethod: 'disk' | 'memory' = 'disk',
  ): ChunkUploadResponse {
    const fileId = uuidv4() as string;
    const chunkDir = this.getChunkDir(fileId);
    this.ensureDirectoryExists(chunkDir);

    this.activeUploads[fileId] = {
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: [],
      storageMethod,
      lastUpdated: new Date(),
    };
    this.saveUploadStatus();

    return {
      fileId,
      message: 'Chunk upload session started',
    };
  }

  uploadChunk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    chunk: Express.Multer.File,
    storageMethod: 'disk' | 'memory',
  ): ChunkUploadResponse {
    const upload = this.activeUploads[fileId];
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }

    const chunkDir = this.getChunkDir(fileId);
    this.ensureDirectoryExists(chunkDir);

    const chunkFilename = this.getChunkFilename(chunkIndex);
    const chunkPath = path.join(chunkDir, chunkFilename);

    try {
      if (storageMethod === 'disk') {
        fs.renameSync(chunk.path, chunkPath);
      } else {
        fs.writeFileSync(chunkPath, chunk.buffer);
      }

      // Update upload status
      upload.uploadedChunks.push(chunkIndex);
      upload.lastUpdated = new Date();
      this.saveUploadStatus();

      return {
        fileId,
        chunkIndex,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to save chunk ${chunkIndex}: ${error}`);
    }
  }

  completeChunkUpload(
    fileId: string,
    fileName: string,
    totalChunks: number,
    storageMethod: 'disk' | 'memory',
  ): ChunkUploadResponse {
    const upload = this.activeUploads[fileId];
    if (!upload) {
      throw new InternalServerErrorException('Upload session not found');
    }

    const chunkDir = this.getChunkDir(fileId);
    const finalPath = path.join(this.uploadDir, fileName);

    // Verify all chunks are present
    const chunks = fs.readdirSync(chunkDir);
    if (chunks.length !== totalChunks) {
      throw new InternalServerErrorException(`Incomplete upload. Found ${chunks.length} of ${totalChunks} chunks.`);
    }

    // Merge chunks
    const writeStream = fs.createWriteStream(finalPath);
    chunks
      .sort((a, b) => parseInt(a.split('.')[0]) - parseInt(b.split('.')[0]))
      .forEach((chunk) => {
        const chunkPath = path.join(chunkDir, chunk);
        writeStream.write(fs.readFileSync(chunkPath));
        fs.unlinkSync(chunkPath);
      });

    writeStream.end();
    fs.rmdirSync(chunkDir);

    // Clean up upload status
    delete this.activeUploads[fileId];
    this.saveUploadStatus();

    return {
      fileId,
      finalPath,
      message: 'File successfully merged',
    };
  }

  private getChunkDir(fileId: string): string {
    return path.join(this.tempDir, fileId);
  }

  private getChunkFilename(chunkIndex: number): string {
    return `${chunkIndex}.chunk`;
  }

  // getUploadStatus(fileId: string): UploadStatusResponse {
  //   const upload = this.activeUploads[fileId];
  //   if (!upload) {
  //     return { exists: false };
  //   }

  //   const chunkDir = this.getChunkDir(fileId);
  //   let existingChunks: number[] = [];

  //   try {
  //     if (fs.existsSync(chunkDir)) {
  //       existingChunks = fs
  //         .readdirSync(chunkDir)
  //         .map((f) => parseInt(f.split('.')[0]))
  //         .filter((n) => !isNaN(n));
  //     }
  //   } catch (error) {
  //     this.logger.error(`Error reading chunk directory: ${error}`);
  //   }

  //   return {
  //     exists: true,
  //     fileName: upload.fileName,
  //     fileSize: upload.fileSize,
  //     totalChunks: upload.totalChunks,
  //     uploadedChunks: Array.from(new Set([...upload.uploadedChunks, ...existingChunks])),
  //     storageMethod: upload.storageMethod,
  //     lastUpdated: upload.lastUpdated.toISOString(),
  //   };
  // }

  // Add this method to clean up abandoned uploads
  cleanupAbandonedUploads() {
    const now = new Date();
    const abandonedThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [fileId, upload] of Object.entries(this.activeUploads)) {
      const lastUpdated = new Date(upload.lastUpdated);
      if (now.getTime() - lastUpdated.getTime() > abandonedThreshold) {
        try {
          const chunkDir = this.getChunkDir(fileId);
          if (fs.existsSync(chunkDir)) {
            fs.rmSync(chunkDir, { recursive: true });
          }
          delete this.activeUploads[fileId];
        } catch (error) {
          this.logger.error(`Error cleaning up upload ${fileId}: ${error}`);
        }
      }
    }
    this.saveUploadStatus();
  }
}
