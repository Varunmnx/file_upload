import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from './file_upload_v3/file_upload_v3.module';
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
