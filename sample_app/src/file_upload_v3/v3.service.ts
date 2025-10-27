// upload-pool.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  chunkSize: number;
  createdAt: Date;
  lastActivity: Date;
  fileHash?: string;
}

@Injectable()
export class UploadPoolService {
  private uploadSessions: Map<string, UploadSession> = new Map();
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly chunksDir = join(process.cwd(), 'uploads', 'chunks');
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Create directories if they don't exist
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!existsSync(this.chunksDir)) {
      mkdirSync(this.chunksDir, { recursive: true });
    }

    // Start cleanup interval
    this.startCleanupInterval();
  }

  initiateUpload(fileName: string, fileSize: number, totalChunks: number, fileHash?: string): string {
    const uploadId = uuidv4();
    const session: UploadSession = {
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: new Set(),
      chunkSize: Math.ceil(fileSize / totalChunks),
      createdAt: new Date(),
      lastActivity: new Date(),
      fileHash,
    };

    this.uploadSessions.set(uploadId, session);

    // Create upload directory for chunks
    const uploadChunkDir = join(this.chunksDir, uploadId);
    if (!existsSync(uploadChunkDir)) {
      mkdirSync(uploadChunkDir, { recursive: true });
    }

    return uploadId;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new BadRequestException('Invalid chunk index');
    }

    // Save chunk to disk
    const chunkPath = join(this.chunksDir, uploadId, `chunk-${chunkIndex}`);
    writeFileSync(chunkPath, chunkBuffer);

    // Update session
    session.uploadedChunks.add(chunkIndex);
    session.lastActivity = new Date();
  }

  getUploadStatus(uploadId: string) {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    return {
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks: Array.from(session.uploadedChunks).sort((a, b) => a - b),
      progress: (session.uploadedChunks.size / session.totalChunks) * 100,
      isComplete: session.uploadedChunks.size === session.totalChunks,
    };
  }

  async completeUpload(uploadId: string): Promise<string> {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.uploadedChunks.size !== session.totalChunks) {
      throw new BadRequestException('Not all chunks uploaded');
    }

    // Merge chunks
    const finalFilePath = join(this.uploadDir, session.fileName);
    const writeStream = createWriteStream(finalFilePath);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = join(this.chunksDir, uploadId, `chunk-${i}`);
      const chunkBuffer = readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }

    writeStream.end();

    // Wait for write to complete
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve as () => void);
      writeStream.on('error', reject);
    });

    // Cleanup chunks
    this.cleanupChunks(uploadId);
    this.uploadSessions.delete(uploadId);

    return finalFilePath;
  }

  cancelUpload(uploadId: string): void {
    const session = this.uploadSessions.get(uploadId);
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    this.cleanupChunks(uploadId);
    this.uploadSessions.delete(uploadId);
  }

  private cleanupChunks(uploadId: string): void {
    const uploadChunkDir = join(this.chunksDir, uploadId);
    if (existsSync(uploadChunkDir)) {
      const chunks = readdirSync(uploadChunkDir);
      chunks.forEach((chunk) => {
        unlinkSync(join(uploadChunkDir, chunk));
      });
      unlinkSync(uploadChunkDir);
    }
  }

  private startCleanupInterval(): void {
    setInterval(
      () => {
        const now = new Date().getTime();
        for (const [uploadId, session] of this.uploadSessions.entries()) {
          const timeSinceLastActivity = now - session.lastActivity.getTime();
          if (timeSinceLastActivity > this.sessionTimeout) {
            console.log(`Cleaning up expired session: ${uploadId}`);
            this.cleanupChunks(uploadId);
            this.uploadSessions.delete(uploadId);
          }
        }
      },
      60 * 60 * 1000,
    ); // Run every hour
  }
}
