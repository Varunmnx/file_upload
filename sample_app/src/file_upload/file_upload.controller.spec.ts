/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileUploadController, FileUploadDto, ChunkUploadDto } from './file_upload.controller';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock crypto module
jest.mock('crypto');
const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('FileUploadController', () => {
  let controller: FileUploadController;

  // Mock file objects
  const mockSingleFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    destination: './uploads/single',
    filename: 'file-123456789.jpg',
    path: './uploads/single/file-123456789.jpg',
    buffer: Buffer.from('test'),
    stream: {} as any,
  };

  const mockMultipleFiles: Express.Multer.File[] = [
    {
      ...mockSingleFile,
      originalname: 'test1.jpg',
      filename: 'files-123456789.jpg',
      path: './uploads/multiple/files-123456789.jpg',
    },
    {
      ...mockSingleFile,
      originalname: 'test2.png',
      filename: 'files-987654321.png',
      path: './uploads/multiple/files-987654321.png',
      mimetype: 'image/png',
    },
  ];

  const mockMixedFiles = {
    avatar: [
      {
        ...mockSingleFile,
        fieldname: 'avatar',
        originalname: 'avatar.jpg',
        filename: 'avatar-123456789.jpg',
        path: './uploads/avatar/avatar-123456789.jpg',
      },
    ],
    documents: [
      {
        ...mockSingleFile,
        fieldname: 'documents',
        originalname: 'doc.pdf',
        filename: 'documents-123456789.pdf',
        path: './uploads/documents/documents-123456789.pdf',
        mimetype: 'application/pdf',
      },
    ],
    images: [
      {
        ...mockSingleFile,
        fieldname: 'images',
        originalname: 'image1.png',
        filename: 'images-123456789.png',
        path: './uploads/images/images-123456789.png',
        mimetype: 'image/png',
      },
      {
        ...mockSingleFile,
        fieldname: 'images',
        originalname: 'image2.gif',
        filename: 'images-987654321.gif',
        path: './uploads/images/images-987654321.gif',
        mimetype: 'image/gif',
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileUploadController],
    }).compile();

    controller = module.get<FileUploadController>(FileUploadController);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Basic Controller Tests', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('uploadSingleFile', () => {
    it('should upload a single file successfully', async () => {
      const uploadDto: FileUploadDto = {
        description: 'Test file',
        category: 'images',
      };

      const result = await controller.uploadSingleFile(mockSingleFile, uploadDto);

      expect(result).toEqual({
        message: 'File uploaded successfully',
        file: {
          originalName: mockSingleFile.originalname,
          filename: mockSingleFile.filename,
          size: mockSingleFile.size,
          mimetype: mockSingleFile.mimetype,
          path: mockSingleFile.path,
          description: uploadDto.description,
          category: uploadDto.category,
        },
      });
    });

    it('should throw BadRequestException when no file is uploaded', async () => {
      const uploadDto: FileUploadDto = {};

      await expect(controller.uploadSingleFile(undefined as any, uploadDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadMultipleFiles', () => {
    it('should upload multiple files successfully', async () => {
      const uploadDto: FileUploadDto = {
        description: 'Multiple test files',
        category: 'documents',
      };

      // Mock the processFileAsync method
      jest.spyOn(controller as any, 'processFileAsync').mockResolvedValue(undefined);

      const result = await controller.uploadMultipleFiles(mockMultipleFiles, uploadDto);

      expect(result.message).toBe('2 files uploaded and processed successfully');
      expect(result.files).toHaveLength(2);
      expect(result.totalSize).toBe(mockMultipleFiles[0].size + mockMultipleFiles[1].size);
      expect(result.description).toBe(uploadDto.description);
      expect(result.category).toBe(uploadDto.category);

      // Verify each processed file
      result.files.forEach((file, index) => {
        expect(file.originalName).toBe(mockMultipleFiles[index].originalname);
        expect(file.filename).toBe(mockMultipleFiles[index].filename);
        expect(file.size).toBe(mockMultipleFiles[index].size);
        expect(file.processedAt).toBeDefined();
      });
    });

    it('should throw BadRequestException when no files are uploaded', async () => {
      const uploadDto: FileUploadDto = {};

      await expect(controller.uploadMultipleFiles([], uploadDto)).rejects.toThrow(BadRequestException);

      await expect(controller.uploadMultipleFiles(undefined as any, uploadDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadMixedFields', () => {
    it('should upload mixed field files successfully', async () => {
      const uploadDto: FileUploadDto = {
        description: 'Mixed field upload',
      };

      // Mock the processFileAsync method
      jest.spyOn(controller as any, 'processFileAsync').mockResolvedValue(undefined);

      const result = await controller.uploadMixedFields(mockMixedFiles, uploadDto);

      expect(result.message).toBe('Mixed field upload completed');
      expect(result.uploadedFiles.avatar).toHaveLength(1);
      expect(result.uploadedFiles.documents).toHaveLength(1);
      expect(result.uploadedFiles.images).toHaveLength(2);

      // Verify avatar files
      expect(result.uploadedFiles.avatar![0].originalName).toBe('avatar.jpg');
      expect(result.uploadedFiles.avatar![0].fieldName).toBe('avatar');

      // Verify document files
      expect(result.uploadedFiles.documents![0].originalName).toBe('doc.pdf');
      expect(result.uploadedFiles.documents![0].fieldName).toBe('documents');

      // Verify image files
      expect(result.uploadedFiles.images![0].originalName).toBe('image1.png');
      expect(result.uploadedFiles.images![1].originalName).toBe('image2.gif');
    });

    it('should handle empty mixed fields', async () => {
      const uploadDto: FileUploadDto = {};

      const result = await controller.uploadMixedFields({}, uploadDto);

      expect(result.message).toBe('Mixed field upload completed');
      expect(result.uploadedFiles).toEqual({});
    });
  });

  describe('Chunked Upload', () => {
    describe('startChunkedUpload', () => {
      it('should start chunked upload successfully', () => {
        const mockUUID = 'test-uuid-123';
        mockCrypto.randomUUID.mockReturnValue(mockUUID as any);
        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.writeFileSync.mockReturnValue(undefined);

        const startDto = {
          fileName: 'large-file.mp4',
          fileSize: 50 * 1024 * 1024, // 50MB
          totalChunks: 10,
        };

        const result = controller.startChunkedUpload(startDto);

        expect(result).toEqual({
          message: 'Chunked upload started',
          fileId: mockUUID,
          uploadDir: `./uploads/chunks/${mockUUID}`,
        });

        expect(mockFs.mkdirSync).toHaveBeenCalledWith(`./uploads/chunks/${mockUUID}`, { recursive: true });
        expect(mockFs.writeFileSync).toHaveBeenCalled();
      });
    });

    describe('uploadChunk', () => {
      const mockChunk: Express.Multer.File = {
        ...mockSingleFile,
        fieldname: 'chunk',
        originalname: 'chunk-0',
        filename: 'chunk-0',
        path: './uploads/chunks/test-uuid/chunk-0',
        size: 5 * 1024 * 1024, // 5MB
      };

      const mockChunkDto: ChunkUploadDto = {
        chunkIndex: 0,
        totalChunks: 2,
        fileName: 'test-file.mp4',
        fileId: 'test-uuid',
      };

      it('should upload chunk successfully (not final chunk)', () => {
        const mockMetadata = {
          fileId: 'test-uuid',
          fileName: 'test-file.mp4',
          fileSize: 10 * 1024 * 1024,
          totalChunks: 2,
          uploadedChunks: [],
          createdAt: new Date().toISOString(),
          status: 'started',
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));
        mockFs.writeFileSync.mockReturnValue(undefined);

        const result = controller.uploadChunk(mockChunk, mockChunkDto);

        expect(result).toEqual({
          message: 'Chunk 1/2 uploaded',
          fileId: 'test-uuid',
          progress: 50,
          remainingChunks: 1,
        });
      });

      it('should complete upload when final chunk is uploaded', () => {
        const mockMetadata = {
          fileId: 'test-uuid',
          fileName: 'test-file.mp4',
          fileSize: 10 * 1024 * 1024,
          totalChunks: 2,
          uploadedChunks: [
            {
              index: 0,
              size: 5 * 1024 * 1024,
              uploadedAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          status: 'started',
        };

        const finalChunkDto: ChunkUploadDto = {
          ...mockChunkDto,
          chunkIndex: 1,
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));
        mockFs.writeFileSync.mockReturnValue(undefined);

        // Mock mergeChunks method
        const mockFinalPath = './uploads/completed/test-file.mp4';
        jest.spyOn(controller as any, 'mergeChunks').mockReturnValue(mockFinalPath);

        const result = controller.uploadChunk(mockChunk, finalChunkDto);

        expect(result).toEqual({
          message: 'File upload completed',
          fileId: 'test-uuid',
          finalPath: mockFinalPath,
          totalSize: mockMetadata.fileSize,
        });
      });

      it('should throw BadRequestException when no chunk is uploaded', () => {
        expect(() => controller.uploadChunk(undefined as any, mockChunkDto)).toThrow(BadRequestException);
      });

      it('should throw BadRequestException when upload session not found', () => {
        mockFs.existsSync.mockReturnValue(false);

        expect(() => controller.uploadChunk(mockChunk, mockChunkDto)).toThrow(BadRequestException);
      });
    });

    describe('getChunkUploadStatus', () => {
      it('should return upload status successfully', () => {
        const mockMetadata = {
          fileId: 'test-uuid',
          fileName: 'test-file.mp4',
          fileSize: 10 * 1024 * 1024,
          totalChunks: 4,
          uploadedChunks: [
            { index: 0, size: 2.5 * 1024 * 1024, uploadedAt: new Date().toISOString() },
            { index: 1, size: 2.5 * 1024 * 1024, uploadedAt: new Date().toISOString() },
          ],
          createdAt: new Date().toISOString(),
          status: 'started' as const,
        };

        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetadata));

        const result = controller.getChunkUploadStatus({ fileId: 'test-uuid' });

        expect(result).toEqual({
          fileId: 'test-uuid',
          status: 'started',
          progress: 50,
          uploadedChunks: 2,
          totalChunks: 4,
          fileName: 'test-file.mp4',
          remainingChunks: 2,
        });
      });

      it('should throw BadRequestException when upload session not found', () => {
        mockFs.existsSync.mockReturnValue(false);

        expect(() => controller.getChunkUploadStatus({ fileId: 'non-existent' })).toThrow(BadRequestException);
      });
    });
  });

  describe('Helper Methods', () => {
    describe('processFileAsync', () => {
      it('should process file asynchronously', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await (controller as any).processFileAsync(mockSingleFile);

        expect(consoleSpy).toHaveBeenCalledWith(`Processing file: ${mockSingleFile.originalname}`);

        consoleSpy.mockRestore();
      });
    });

    describe('processFilesParallel', () => {
      it('should process files in parallel', async () => {
        jest.spyOn(controller as any, 'processFileAsync').mockResolvedValue(undefined);

        const result = await (controller as any).processFilesParallel(mockMultipleFiles, 'testField');

        expect(result?.fieldName).toBe('testField');
        expect(result.files).toHaveLength(2);
        expect(result.files[0].fieldName).toBe('testField');
        expect(result.files[1].fieldName).toBe('testField');
      });
    });

    describe('mergeChunks', () => {
      it('should merge chunks successfully', () => {
        const mockMetadata = {
          fileId: 'test-uuid',
          fileName: 'merged-file.mp4',
          fileSize: 10 * 1024 * 1024,
          totalChunks: 2,
          uploadedChunks: [
            { index: 0, size: 5 * 1024 * 1024, uploadedAt: new Date().toISOString() },
            { index: 1, size: 5 * 1024 * 1024, uploadedAt: new Date().toISOString() },
          ],
          createdAt: new Date().toISOString(),
          status: 'started' as const,
        };

        const mockWriteStream = {
          write: jest.fn(),
          end: jest.fn(),
        };

        mockFs.existsSync.mockReturnValue(false);
        mockFs.mkdirSync.mockReturnValue(undefined as any);
        mockFs.createWriteStream.mockReturnValue(mockWriteStream as any);
        mockFs.readFileSync.mockReturnValue(Buffer.from('chunk data'));
        mockFs.rmSync.mockReturnValue(undefined);

        const result = (controller as any).mergeChunks('test-uuid', mockMetadata);

        expect(result).toBe('./uploads/completed/merged-file.mp4');
        expect(mockWriteStream.write).toHaveBeenCalledTimes(2);
        expect(mockWriteStream.end).toHaveBeenCalled();
      });
    });
  });
});
