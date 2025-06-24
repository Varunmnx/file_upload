/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
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
import * as multer from 'multer';
import path, { extname } from 'path';
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

  // 5. CHUNKED UPLOAD - APPROACH 1: Using Temp Directory (RECOMMENDED)
  @Post('chunk/upload')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Since req.body isn't available yet, we'll use a temp directory
          // and move the file later in the handler
          const tempDir = './uploads/temp';
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          cb(null, tempDir);
        },
        filename: (req, file, cb) => {
          // Generate a temporary unique filename
          const tempName = `temp-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, tempName);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024 * 4, // 5MB per chunk
      },
    }),
  )
  async uploadChunk(@UploadedFile() chunk: Express.Multer.File, @Body() chunkDto: ChunkUploadDto) {
    if (!chunk) {
      throw new BadRequestException('No chunk uploaded');
    }
  console.log("Started")
    // Validate input
    if (!chunkDto.fileId || isNaN(chunkDto.chunkIndex) || isNaN(chunkDto.totalChunks)) {
      // Clean up temp file
      fs.unlinkSync(chunk.path);
      throw new BadRequestException('Invalid upload parameters');
    }

    const uploadDir = path.join('uploads', 'chunks', chunkDto.fileId);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      // Clean up temp file
      fs.unlinkSync(chunk.path);
      throw new BadRequestException('Upload session not found');
    }

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Move file from temp to correct location
    const finalChunkPath = path.join(uploadDir, `chunk-${chunkDto.chunkIndex}`);
    fs.renameSync(chunk.path, finalChunkPath);

    // Update chunk path for further processing
    chunk.path = finalChunkPath;

    // Read and validate metadata
    let metadata: UploadMetadata;
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (err) {
      console.log(err)

      // Clean up chunk file
      fs.unlinkSync(finalChunkPath);
      throw new BadRequestException('Invalid metadata file');
    }

    // Check if chunk already exists
    const existingChunk = metadata.uploadedChunks.find((c) => c.index === chunkDto.chunkIndex);
    if (existingChunk) {
      // Remove the duplicate chunk file
      fs.unlinkSync(finalChunkPath);
      return {
        message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} already uploaded`,
        fileId: chunkDto.fileId,
        progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
        remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
      };
    }

    // Update metadata
    metadata.uploadedChunks.push({
      index: chunkDto.chunkIndex,
      size: chunk.size,
      uploadedAt: new Date().toISOString(),
    });

    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      console.log(err)
      throw new BadRequestException('Failed to update metadata');
    }

    const isComplete = metadata.uploadedChunks.length === metadata.totalChunks;

    if (isComplete) {
      try {
        // Merge chunks
        const finalFilePath = await this.mergeChunks(chunkDto.fileId, metadata);
        metadata.status = 'completed';
        metadata.finalPath = finalFilePath;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return {
          message: 'File upload completed',
          fileId: chunkDto.fileId,
          finalPath: finalFilePath,
          totalSize: metadata.fileSize,
        };
      } catch (err) {
        console.log(err)
        throw new BadRequestException('Failed to merge chunks');
      }
    }

    return {
      message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} uploaded`,
      fileId: chunkDto.fileId,
      progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
      remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
    };
  }

  // 6. CHUNKED UPLOAD - APPROACH 2: Using Memory Storage
// 6. CHUNKED UPLOAD - APPROACH 2: Using Memory Storage
  @Post('chunk/upload-memory')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: multer.memoryStorage(), // Store in memory first
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per chunk
      },
    }),
  )
  async uploadChunkMemory(@UploadedFile() chunk: Express.Multer.File, @Body() chunkDto: ChunkUploadDto) {
    if (!chunk) {
      throw new BadRequestException('No chunk uploaded');
    }

    // Validate input
    if (!chunkDto.fileId || isNaN(chunkDto.chunkIndex) || isNaN(chunkDto.totalChunks)) {
      throw new BadRequestException('Invalid upload parameters');
    }

    const uploadDir = path.join('uploads', 'chunks', chunkDto.fileId);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      throw new BadRequestException('Upload session not found');
    }

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Write chunk to disk from memory buffer
    const chunkPath = path.join(uploadDir, `chunk-${chunkDto.chunkIndex}`);
    
    try {
      // Check if chunk.buffer exists
      if (!chunk.buffer) {
        throw new BadRequestException('Chunk buffer is empty');
      }
      fs.writeFileSync(chunkPath, chunk.buffer);
    } catch (err) {
      console.error('Error writing chunk to disk:', err);
      throw new BadRequestException('Failed to write chunk to disk');
    }

    // Read and validate metadata
    let metadata: UploadMetadata;
    try {
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');
      metadata = JSON.parse(metadataContent);
      
      // Validate metadata structure
      if (!metadata.uploadedChunks || !Array.isArray(metadata.uploadedChunks)) {
        throw new Error('Invalid metadata structure: uploadedChunks is not an array');
      }
    } catch (err) {
      console.error('Error reading/parsing metadata:', err);
      // Clean up chunk file
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
      throw new BadRequestException('Invalid metadata file');
    }

    // Check if chunk already exists
    const existingChunk = metadata.uploadedChunks.find((c) => c.index === chunkDto.chunkIndex);
    if (existingChunk) {
      fs.unlinkSync(chunkPath);
      return {
        message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} already uploaded`,
        fileId: chunkDto.fileId,
        progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
        remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
      };
    }

    // Update metadata
    metadata.uploadedChunks.push({
      index: chunkDto.chunkIndex,
      size: chunk.size,
      uploadedAt: new Date().toISOString(),
    });

    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      console.error('Error updating metadata:', err);
      // Clean up chunk file
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
      throw new BadRequestException('Failed to update metadata');
    }

    const isComplete = metadata.uploadedChunks.length === metadata.totalChunks;

    if (isComplete) {
      try {
        console.log('All chunks uploaded, starting merge process...');
        console.log('Metadata:', JSON.stringify(metadata, null, 2));
        
        const finalFilePath = await this.mergeChunks(chunkDto.fileId, metadata);
        metadata.status = 'completed';
        metadata.finalPath = finalFilePath;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return {
          message: 'File upload completed',
          fileId: chunkDto.fileId,
          finalPath: finalFilePath,
          totalSize: metadata.fileSize,
        };
      } catch (err) {
        console.error('Error merging chunks:', err);
        throw new BadRequestException(`Failed to merge chunks: ${err.message}`);
      }
    }

    return {
      message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} uploaded`,
      fileId: chunkDto.fileId,
      progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
      remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
    };
  }

  // 7. CHUNKED UPLOAD - APPROACH 3: Custom File Handler with Pre-parsing
  @Post('chunk/upload-custom')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Extract fileId from filename pattern or use fallback
          const fileId = req.headers['x-file-id'] as string || 'unknown';
          
          if (fileId === 'unknown') {
            return cb(new Error('fileId must be provided in x-file-id header'), '');
          }

          const dest = path.join('uploads', 'chunks', fileId);
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
          }
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const chunkIndex = req.headers['x-chunk-index'] as string || '0';
          cb(null, `chunk-${chunkIndex}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB per chunk
      },
    }),
  )
  async uploadChunkCustom(@UploadedFile() chunk: Express.Multer.File, @Body() chunkDto: ChunkUploadDto) {
    if (!chunk) {
      throw new BadRequestException('No chunk uploaded');
    }

    // The file is already in the correct location due to custom destination logic
    const uploadDir = path.dirname(chunk.path);
    const metadataPath = path.join(uploadDir, 'metadata.json');

    if (!fs.existsSync(metadataPath)) {
      fs.unlinkSync(chunk.path);
      throw new BadRequestException('Upload session not found');
    }

    // Read and validate metadata
    let metadata: UploadMetadata;
    try {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (err:unknown) {
      console.log(err)
      fs.unlinkSync(chunk.path);
      throw new BadRequestException('Invalid metadata file');
    }

    // Check if chunk already exists
    const existingChunk = metadata.uploadedChunks.find((c) => c.index === chunkDto.chunkIndex);
    if (existingChunk) {
      return {
        message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} already uploaded`,
        fileId: chunkDto.fileId,
        progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
        remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
      };
    }

    // Update metadata
    metadata.uploadedChunks.push({
      index: chunkDto.chunkIndex,
      size: chunk.size,
      uploadedAt: new Date().toISOString(),
    });

    try {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (err) {
      console.log(err)
      throw new BadRequestException('Failed to update metadata');
    }

    const isComplete = metadata.uploadedChunks.length === metadata.totalChunks;

    if (isComplete) {
      try {
        const finalFilePath = await this.mergeChunks(chunkDto.fileId, metadata);
        metadata.status = 'completed';
        metadata.finalPath = finalFilePath;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

        return {
          message: 'File upload completed',
          fileId: chunkDto.fileId,
          finalPath: finalFilePath,
          totalSize: metadata.fileSize,
        };
      } catch (err) {
        console.log(err)
        throw new BadRequestException('Failed to merge chunks');
      }
    }

    return {
      message: `Chunk ${chunkDto.chunkIndex + 1}/${metadata.totalChunks} uploaded`,
      fileId: chunkDto.fileId,
      progress: (metadata.uploadedChunks.length / metadata.totalChunks) * 100,
      remainingChunks: metadata.totalChunks - metadata.uploadedChunks.length,
    };
  }

  // 8. CHUNKED UPLOAD - Get Status
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
      missingChunks: this.getMissingChunks(metadata),
    };
  }

  // 9. CHUNKED UPLOAD - Resume/Retry missing chunks
  @Post('chunk/resume')
  resumeChunkedUpload(@Body() { fileId }: { fileId: string }) {
    const metadataPath = `./uploads/chunks/${fileId}/metadata.json`;

    if (!fs.existsSync(metadataPath)) {
      throw new BadRequestException('Upload session not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const metadata: UploadMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const missingChunks = this.getMissingChunks(metadata);

    return {
      message: 'Resume information retrieved',
      fileId,
      fileName: metadata.fileName,
      totalChunks: metadata.totalChunks,
      uploadedChunks: metadata.uploadedChunks.length,
      missingChunks,
      nextChunkToUpload: missingChunks.length > 0 ? missingChunks[0] : null,
    };
  }

  // 10. CHUNKED UPLOAD - Cancel/Cleanup
  @Post('chunk/cancel')
  cancelChunkedUpload(@Body() { fileId }: { fileId: string }) {
    const uploadDir = `./uploads/chunks/${fileId}`;

    if (!fs.existsSync(uploadDir)) {
      throw new BadRequestException('Upload session not found');
    }

    try {
      // Remove all chunk files and metadata
      fs.rmSync(uploadDir, { recursive: true, force: true });
      
      return {
        message: 'Upload session cancelled and cleaned up',
        fileId,
      };
    } catch (err) {
      console.log(err)
      throw new BadRequestException('Failed to cleanup upload session');
    }
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

private async mergeChunks(fileId: string, metadata: UploadMetadata): Promise<string> {
  const chunkDir = path.join('uploads', 'chunks', fileId);
  const finalDir = path.join('uploads', 'completed');
  
  // Ensure final directory exists
  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  const finalFilePath = path.join(finalDir, metadata.fileName);

  try {
    // Sort chunks by index to ensure correct order
    const sortedChunks = metadata.uploadedChunks
      .sort((a, b) => a.index - b.index);

    // Validate we have all chunks
    if (sortedChunks.length !== metadata.totalChunks) {
      throw new Error(`Missing chunks: expected ${metadata.totalChunks}, got ${sortedChunks.length}`);
    }

    // Create write stream for final file
    const writeStream = fs.createWriteStream(finalFilePath);

    // Read and write chunks in order
    for (let i = 0; i < sortedChunks.length; i++) {
      const chunkPath = path.join(chunkDir, `chunk-${sortedChunks[i].index}`);
      
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Chunk file not found: ${chunkPath}`);
      }

      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();

    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish',()=>resolve);
      writeStream.on('error', reject);
    });

    // Clean up chunk files
    for (const chunk of sortedChunks) {
      const chunkPath = path.join(chunkDir, `chunk-${chunk.index}`);
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
      }
    }

    // Remove chunk directory and metadata
    const metadataPath = path.join(chunkDir, 'metadata.json');
    if (fs.existsSync(metadataPath)) {
      fs.unlinkSync(metadataPath);
    }
    
    if (fs.existsSync(chunkDir)) {
      fs.rmdirSync(chunkDir);
    }

    return finalFilePath;

  } catch (error) {
    // Clean up partial file if it exists
    if (fs.existsSync(finalFilePath)) {
      fs.unlinkSync(finalFilePath);
    }
    throw error;
  }
}

  private getMissingChunks(metadata: UploadMetadata): number[] {
    const uploadedIndices = new Set(metadata.uploadedChunks.map(chunk => chunk.index));
    const missingChunks: number[] = [];
    
    for (let i = 0; i < metadata.totalChunks; i++) {
      if (!uploadedIndices.has(i)) {
        missingChunks.push(i);
      }
    }
    
    return missingChunks;
  }

  // 11. BONUS: Stream Upload for very large files
  @Post('stream')
  async uploadStream(@Body() streamDto: { fileName: string; contentType: string }) {
    const fileId = crypto.randomUUID();
    const uploadDir = './uploads/stream';
    await new Promise((resolve) => resolve("Success"));

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, `${fileId}-${streamDto.fileName}`);
    
    return {
      message: 'Stream upload endpoint ready',
      fileId,
      uploadUrl: `/upload/stream/${fileId}`,
      instructions: 'Send raw file data to the upload URL using PUT method'
    };
  }

  // 12. Health check endpoint
  @Post('health')
  healthCheck() {
    const uploadDirs = [
      './uploads/single',
      './uploads/multiple', 
      './uploads/chunks',
      './uploads/completed',
      './uploads/temp'
    ];

    const dirStatus = uploadDirs.map(dir => ({
      directory: dir,
      exists: fs.existsSync(dir),
      writable: fs.existsSync(dir) ? fs.accessSync(dir, fs.constants.W_OK) === undefined : false
    }));

    return {
      message: 'File upload service is healthy',
      timestamp: new Date().toISOString(),
      directories: dirStatus,
      memoryUsage: process.memoryUsage(),
    };
  }
}