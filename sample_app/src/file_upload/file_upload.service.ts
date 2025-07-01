// src/file-upload/file-upload.service.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileUploadService {
  private readonly uploadDirectory = path.join(__dirname, '..', '..', 'uploads');
  private readonly uploadBaseDir = path.join(process.cwd(), 'uploads');
  constructor() {
    if (!fs.existsSync(this.uploadDirectory)) {
      fs.mkdirSync(this.uploadDirectory, { recursive: true });
    }
  }

  async handleChunkUpload(
    file: Express.Multer.File,
    chunkNumber: number,
    totalChunks: number,
    originalname: string,
    identifier: string,
  ) {
    const chunkFilename = `${identifier}-${chunkNumber}`;
    const chunkPath = path.join(this.uploadDirectory, chunkFilename);

    await fs.promises.writeFile(chunkPath, file.buffer);

    // Check if all chunks are uploaded
    const allChunksUploaded = await this.checkAllChunksUploaded(identifier, totalChunks);

    if (allChunksUploaded) {
      return await this.mergeChunks(identifier, totalChunks, originalname);
    }

    return { message: 'Chunk uploaded successfully', chunkNumber };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async checkAllChunksUploaded(identifier: string, totalChunks: number): Promise<boolean> {
    for (let i = 1; i <= totalChunks; i++) {
      const chunkPath = path.join(this.uploadDirectory, `${identifier}-${i}`);
      if (!fs.existsSync(chunkPath)) {
        return false;
      }
    }
    return true;
  }

  // eslint-disable-next-line prettier/prettier
  private async mergeChunks(
    identifier: string,
    totalChunks: number,
    originalname: string,
  ) {
    const mergedFilename = `${identifier}-${originalname}`;
    const mergedPath = path.join(this.uploadDirectory, mergedFilename);

    const writeStream = fs.createWriteStream(mergedPath);

    for (let i = 1; i <= totalChunks; i++) {
      const chunkPath = path.join(this.uploadDirectory, `${identifier}-${i}`);
      const chunkBuffer = await fs.promises.readFile(chunkPath);
      writeStream.write(chunkBuffer);
      await fs.promises.unlink(chunkPath); // Delete the chunk after merging
    }

    writeStream.end();

    return new Promise((resolve, reject) => {
      writeStream.on('finish', () => {
        resolve({
          message: 'File uploaded successfully',
          filename: mergedFilename,
        });
      });
      writeStream.on('error', reject);
    });
  }

  initializeUpload(filename: string, totalChunks: number): string {
    const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const uploadInfo = {
      filename,
      totalChunks,
      uploadedChunks: 0,
      uploadId,
      createdAt: new Date(),
    };

    // Store upload metadata (you might want to use a database for this)
    // eslint-disable-next-line @typescript-eslint/await-thenable
    fs.writeFile(path.join(this.uploadBaseDir, `${uploadId}.json`), JSON.stringify(uploadInfo), (err) => {
      if (err) throw err;
      // handle success
      console.log('upload error', err);
    });

    return uploadId;
  }

  uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer) {
    const chunkPath = path.join(this.uploadBaseDir, `${uploadId}.chunk.${chunkIndex}`);

    try {
      fs.writeFile(chunkPath, chunkBuffer, (err) => {
        if (err) throw err;
        // handle success
        console.log(err);
      });

      // Update upload metadata
      const metadataPath = path.join(this.uploadBaseDir, `${uploadId}.json`);
      fs.readFile(metadataPath, 'utf-8', (err, data) => {
        if (err) throw err;
        const metadata = JSON.parse(data) as {
          uploadedChunks: number;
          totalChunks: number;
          filename: string;
        };
        metadata.uploadedChunks += 1;
        fs.writeFile(metadataPath, JSON.stringify(metadata), (err) => {
          if (err) throw err;
          console.log(err);
        });
        const isComplete = metadata.uploadedChunks === metadata.totalChunks;
        if (isComplete) {
          this.assembleFile(uploadId, metadata);
        }

        return { success: true, isComplete };
      });
    } catch (error) {
      throw new Error(`Failed to upload chunk: ${error}`);
    }
  }

  private assembleFile(
    uploadId: string,
    metadata: {
      filename: string;
      totalChunks: number;
    },
  ) {
    const finalPath = path?.join(this.uploadBaseDir, metadata.filename);
    const writeStream = fs.createWriteStream(finalPath);

    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const chunkPath = path.join(this.uploadBaseDir, `${uploadId}.chunk.${i}`);
        fs.readFile(chunkPath, 'utf-8', (err, data) => {
          if (err) throw err;
          writeStream.write(data);
          return data;
        });

        // Clean up chunk file
        fs.unlink(chunkPath, (err) => {
          if (err) throw err;
          console.log(err);
        });
      }

      writeStream.end();

      // Clean up metadata file
      fs.unlink(path.join(this.uploadBaseDir, `${uploadId}.json`), (err) => {
        if (err) throw err;
        console.log(err);
      });
    } catch (error) {
      writeStream.destroy();
      throw new Error(`Failed to assemble file: ${error}`);
    }
  }
}
