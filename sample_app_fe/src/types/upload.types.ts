// upload.types.ts

export interface UploadStatus {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  progress: number;
  isComplete: boolean;
}

export interface InitiateUploadRequest {
  fileName: string;
  fileSize: number;
}

export interface InitiateUploadResponse {
  uploadId: string;
  totalChunks: number;
}

export interface UploadChunkRequest {
  uploadId: string;
  chunkIndex: number;
  chunkSize: number;
}

export interface UploadChunkResponse {
  success: boolean;
  message: string;
}

export interface CompleteUploadRequest {
  uploadId: string;
}

export interface CompleteUploadResponse {
  success: boolean;
  message: string;
  filePath: string;
}

export interface ChunkData {
  blob: Blob;
  index: number;
  size: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  uploadedChunks: number[];
}