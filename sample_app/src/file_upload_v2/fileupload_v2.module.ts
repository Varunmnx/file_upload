// src/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { ChunkUploadController } from './fileupload_v2.controller';
import { ChunkUploadService } from './fileupload_v2.service';

@Module({
  controllers: [ChunkUploadController],
  providers: [ChunkUploadService],
})
export class UploadModule {}
