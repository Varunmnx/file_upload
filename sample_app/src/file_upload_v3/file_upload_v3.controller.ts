// eslint-disable-next-line prettier/prettier
import { 
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadPoolService } from './v3.service';
import { InitiateUploadDto, UploadChunkDto, CompleteUploadDto } from './upload.dto';
import { Controller } from '@nestjs/common';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadPoolService: UploadPoolService) {}

  @Post('initiate')
  initiateUpload(@Body() dto: InitiateUploadDto) {
    const uploadId = this.uploadPoolService.initiateUpload(dto.fileName, dto.fileSize, dto.totalChunks, dto.fileHash);
    return { uploadId };
  }

  @Post('chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  async uploadChunk(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadChunkDto) {
    if (!file) {
      throw new BadRequestException('No chunk file provided');
    }

    await this.uploadPoolService.uploadChunk(dto.uploadId, Number(dto.chunkIndex), file.buffer);

    return {
      success: true,
      message: `Chunk ${dto.chunkIndex} uploaded successfully`,
    };
  }

  @Get('status/:uploadId')
  getUploadStatus(@Param('uploadId') uploadId: string) {
    return this.uploadPoolService.getUploadStatus(uploadId);
  }

  @Post('complete')
  async completeUpload(@Body() dto: CompleteUploadDto) {
    const filePath = await this.uploadPoolService.completeUpload(dto.uploadId);
    return {
      success: true,
      message: 'Upload completed successfully',
      filePath,
    };
  }

  @Delete(':uploadId')
  cancelUpload(@Param('uploadId') uploadId: string) {
    this.uploadPoolService.cancelUpload(uploadId);
    return {
      success: true,
      message: 'Upload cancelled',
    };
  }
}
