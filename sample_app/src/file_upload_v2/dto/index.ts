// src/chunk-upload/dto.ts

export interface StartChunkUploadDto {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  storageMethod?: 'disk' | 'memory';
}

export interface ResumeChunkUploadDto {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  fileId: string;
  storageMethod?: 'disk' | 'memory';
}

export interface UploadChunkDto {
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  storageMethod?: 'disk' | 'memory';
}

export interface CompleteChunkUploadDto {
  fileId: string;
  fileName: string;
  totalChunks: number;
  storageMethod?: 'disk' | 'memory';
}

export interface ChunkUploadResponse {
  fileId: string;
  message: string;
  chunkIndex?: number;
  finalPath?: string;
  resumed?: boolean;
  skipped?: boolean;
  uploadedChunks?: number[];
}

export interface UploadStatusResponse {
  exists?: boolean;
  fileName?: string;
  fileSize?: number;
  totalChunks?: number;
  uploadedChunks?: number[];
  storageMethod?: 'disk' | 'memory';
  lastUpdated?: string;
}