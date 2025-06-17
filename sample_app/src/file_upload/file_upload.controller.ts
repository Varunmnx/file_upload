import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// DTOs for type safety
export class FileUploadDto {
  description?: string;
  category?: string;
}

export class ChunkUploadDto {
  chunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileId: string;
}

// Interfaces for better type safety
interface ProcessedFile {
  index?: number;
  originalName: string;
  filename: string;
  size: number;
  mimetype: string;
  path: string;
  processedAt?: string;
  fieldName?: string;
}

interface UploadMetadata {
  fileId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: ChunkInfo[];
  createdAt: string;
  status: 'started' | 'completed';
  finalPath?: string;
}

interface ChunkInfo {
  index: number;
  size: number;
  uploadedAt: string;
}

interface MixedFieldsResult {
  message: string;
  uploadedFiles: {
    avatar?: ProcessedFile[];
    documents?: ProcessedFile[];
    images?: ProcessedFile[];
  };
}

interface ProcessFilesResult {
  fieldName: string;
  files: ProcessedFile[];
}

@Controller('upload')
export class FileUploadController {
  // 1. TRADITIONAL SINGLE FILE MULTIPART UPLOAD
  @Post('single')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/single',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // File type validation
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx)$/)) {
          return cb(new Error('Only image and document files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  // eslint-disable-next-line @typescript-eslint/require-await
  async uploadSingleFile(@UploadedFile() file: Express.Multer.File, @Body() uploadDto: FileUploadDto) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return {
      message: 'File uploaded successfully',
      file: {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        description: uploadDto.description,
        category: uploadDto.category,
      },
    };
  }

  // 2. PARALLEL MULTIPLE FILES MULTIPART UPLOAD
  @Post('multiple-parallel')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads/multiple',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx)$/)) {
          return cb(new Error('Only image and document files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 10, // Maximum 10 files
      },
    }),
  )
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[], @Body() uploadDto: FileUploadDto) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Process files in parallel
    const fileProcessingPromises = files.map(async (file, index): Promise<ProcessedFile> => {
      // Simulate some processing (resize, virus scan, etc.)
      await this.processFileAsync(file);

      return {
        index,
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        processedAt: new Date().toISOString(),
      };
    });

    // Wait for all files to be processed in parallel
    const processedFiles = await Promise.all(fileProcessingPromises);

    return {
      message: `${files.length} files uploaded and processed successfully`,
      files: processedFiles,
      totalSize: files.reduce((total, file) => total + file.size, 0),
      description: uploadDto.description,
      category: uploadDto.category,
    };
  }

  // 3. MIXED FIELD MULTIPART UPLOAD (Different field names)
  @Post('mixed-fields')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'documents', maxCount: 5 },
        { name: 'images', maxCount: 10 },
      ],
      {
        storage: diskStorage({
          destination: (req, file, cb) => {
            // Different destinations based on field name
            const dest = `./uploads/${file.fieldname}`;
            if (!fs.existsSync(dest)) {
              fs.mkdirSync(dest, { recursive: true });
            }
            cb(null, dest);
          },
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
          },
        }),
        limits: {
          fileSize: 10 * 1024 * 1024,
        },
      },
    ),
  )
  async uploadMixedFields(
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      documents?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body() uploadDto: FileUploadDto,
  ): Promise<MixedFieldsResult> {
    const result: MixedFieldsResult = {
      message: 'Mixed field upload completed',
      uploadedFiles: {},
    };

    // Process each field type in parallel
    const processingPromises: Promise<ProcessFilesResult>[] = [];

    if (files.avatar) {
      processingPromises.push(this.processFilesParallel(files.avatar, 'avatar'));
    }

    if (files.documents) {
      processingPromises.push(this.processFilesParallel(files.documents, 'documents'));
    }

    if (files.images) {
      processingPromises.push(this.processFilesParallel(files.images, 'images'));
    }

    const processedResults = await Promise.all(processingPromises);

    // Combine results
    processedResults.forEach(({ fieldName, files: processedFiles }) => {
      result.uploadedFiles[fieldName as keyof typeof result.uploadedFiles] = processedFiles;
    });

    return result;
  }

  // 4. CHUNKED UPLOAD - Start
  @Post('chunk/start')
  startChunkedUpload(@Body() startDto: { fileName: string; fileSize: number; totalChunks: number }) {
    const fileId = crypto.randomUUID();
    const uploadDir = `./uploads/chunks/${fileId}`;

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Store upload metadata (in production, use database)
    const metadata: UploadMetadata = {
      fileId,
      fileName: startDto.fileName,
      fileSize: startDto.fileSize,
      totalChunks: startDto.totalChunks,
      uploadedChunks: [],
      createdAt: new Date().toISOString(),
      status: 'started',
    };

    fs.writeFileSync(`${uploadDir}/metadata.json`, JSON.stringify(metadata));

    return {
      message: 'Chunked upload started',
      fileId,
      uploadDir,
    };
  }

  // 5. CHUNKED UPLOAD - Upload Chunk
  @Post('chunk/upload')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const fileId = (req.body as ChunkUploadDto).fileId;
          const dest = `./uploads/chunks/${fileId}`;
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const chunkIndex = (req.body as ChunkUploadDto).chunkIndex;
          cb(null, `chunk-${chunkIndex}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per chunk
      },
    }),
  )
  uploadChunk(@UploadedFile() chunk: Express.Multer.File, @Body() chunkDto: ChunkUploadDto) {
    if (!chunk) {
      throw new BadRequestException('No chunk uploaded');
    }

    const uploadDir = `./uploads/chunks/${chunkDto.fileId}`;
    const metadataPath = `${uploadDir}/metadata.json`;

    if (!fs.existsSync(metadataPath)) {
      throw new BadRequestException('Upload session not found');
    }

    // Update metadata
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadata: UploadMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    metadata.uploadedChunks.push({
      index: chunkDto.chunkIndex,
      size: chunk.size,
      uploadedAt: new Date().toISOString(),
    });

    fs.writeFileSync(metadataPath, JSON.stringify(metadata));

    const isComplete = metadata.uploadedChunks.length === metadata.totalChunks;

    if (isComplete) {
      // Merge chunks
      const finalFilePath = this.mergeChunks(chunkDto.fileId, metadata);
      metadata.status = 'completed';
      metadata.finalPath = finalFilePath;
      fs.writeFileSync(metadataPath, JSON.stringify(metadata));

      return {
        message: 'File upload completed',
        fileId: chunkDto.fileId,
        finalPath: finalFilePath,
        totalSize: metadata.fileSize,
      };
    }

    return {
      message: `Chunk ${chunkDto.chunkIndex + 1}/${chunkDto.totalChunks} uploaded`,
      fileId: chunkDto.fileId,
      progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
      remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
    };
  }

  // 6. CHUNKED UPLOAD - Get Status
  @Post('chunk/status')
  getChunkUploadStatus(@Body() { fileId }: { fileId: string }) {
    const metadataPath = `./uploads/chunks/${fileId}/metadata.json`;

    if (!fs.existsSync(metadataPath)) {
      throw new BadRequestException('Upload session not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadata: UploadMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const progress = (metadata.uploadedChunks.length / metadata.totalChunks) * 100;

    return {
      fileId,
      status: metadata.status,
      progress,
      uploadedChunks: metadata.uploadedChunks.length,
      totalChunks: metadata.totalChunks,
      fileName: metadata.fileName,
      remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
    };
  }

  // HELPER METHODS

  private async processFileAsync(file: Express.Multer.File): Promise<void> {
    // Simulate async processing (image resizing, virus scanning, etc.)
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`Processing file: ${file.originalname}`);
        resolve();
      }, Math.random() * 1000); // Random delay 0-1 second
    });
  }

  private async processFilesParallel(files: Express.Multer.File[], fieldName: string): Promise<ProcessFilesResult> {
    const processedFiles = await Promise.all(
      files.map(async (file): Promise<ProcessedFile> => {
        await this.processFileAsync(file);
        return {
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          path: file.path,
          mimetype: file.mimetype,
          fieldName,
        };
      }),
    );

    return { fieldName, files: processedFiles };
  }

  private mergeChunks(fileId: string, metadata: UploadMetadata): string {
    const uploadDir = `./uploads/chunks/${fileId}`;
    const finalDir = './uploads/completed';

    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const finalFilePath = `${finalDir}/${metadata.fileName}`;
    const writeStream = fs.createWriteStream(finalFilePath);

    // Sort chunks by index and merge
    const sortedChunks = metadata.uploadedChunks.sort((a, b) => a.index - b.index);

    for (const chunkInfo of sortedChunks) {
      const chunkPath = `${uploadDir}/chunk-${chunkInfo.index}`;
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();

    // Clean up chunk files
    setTimeout(() => {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }, 5000); // Delete after 5 seconds

    return finalFilePath;
  }
}
