import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileUploadModule } from './file_upload/file_upload.module';

@Module({
  imports: [FileUploadModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
