import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChunkUploadModule } from './file_upload/file_upload.module';
import { UploadModule } from './file_upload_v2/fileupload_v2.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    UploadModule,
    MulterModule.register({
      dest: './uploads/temp',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
