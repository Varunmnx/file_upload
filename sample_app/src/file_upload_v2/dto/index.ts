// src/chunk-upload/dto/chunk-upload.dto.ts
export class StartChunkUploadDto {
  fileName: string;
  fileSize: number;
  totalChunks: number;
}

export class UploadChunkDto {
  chunk: Express.Multer.File;
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileId: string;
  storageMethod: 'disk' | 'memory';
}

export class CompleteChunkUploadDto {
  fileId: string;
  fileName: string;
  totalChunks: number;
  storageMethod: 'disk' | 'memory';
}

export interface ChunkUploadResponse {
  fileId: string;
  message?: string;
  finalPath?: string;
  chunkIndex?: number;
}

// src/chunk-upload/dto/chunk-upload.dto.ts
export interface UploadStatusResponse {
  exists: boolean;
  fileName?: string;
  fileSize?: number;
  totalChunks?: number;
  uploadedChunks?: number[];
  storageMethod?: 'disk' | 'memory';
  lastUpdated?: string;
}