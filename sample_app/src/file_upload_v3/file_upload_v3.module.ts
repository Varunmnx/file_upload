import { UploadPoolService } from './v3.service';
import { Module } from '@nestjs/common';
import { UploadController } from './file_upload_v3.controller';
@Module({
  controllers: [UploadController],
  providers: [UploadPoolService],
  exports: [UploadPoolService],
})
export class UploadModule {}
