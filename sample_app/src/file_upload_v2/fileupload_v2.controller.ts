// src/chunk-upload/fileupload_v2.controller.ts
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
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChunkUploadService } from './fileupload_v2.service';
import {
  StartChunkUploadDto,
  UploadChunkDto,
  CompleteChunkUploadDto,
  ChunkUploadResponse,
  UploadStatusResponse,
  ResumeChunkUploadDto,
} from './dto';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';

@Controller('chunk/v2')
export class ChunkUploadController {
  constructor(private readonly chunkUploadService: ChunkUploadService) {}

  @Get('status/:fileId')
  getUploadStatus(@Param('fileId') fileId: string): Promise<UploadStatusResponse> {
    return this.chunkUploadService.getUploadStatus(fileId);
  }

  @Get('status')
  getUploadStatusByQuery(@Query('fileId') fileId: string): Promise<UploadStatusResponse> {
    return this.chunkUploadService.getUploadStatus(fileId);
  }

  @Post('cleanup')
  cleanupAbandonedUploads(): { message: string } {
    this.chunkUploadService.cleanupAbandonedUploads();
    return { message: 'Cleanup completed' };
  }

  @Post('start')
  startChunkUpload(@Body() startChunkUploadDto: StartChunkUploadDto): Promise<ChunkUploadResponse> {
    return this.chunkUploadService.startChunkUpload(
      startChunkUploadDto.fileName,
      startChunkUploadDto.fileSize,
      startChunkUploadDto.totalChunks,
      startChunkUploadDto.storageMethod,
    );
  }

  @Post('resume')
  resumeChunkUpload(@Body() resumeChunkUploadDto: ResumeChunkUploadDto): Promise<ChunkUploadResponse> {
    return this.chunkUploadService.resumeChunkUpload(
      resumeChunkUploadDto.fileName,
      resumeChunkUploadDto.fileSize,
      resumeChunkUploadDto.totalChunks,
      resumeChunkUploadDto.fileId,
      resumeChunkUploadDto.storageMethod,
    );
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, cb) => {
          const uniqueSuffix = `${uuidv4()}-${Date.now()}`;
          cb(null, `${uniqueSuffix}-${file.originalname}`);
        },
      }),
      limits: {
        fileSize: 1024 * 1024 * 100, // 100MB
      },
    }),
  )
  uploadChunk(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 100 })],
      }),
    )
    chunk: Express.Multer.File,
    @Body() uploadChunkDto: UploadChunkDto,
  ): Promise<ChunkUploadResponse> {
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
        validators: [new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 100 })],
      }),
    )
    chunk: Express.Multer.File,
    @Body() uploadChunkDto: UploadChunkDto,
  ): Promise<ChunkUploadResponse> {
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
  completeChunkUpload(@Body() completeChunkUploadDto: CompleteChunkUploadDto): Promise<ChunkUploadResponse> {
    return this.chunkUploadService.completeChunkUpload(
      completeChunkUploadDto.fileId,
      completeChunkUploadDto.fileName,
      completeChunkUploadDto.totalChunks,
      completeChunkUploadDto?.storageMethod,
    );
  }
}
