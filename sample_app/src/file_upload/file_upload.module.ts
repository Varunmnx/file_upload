// src/chunk-upload/chunk-upload.module.ts
import { Module } from '@nestjs/common';
import { FileUploadController } from './file_upload.controller';
import { FileUploadService } from './file_upload.service';

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService],
})
export class ChunkUploadModule {}
