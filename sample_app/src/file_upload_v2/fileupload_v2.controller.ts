// src/chunk-upload/chunk-upload.controller.ts
import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChunkUploadService } from './fileupload_v2.service';
import {
  StartChunkUploadDto,
  UploadChunkDto,
  CompleteChunkUploadDto,
  ChunkUploadResponse,
  UploadStatusResponse,
} from './dto';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

@Controller('chunk/v2')
export class ChunkUploadController {
  constructor(private readonly chunkUploadService: ChunkUploadService) {}

  @Get('status/:fileId')
  getUploadStatus(@Param('fileId') fileId: string): UploadStatusResponse {
    return this.chunkUploadService.getUploadStatus(fileId);
  }

  @Post('cleanup')
  cleanupAbandonedUploads() {
    this.chunkUploadService.cleanupAbandonedUploads();
    return { message: 'Cleanup completed' };
  }

  @Post('start')
  startChunkUpload(@Body() startChunkUploadDto: StartChunkUploadDto): ChunkUploadResponse {
    return this.chunkUploadService.startChunkUpload(
      startChunkUploadDto.fileName,
      startChunkUploadDto.fileSize,
      startChunkUploadDto.totalChunks,
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${uuidv4() as string}-${Date.now()}`;
          cb(null, `${uniqueSuffix}-${file.originalname}`);
        },
      }),
      limits: {
        fileSize: 1024 * 1024 * 100, // 100MB (adjust based on your chunk size)
      },
    }),
  )
  uploadChunk(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 100 })], // 100MB
      }),
    )
    chunk: Express.Multer.File,
    @Body() uploadChunkDto: UploadChunkDto,
  ): ChunkUploadResponse {
    return this.chunkUploadService.uploadChunk(
      uploadChunkDto.fileId,
      uploadChunkDto.chunkIndex,
      uploadChunkDto.totalChunks,
      uploadChunkDto.fileName,
      chunk,
      uploadChunkDto.storageMethod,
    );
  }

  @Post('upload-memory')
  @UseInterceptors(FileInterceptor('chunk'))
  uploadChunkMemory(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 100 })], // 100MB
      }),
    )
    chunk: Express.Multer.File,
    @Body() uploadChunkDto: UploadChunkDto,
  ): ChunkUploadResponse {
    return this.chunkUploadService.uploadChunk(
      uploadChunkDto.fileId,
      uploadChunkDto.chunkIndex,
      uploadChunkDto.totalChunks,
      uploadChunkDto.fileName,
      chunk,
      'memory',
    );
  }

  @Post('complete')
  completeChunkUpload(@Body() completeChunkUploadDto: CompleteChunkUploadDto): ChunkUploadResponse {
    return this.chunkUploadService.completeChunkUpload(
      completeChunkUploadDto.fileId,
      completeChunkUploadDto.fileName,
      completeChunkUploadDto.totalChunks,
      completeChunkUploadDto.storageMethod,
    );
  }
}
