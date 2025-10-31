/* eslint-disable @typescript-eslint/no-unsafe-call */
// ============= DTOs =============
// upload.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class InitiateUploadDto {
  @IsString()
  fileName: string;

  @IsNumber()
  fileSize: number;
}

export class UploadChunkDto {
  @IsString()
  uploadId: string;

  @IsNumber()
  chunkIndex: number;

  @IsNumber()
  chunkSize: number;
}

export class CompleteUploadDto {
  @IsString()
  uploadId: string;
}
