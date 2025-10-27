import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './index.css';

interface FileProgress {
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  message?: string;
  fileId?: string;
  totalChunks?: number;
  uploadedChunks?: number[];
  fileSize?: number;
  chunkSize?: number;
  storageMethod?: 'disk' | 'memory';
  currentChunkProgress?: number; // Progress of current chunk being uploaded (0-100)
}

interface ChunkUploadResponse {
  fileId: string;
  message?: string;
  finalPath?: string;
  chunkIndex?: number;
}

interface UploadStatusResponse {
  exists: boolean;
  fileName?: string;
  fileSize?: number;
  totalChunks?: number;
  uploadedChunks?: number[];
  storageMethod?: 'disk' | 'memory';
  lastUpdated?: string;
}

const API_BASE_URL = 'http://localhost:3000/chunk/v2';

const ChunkedUploader: React.FC = () => {
  const [chunkedFile, setChunkedFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024);
  const [chunkStorageMethod, setChunkStorageMethod] = useState<'disk' | 'memory'>('disk');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [overallSiteProgress, setOverallSiteProgress] = useState<number>(0);
  const [currentFileStatusMessage, setCurrentFileStatusMessage] = useState<string | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string>('');

  const [filesProgress, setFilesProgress] = useState<Record<string, FileProgress>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const activeChunkAbortControllersRef = useRef<Map<number, AbortController>>(new Map());
  const currentUploadAbortControllerRef = useRef<AbortController | null>(null);

  // Update progress for a file
  const updateProgress = useCallback(
    (
      fileName: string,
      progress: number,
      status: FileProgress['status'],
      message?: string,
      fileId?: string,
      totalChunks?: number,
      uploadedChunks?: number[],
      currentChunkProgress?: number
    ) => {
      setFilesProgress(prev => {
        const currentFileEntry = prev[fileName];
        const newUploadedChunks = uploadedChunks 
          ? Array.from(new Set(uploadedChunks)).sort((a, b) => a - b) 
          : currentFileEntry?.uploadedChunks || [];

        const updatedFilesProgress = {
          ...prev,
          [fileName]: {
            ...currentFileEntry,
            name: fileName,
            progress: Math.min(100, Math.max(0, progress)),
            status,
            message,
            fileId: fileId || currentFileEntry?.fileId,
            totalChunks: totalChunks || currentFileEntry?.totalChunks,
            uploadedChunks: newUploadedChunks,
            fileSize: currentFileEntry?.fileSize || chunkedFile?.size,
            chunkSize: currentFileEntry?.chunkSize || chunkSize,
            storageMethod: currentFileEntry?.storageMethod || chunkStorageMethod,
            currentChunkProgress: currentChunkProgress !== undefined ? 
              currentChunkProgress : currentFileEntry?.currentChunkProgress
          }
        };

        // Calculate overall progress
        const totalFiles = Object.keys(updatedFilesProgress).length;
        if (totalFiles > 0) {
          const aggregatedProgress = Object.values(updatedFilesProgress).reduce(
            (sum, file) => sum + (file.progress || 0), 0
          );
          setOverallSiteProgress(Math.round(aggregatedProgress / totalFiles));
        }

        return updatedFilesProgress;
      });
    },
    [chunkedFile, chunkSize, chunkStorageMethod]
  );

  // Check upload status on server
  const checkUploadStatus = useCallback(async (fileId: string): Promise<UploadStatusResponse> => {
    try {
      const response = await axios.get<UploadStatusResponse>(`${API_BASE_URL}/status/${fileId}`);
      return response.data;
    } catch (error) {
      console.error('Error checking upload status:', error);
      return { exists: false };
    }
  }, []);

  // Upload a single chunk with retry logic
const uploadSingleChunk = useCallback(
  async (
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    fileId: string,
    endpoint: string,
    maxRetries: number = 3
  ): Promise<ChunkUploadResponse> => {
    let retryCount = 0;
    
    while (retryCount <= maxRetries && isMountedRef.current && !isPaused) {
      const controller = new AbortController();
      currentUploadAbortControllerRef.current = controller;

      try {
        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunk, `${fileName}.part${chunkIndex}`);
        chunkFormData.append('chunkIndex', chunkIndex.toString());
        chunkFormData.append('totalChunks', totalChunks.toString());
        chunkFormData.append('fileName', fileName);
        chunkFormData.append('fileId', fileId);
        chunkFormData.append('storageMethod', chunkStorageMethod);

        // Get current progress state before starting upload
        const currentFileProgress = filesProgress[fileName] || {
          uploadedChunks: [],
          progress: 0
        };

        const response = await axios.post<ChunkUploadResponse>(endpoint, chunkFormData, {
          signal: controller.signal,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total && isMountedRef.current) {
              const loaded = progressEvent.loaded;
              const total = progressEvent.total;
              const chunkPercent = Math.round((loaded * 100) / total);
              
              // Calculate overall file progress
              const completedChunks = currentFileProgress.uploadedChunks?.length || 0;
              const currentChunkProgress = loaded / total;
              const fileProgress = ((completedChunks + currentChunkProgress) / totalChunks) * 100;
              
              updateProgress(
                fileName,
                fileProgress,
                'uploading',
                `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)`,
                fileId,
                totalChunks,
                currentFileProgress.uploadedChunks, // Maintain existing chunks
                chunkPercent
              );
            }
          }
        });

        currentUploadAbortControllerRef.current = null;
        
        // After successful upload, add this chunk to uploaded chunks
        const newUploadedChunks = [...(currentFileProgress.uploadedChunks || []), chunkIndex];
        const newProgress = (newUploadedChunks.length / totalChunks) * 100;
        
        updateProgress(
          fileName,
          newProgress,
          newUploadedChunks.length === totalChunks ? 'completed' : 'uploading',
          newUploadedChunks.length === totalChunks 
            ? 'Upload complete!' 
            : `Completed chunk ${chunkIndex + 1}/${totalChunks}`,
          fileId,
          totalChunks,
          newUploadedChunks,
          0 // Reset current chunk progress after completion
        );

        return response.data;

      } catch (error) {
        currentUploadAbortControllerRef.current = null;
        
        if (axios.isCancel(error) || isPaused) {
          throw new Error('Upload paused or cancelled');
        }

        if (retryCount === maxRetries) {
          throw error;
        }

        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
    
    throw new Error('Upload process interrupted');
  },
  [isPaused, chunkStorageMethod, filesProgress, updateProgress]
);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setChunkedFile(file);

      const existingProgress = filesProgress[file.name];
      if (existingProgress?.status === 'paused' && existingProgress.fileId) {
        setCurrentFileId(existingProgress.fileId);
        setChunkSize(existingProgress.chunkSize || 5 * 1024 * 1024);
        setChunkStorageMethod(existingProgress.storageMethod || 'disk');
        setIsPaused(true);
        setIsUploading(false);
        setCurrentFileStatusMessage(`Selected paused file '${file.name}' - Ready to resume from chunk ${(existingProgress.uploadedChunks?.length || 0) + 1}`);
      } else {
        setCurrentFileId('');
        setIsPaused(false);
        setIsUploading(false);
        setCurrentFileStatusMessage(null);
        updateProgress(file.name, 0, 'pending', 'Ready to upload', '', 0, [], 0);
      }
    }
  };

  // Main upload handler - sequential chunk upload (for new uploads)
  const handleChunkedUpload = useCallback(async () => {
    if (!chunkedFile) return;

    // If this is a paused upload, use resumeUpload instead
    if (isPaused && currentFileId) {
      await resumeUpload ( currentFileId, chunkedFile, chunkSize);
      return;
    }

    setIsUploading(true);
    setIsPaused(false);

    const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
    const endpoint = `${API_BASE_URL}/${chunkStorageMethod === 'disk' ? 'upload' : 'upload-memory'}`;
    let fileId = currentFileId;

    try {
      // Start new session if needed
      if (!fileId) {
        const response = await axios.post<ChunkUploadResponse>(`${API_BASE_URL}/start`, {
          fileName: chunkedFile.name,
          fileSize: chunkedFile.size,
          totalChunks,
          storageMethod: chunkStorageMethod
        });
        fileId = response.data.fileId;
        setCurrentFileId(fileId);
      }

      // Update initial progress
      updateProgress(
        chunkedFile.name,
        0,
        'uploading',
        `Starting upload - chunk 1/${totalChunks}`,
        fileId,
        totalChunks,
        [],
        0
      );

      // Upload chunks sequentially starting from 0
      const currentUploadedChunks: number[] = [];
      
      for (let i = 0; i < totalChunks; i++) {
        // Check if paused or unmounted
        if (isPaused || !isMountedRef.current) {
          break;
        }

        console.log(`Starting upload of chunk ${i + 1}/${totalChunks}`);

        const chunk = chunkedFile.slice(
          i * chunkSize,
          Math.min((i + 1) * chunkSize, chunkedFile.size)
        );

        try {
          await uploadSingleChunk(
            chunk,
            i,
            totalChunks,
            chunkedFile.name,
            fileId,
            endpoint
          );

          // Add to uploaded chunks
          currentUploadedChunks.push(i);

          // Update progress after successful chunk upload
          const progress = (currentUploadedChunks.length / totalChunks) * 100;
          updateProgress(
            chunkedFile.name,
            progress,
            'uploading',
            `Completed chunk ${i + 1}/${totalChunks}`,
            fileId,
            totalChunks,
            currentUploadedChunks,
            100 // Current chunk is now 100% complete
          );

          console.log(`Chunk ${i + 1}/${totalChunks} uploaded successfully`);

        } catch (error) {
          if (isPaused) {
            updateProgress(
              chunkedFile.name,
              (currentUploadedChunks.length / totalChunks) * 100,
              'paused',
              `Paused at chunk ${i + 1}/${totalChunks}`,
              fileId,
              totalChunks,
              currentUploadedChunks,
              0 // Reset current chunk progress when paused
            );
            return;
          }
          throw error;
        }
      }

      // Finalize if all chunks uploaded and not paused
      if (!isPaused && isMountedRef.current && currentUploadedChunks.length === totalChunks) {
        await axios.post(`${API_BASE_URL}/complete`, {
          fileId,
          fileName: chunkedFile.name,
          totalChunks,
          storageMethod: chunkStorageMethod
        });

        updateProgress(
          chunkedFile.name,
          100,
          'completed',
          'Upload complete!',
          fileId,
          totalChunks,
          Array.from({ length: totalChunks }, (_, i) => i),
          0 // Reset current chunk progress
        );
        resetUploadState();
      }

    } catch (error) {
      if (isMountedRef.current && !isPaused) {
        console.error('Upload error:', error);
        setCurrentFileStatusMessage(`Upload error: ${error.message}`);
        updateProgress(
          chunkedFile.name,
          filesProgress[chunkedFile.name]?.progress || 0,
          'error',
          `Upload failed: ${error.message}`,
          fileId,
          undefined,
          undefined,
          0 // Reset current chunk progress
        );
      }
    } finally {
      if (isMountedRef.current && !isPaused) {
        setIsUploading(false);
      }
    }
  }, [chunkedFile, isPaused, currentFileId, chunkSize, chunkStorageMethod, updateProgress, uploadSingleChunk, filesProgress]);


  const finalizeUpload = useCallback(async () => {
      if (!chunkedFile || !currentFileId) {
        console.error('No file or fileId available for finalization');
        return;
      }

      try {
        setCurrentFileStatusMessage('Finalizing upload...');
        
        const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
        const currentProgress = filesProgress[chunkedFile.name];
        
        // Verify all chunks are uploaded before finalizing
        if ((currentProgress?.uploadedChunks?.length || 0) !== totalChunks) {
          throw new Error(`Cannot finalize - only ${currentProgress?.uploadedChunks?.length || 0} of ${totalChunks} chunks uploaded`);
        }

        const response = await axios.post<ChunkUploadResponse>(
          `${API_BASE_URL}/complete`,
          {
            fileId: currentFileId,
            fileName: chunkedFile.name,
            totalChunks,
            storageMethod: chunkStorageMethod,
            uploadedChunks: currentProgress?.uploadedChunks,
            fileSize: chunkedFile.size,
            chunkSize: chunkSize
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data.finalPath) {
          updateProgress(
            chunkedFile.name,
            100,
            'completed',
            'Upload complete! File available at: ' + response.data.finalPath,
            currentFileId,
            totalChunks,
            Array.from({ length: totalChunks }, (_, i) => i),
            0
          );
          setCurrentFileStatusMessage('Upload finalized successfully!');
          
          // Clean up after successful finalization
          setTimeout(() => {
            resetUploadState();
          }, 3000);
        } else {
          throw new Error('Finalization failed - no file path returned');
        }
      } catch (error) {
        console.error('Finalization error:', error);
        setCurrentFileStatusMessage(`Finalization failed: ${error.message}`);
        updateProgress(
          chunkedFile.name,
          filesProgress[chunkedFile.name]?.progress || 0,
          'error',
          `Finalization failed: ${error.message}`,
          currentFileId,
          undefined,
          undefined,
          0
        );
      }
}, [chunkedFile, currentFileId, chunkSize, chunkStorageMethod, filesProgress, updateProgress, resetUploadState]);

  // Resume upload
const resumeUpload = useCallback(async (fileId: string, file: File, chunkSize: number) => {
  if (!file) return;

  setIsUploading(true);
  setIsPaused(false);
  setCurrentFileStatusMessage(`Resuming upload for ${file.name}`);

  const totalChunks = Math.ceil(file.size / chunkSize);
  const endpoint = `${API_BASE_URL}/${chunkStorageMethod === 'disk' ? 'upload' : 'upload-memory'}`;

  try {
    // 1. Check existing status from server
    const status = await checkUploadStatus(fileId);
    
    if (!status.exists) {
      throw new Error('No upload session found to resume');
    }

    // 2. Get list of already uploaded chunks from server
    const uploadedChunks = status.uploadedChunks || [];
    const missingChunks = [];
    
    // 3. Identify which chunks need to be uploaded
    for (let i = 0; i < totalChunks; i++) {
      if (!uploadedChunks.includes(i)) {
        missingChunks.push(i);
      }
    }

    // 4. Update UI to show resuming state with existing progress
    const initialProgress = (uploadedChunks.length / totalChunks) * 100;
    updateProgress(
      file.name,
      initialProgress,
      'uploading',
      `Resuming upload - ${uploadedChunks.length}/${totalChunks} chunks already uploaded`,
      fileId,
      totalChunks,
      uploadedChunks,
      0
    );

    // 5. Upload each missing chunk using the existing upload system
    for (const chunkIndex of missingChunks) {
      if (isPaused || !isMountedRef.current) break;

      const start = chunkIndex * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      try {
        // Use the existing uploadSingleChunk function which handles progress tracking
        await uploadSingleChunk(
          chunk,
          chunkIndex,
          totalChunks,
          file.name,
          fileId,
          endpoint
        );

        // Update the list of uploaded chunks
        const newUploadedChunks = [...uploadedChunks, chunkIndex];
        const newProgress = (newUploadedChunks.length / totalChunks) * 100;
        
        updateProgress(
          file.name,
          newProgress,
          'uploading',
          newUploadedChunks.length === totalChunks 
            ? 'Upload complete!' 
            : `Completed chunk ${chunkIndex + 1}/${totalChunks}`,
          fileId,
          totalChunks,
          newUploadedChunks,
          0
        );

      } catch (error) {
        if (isPaused) {
          updateProgress(
            file.name,
            (uploadedChunks.length / totalChunks) * 100,
            'paused',
            `Paused at chunk ${chunkIndex + 1}/${totalChunks}`,
            fileId,
            totalChunks,
            uploadedChunks,
            0
          );
          return;
        }
        throw error;
      }
    }

    // 6. Finalize if all chunks are uploaded
    if (!isPaused && isMountedRef.current) {
      const currentProgress = filesProgress[file.name];
      if (currentProgress?.uploadedChunks?.length === totalChunks) {
        await finalizeUpload();
      }
    }

  } catch (error) {
    if (isMountedRef.current && !isPaused) {
      console.error('Resume error:', error);
      setCurrentFileStatusMessage(`Resume error: ${error.message}`);
      updateProgress(
        file.name,
        filesProgress[file.name]?.progress || 0,
        'error',
        `Resume failed: ${error.message}`,
        fileId,
        undefined,
        undefined,
        0
      );
    }
  } finally {
    if (isMountedRef.current && !isPaused) {
      setIsUploading(false);
    }
  }
}, [checkUploadStatus, chunkStorageMethod, isPaused, updateProgress, uploadSingleChunk, filesProgress]);

// Pause upload
  const pauseUpload = useCallback(() => {
    if (!isUploading) return;

    setIsPaused(true);
    setIsUploading(false);

    // Abort current chunk upload
    if (currentUploadAbortControllerRef.current && !currentUploadAbortControllerRef.current.signal.aborted) {
      currentUploadAbortControllerRef.current.abort('Upload paused by user');
    }

    if (chunkedFile) {
      const currentProgress = filesProgress[chunkedFile.name];
      updateProgress(
        chunkedFile.name,
        currentProgress?.progress || 0,
        'paused',
        `Upload paused - will resume from chunk ${(currentProgress?.uploadedChunks?.length || 0) + 1}`,
        currentFileId,
        currentProgress?.totalChunks,
        currentProgress?.uploadedChunks,
        0 // Reset current chunk progress when paused
      );
      setCurrentFileStatusMessage(`Upload paused - ready to resume from chunk ${(currentProgress?.uploadedChunks?.length || 0) + 1}`);
    }
  }, [chunkedFile, currentFileId, filesProgress, isUploading, updateProgress]);

  // Cancel upload
  const cancelUpload = useCallback(() => {
    setIsUploading(false);
    setIsPaused(false);
    setCurrentFileStatusMessage('Upload cancelled');

    // Abort current upload
    if (currentUploadAbortControllerRef.current && !currentUploadAbortControllerRef.current.signal.aborted) {
      currentUploadAbortControllerRef.current.abort('Upload cancelled by user');
    }

    if (chunkedFile) {
      updateProgress(
        chunkedFile.name,
        0,
        'error',
        'Upload cancelled',
        currentFileId,
        undefined,
        undefined,
        0 // Reset current chunk progress
      );
    }
    resetUploadState();
  }, [chunkedFile, currentFileId, updateProgress]);

  // Reset upload state
  const resetUploadState = useCallback(() => {
    setChunkedFile(null);
    setCurrentFileId('');
    setIsPaused(false);
    setIsUploading(false);
    setCurrentFileStatusMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Load saved uploads on mount
  useEffect(() => {
    try {
      const savedUploads = JSON.parse(localStorage.getItem('chunkedUploads') || '{}');
      if (Object.keys(savedUploads).length > 0) {
        setFilesProgress(savedUploads);

        const pausedUpload = Object.values(savedUploads).find(
          (file: any) => file.status === 'paused'
        ) as FileProgress | undefined;

        if (pausedUpload) {
          const dummyFile = new File([], pausedUpload.name, {
            type: 'application/octet-stream',
            lastModified: Date.now()
          });
          Object.defineProperty(dummyFile, 'size', { value: pausedUpload.fileSize || 0 });
          setChunkedFile(dummyFile);
          setCurrentFileId(pausedUpload.fileId || '');
          setChunkSize(pausedUpload.chunkSize || 5 * 1024 * 1024);
          setChunkStorageMethod(pausedUpload.storageMethod || 'disk');
          setIsPaused(true);
          setIsUploading(false);
          setCurrentFileStatusMessage(`Found paused upload for '${pausedUpload.name}' - will resume from chunk ${(pausedUpload.uploadedChunks?.length || 0) + 1}`);
        }
      }
    } catch (error) {
      console.error('Failed to parse saved uploads', error);
      localStorage.removeItem('chunkedUploads');
    }

    return () => {
      isMountedRef.current = false;
      if (currentUploadAbortControllerRef.current) {
        currentUploadAbortControllerRef.current.abort('Component unmounted');
      }
    };
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    if (Object.keys(filesProgress).length > 0) {
      localStorage.setItem('chunkedUploads', JSON.stringify(filesProgress));
    }
  }, [filesProgress]);

  return (
    <div className="chunked-uploader">
      <h2>Sequential Chunked File Upload with Resume</h2>

      <div className="upload-controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading}
        />

        <div className="settings">
          <label>
            Chunk Size (MB):
            <input
              type="number"
              value={chunkSize / (1024 * 1024)}
              onChange={(e) => setChunkSize(Number(e.target.value) * 1024 * 1024)}
              min="1"
              disabled={isUploading || isPaused}
            />
          </label>

          <label>
            Storage Method:
            <select
              value={chunkStorageMethod}
              onChange={(e) => setChunkStorageMethod(e.target.value as 'disk' | 'memory')}
              disabled={isUploading || isPaused}
            >
              <option value="disk">Disk Storage</option>
              <option value="memory">Memory Storage</option>
            </select>
          </label>
        </div>

        <div className="action-buttons">
          {!isUploading && !isPaused && (
            <button
              onClick={handleChunkedUpload}
              disabled={!chunkedFile}
              className="upload-button"
            >
              Start Upload
            </button>
          )}
          
          {isUploading && !isPaused && (
            <button
              onClick={pauseUpload}
              className="pause-button"
            >
              Pause Upload
            </button>
          )}
          
          {isPaused && (
            <button
              onClick={()=>resumeUpload(currentFileId, chunkedFile!, chunkSize)}
              disabled={!chunkedFile}
              className="resume-button"
            >
              Resume Upload
            </button>
          )}
          
          {(isUploading || isPaused) && (
            <button
              onClick={cancelUpload}
              className="cancel-button"
            >
              Cancel Upload
            </button>
          )}
        </div>
      </div>

      {chunkedFile && (
        <div className="upload-info">
          <h3>Currently Selected File: {chunkedFile.name}</h3>
          <p>Size: {(chunkedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
          <p>Total Chunks: {Math.ceil(chunkedFile.size / chunkSize)}</p>
          <p>Storage Method: {chunkStorageMethod}</p>
          {currentFileId && <p>Upload ID: {currentFileId}</p>}
          {filesProgress[chunkedFile.name]?.uploadedChunks && (
            <p>Uploaded Chunks: {filesProgress[chunkedFile.name].uploadedChunks?.length || 0} / {Math.ceil(chunkedFile.size / chunkSize)}</p>
          )}
        </div>
      )}

      <div className="progress-container">
        <h3>File Progress</h3>
        {chunkedFile && filesProgress[chunkedFile.name] && (
          <div className="file-progress">
            <div className="progress-item">
              <div className="file-info">
                <span className="file-name">{chunkedFile.name}</span>
                <span className="file-status">
                  ({filesProgress[chunkedFile.name].status}): {filesProgress[chunkedFile.name].message}
                </span>
              </div>
              
              <div className="progress-section">
                <h4>Overall Progress</h4>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${filesProgress[chunkedFile.name].progress}%` }}
                  />
                  <span className="progress-percent">
                    {filesProgress[chunkedFile.name].progress.toFixed(0)}%
                  </span>
                </div>
              </div>
              
              {filesProgress[chunkedFile.name].status === 'uploading' && (
                <div className="progress-section">
                  <h4>Current Chunk Progress</h4>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${filesProgress[chunkedFile.name].currentChunkProgress || 0}%` }}
                    />
                    <span className="progress-percent">
                      {filesProgress[chunkedFile.name].currentChunkProgress?.toFixed(0) || 0}%
                    </span>
                  </div>
                  <div className="chunk-info">
                    Uploading chunk {filesProgress[chunkedFile.name].uploadedChunks?.length || 0 + 1}/
                    {filesProgress[chunkedFile.name].totalChunks}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="overall-progress">
        <h3>Overall Site Progress (All Files)</h3>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${overallSiteProgress}%` }}
          />
          <span className="progress-percent">{overallSiteProgress.toFixed(0)}%</span>
        </div>
      </div>

      {currentFileStatusMessage && (
        <div className="status-message">{currentFileStatusMessage}</div>
      )}

      <div className="upload-instructions">
        <h3>How to use:</h3>
        <ol>
          <li>Select a file and click "Start Upload"</li>
          <li>Chunks are uploaded sequentially (one at a time)</li>
          <li>Click "Pause Upload" to pause at any time</li>
          <li>Click "Resume Upload" to continue from the next chunk</li>
          <li>Progress is saved even after page refresh</li>
        </ol>
        <p>
          <strong>Note:</strong> Upload resumes from the exact chunk where it was paused.
          For successful resume, use the same file you started with.
        </p>
      </div>
    </div>
  );
};

export default ChunkedUploader;