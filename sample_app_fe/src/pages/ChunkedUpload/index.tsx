import React, { useState, useRef, useEffect } from 'react';
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
  const [chunkSize, setChunkSize] = useState<number>(5 * 1024 * 1024); // 5MB default
  const [chunkStorageMethod, setChunkStorageMethod] = useState<'disk' | 'memory'>('disk');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [chunkProgress, setChunkProgress] = useState<number>(0);
  const [chunkUploadId, setChunkUploadId] = useState<string>('');
  const [chunkStatus, setChunkStatus] = useState<string | null>(null);
  const [filesProgress, setFilesProgress] = useState<Record<string, FileProgress>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef<AbortController[]>([]);
  const isMountedRef = useRef(true);

  // Load previous uploads on component mount
  useEffect(() => {
    const savedUploads = localStorage.getItem('chunkedUploads');
    if (savedUploads) {
      try {
        const parsed = JSON.parse(savedUploads);
        setFilesProgress(parsed);
        
        // Find any paused uploads
        const pausedUpload = Object.values(parsed).find(
          (file: any) => file.status === 'paused'
        ) as FileProgress | undefined;
        
        if (pausedUpload) {
          setChunkUploadId(pausedUpload.fileId || '');
          setChunkSize(pausedUpload.chunkSize || 5 * 1024 * 1024);
          setChunkStorageMethod(pausedUpload.storageMethod || 'disk');
        }
      } catch (error) {
        console.error('Failed to parse saved uploads', error);
      }
    }

    return () => {
      isMountedRef.current = false;
      activeUploadsRef.current.forEach(controller => controller.abort());
    };
  }, []);

  // Save upload progress to localStorage
  useEffect(() => {
    localStorage.setItem('chunkedUploads', JSON.stringify(filesProgress));
  }, [filesProgress]);

  const updateProgress = (
    fileName: string,
    progress: number,
    status: FileProgress['status'],
    message?: string,
    fileId?: string,
    totalChunks?: number,
    uploadedChunks?: number[]
  ) => {
    setFilesProgress(prev => ({
      ...prev,
      [fileName]: {
        name: fileName,
        progress,
        status,
        message,
        fileId,
        totalChunks,
        uploadedChunks: uploadedChunks || prev[fileName]?.uploadedChunks || [],
        fileSize: chunkedFile?.size,
        chunkSize,
        storageMethod: chunkStorageMethod
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setChunkedFile(file);
      
      // Check if this file has existing progress
      const existingProgress = filesProgress[file.name];
      if (existingProgress && existingProgress.status === 'paused') {
        setChunkUploadId(existingProgress.fileId || '');
        setChunkSize(existingProgress.chunkSize || 5 * 1024 * 1024);
        setChunkStorageMethod(existingProgress.storageMethod || 'disk');
      } else {
        setChunkUploadId(''); // Reset for new file
      }
    }
  };

  const uploadChunkWithRetry = async (
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    fileName: string,
    fileId: string,
    endpoint: string,
    maxRetries: number = 3
  ): Promise<ChunkUploadResponse> => {
    let retryCount = 0;
    const chunkFormData = new FormData();
    chunkFormData.append('chunk', chunk, `${fileName}.part${chunkIndex}`);
    chunkFormData.append('chunkIndex', chunkIndex.toString());
    chunkFormData.append('totalChunks', totalChunks.toString());
    chunkFormData.append('fileName', fileName);
    chunkFormData.append('fileId', fileId);
    chunkFormData.append('storageMethod', chunkStorageMethod);

    const controller = new AbortController();
    activeUploadsRef.current.push(controller);

    while (retryCount <= maxRetries && isMountedRef.current) {
      if (isPaused) {
        controller.abort();
        throw new Error('Upload paused');
      }

      try {
        const response = await axios.post<ChunkUploadResponse>(endpoint, chunkFormData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total && isMountedRef.current) {
              const chunkPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const overallProgress = Math.round(
                ((chunkIndex * chunkSize + progressEvent.loaded) / (totalChunks * chunkSize)) * 100
              );
              setChunkProgress(overallProgress);
              updateProgress(
                fileName,
                overallProgress,
                'uploading',
                `Chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)`,
                fileId,
                totalChunks,
                [...(filesProgress[fileName]?.uploadedChunks || []), chunkIndex]
              );
            }
          },
          signal: controller.signal,
          timeout: 30 * 60 * 1000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        activeUploadsRef.current = activeUploadsRef.current.filter(c => c !== controller);
        return response.data;
      } catch (error) {
        if (axios.isCancel(error)) {
          throw error;
        }
        if (retryCount === maxRetries) {
          throw error;
        }
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  };

  const checkExistingUpload = async (fileName: string): Promise<string | null> => {
    const existingProgress = filesProgress[fileName];
    if (existingProgress?.fileId) {
      try {
        const response = await axios.get<UploadStatusResponse>(
          `${API_BASE_URL}/status/${existingProgress.fileId}`
        );
        
        if (response.data.exists) {
          // Verify the file matches
          if (response.data.fileSize === existingProgress.fileSize && 
              response.data.fileName === fileName) {
            return existingProgress.fileId;
          }
        }
      } catch (error) {
        console.error('Failed to check upload status', error);
      }
    }
    return null;
  };

  const handleChunkedUpload = async () => {
    if (!chunkedFile) return;

    setIsUploading(true);
    setIsPaused(false);
    setChunkProgress(0);

    const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
    const chunkUploadEndpoint = chunkStorageMethod === 'disk' 
      ? `${API_BASE_URL}/upload` 
      : `${API_BASE_URL}/upload-memory`;

    try {
      // Check for existing upload
      let fileId = chunkUploadId;
      if (!fileId) {
        fileId = await checkExistingUpload(chunkedFile.name) as string;
      }

      if (!fileId) {
        // Start new upload session
        const startResponse = await axios.post<ChunkUploadResponse>(`${API_BASE_URL}/start`, {
          fileName: chunkedFile.name,
          fileSize: chunkedFile.size,
          totalChunks,
          storageMethod: chunkStorageMethod
        });
        fileId = startResponse.data.fileId;
      }

      setChunkUploadId(fileId);
      updateProgress(
        chunkedFile.name,
        0,
        'uploading',
        'Starting upload...',
        fileId,
        totalChunks
      );

      // Get list of chunks to upload (skip already uploaded ones)
      const existingProgress = filesProgress[chunkedFile.name];
      const uploadedChunks = existingProgress?.uploadedChunks || [];
      const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !uploadedChunks.includes(i));

      // Upload chunks with concurrency control
      const concurrencyLimit = navigator.hardwareConcurrency || 3;
      const uploadQueue = [...chunksToUpload];
      const activeUploads: Promise<void>[] = [];

      const processQueue = async () => {
        while ((uploadQueue.length > 0 || activeUploads.length > 0) && !isPaused && isMountedRef.current) {
          // Start new uploads while under concurrency limit
          while (uploadQueue.length > 0 && activeUploads.length < concurrencyLimit && !isPaused && isMountedRef.current) {
            const chunkIndex = uploadQueue.shift();
            if (chunkIndex === undefined) continue;

            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, chunkedFile.size);
            const chunk = chunkedFile.slice(start, end);

            const uploadPromise = uploadChunkWithRetry(
              chunk,
              chunkIndex,
              totalChunks,
              chunkedFile.name,
              fileId,
              chunkUploadEndpoint
            ).then(response => {
              console.log(`Chunk ${chunkIndex} uploaded:`, response.message);
            }).catch(error => {
              if (error.message !== 'Upload paused') {
                console.error(`Failed to upload chunk ${chunkIndex}:`, error);
                throw error;
              }
            }).finally(() => {
              activeUploads.splice(activeUploads.indexOf(uploadPromise), 1);
            });

            activeUploads.push(uploadPromise);
          }

          // Wait for at least one upload to complete
          if (activeUploads.length > 0) {
            await Promise.race(activeUploads);
          }
        }

        if (isPaused && isMountedRef.current) {
          updateProgress(
            chunkedFile.name,
            chunkProgress,
            'paused',
            'Upload paused - you can resume later',
            fileId,
            totalChunks
          );
          throw new Error('Upload paused');
        }
      };

      await processQueue();

      // Finalize upload if not paused
      if (!isPaused && isMountedRef.current) {
        const finalizeResponse = await axios.post<ChunkUploadResponse>(`${API_BASE_URL}/complete`, {
          fileId,
          fileName: chunkedFile.name,
          totalChunks,
          storageMethod: chunkStorageMethod
        });

        if (finalizeResponse.data.finalPath) {
          updateProgress(
            chunkedFile.name,
            100,
            'completed',
            'Upload complete',
            fileId,
            totalChunks
          );
          setChunkStatus('Upload completed successfully');
          resetUploadState();
        } else {
          throw new Error('Upload incomplete after finalization');
        }
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        if (error.message !== 'Upload paused') {
          console.error('Chunked upload failed:', error);
          const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          updateProgress(
            chunkedFile.name,
            chunkProgress,
            'error',
            `Upload failed: ${errorMessage}`,
            chunkUploadId
          );
          setChunkStatus(`Upload failed: ${errorMessage}`);
        }
        setIsUploading(false);
      }
    }
  };

  const pauseUpload = () => {
    setIsPaused(true);
    // Abort all active requests
    activeUploadsRef.current.forEach(controller => {
      controller.abort('Upload paused by user');
    });
    activeUploadsRef.current = [];
  };

  const resumeUpload = async () => {
    if (!chunkedFile) return;
    
    try {
      // Verify the upload can be resumed
      const response = await axios.get<UploadStatusResponse>(
        `${API_BASE_URL}/status/${chunkUploadId}`
      );
      
      if (!response.data.exists) {
        throw new Error('Upload session expired or not found');
      }

      // User must re-select the same file
      if (response.data.fileName !== chunkedFile.name || 
          response.data.fileSize !== chunkedFile.size) {
        throw new Error('Please select the same file to resume upload');
      }

      setIsPaused(false);
      setIsUploading(true);
      await handleChunkedUpload();
    } catch (error) {
      console.error('Resume failed:', error);
      if (chunkedFile) {
        updateProgress(
          chunkedFile.name,
          chunkProgress,
          'error',
          'Resume failed - please select the same file and try again',
          chunkUploadId
        );
      }
      setIsUploading(false);
    }
  };

  const cancelUpload = () => {
    setIsUploading(false);
    setIsPaused(false);
    // Abort all active requests
    activeUploadsRef.current.forEach(controller => {
      controller.abort('Upload cancelled by user');
    });
    activeUploadsRef.current = [];
    
    if (chunkedFile) {
      updateProgress(
        chunkedFile.name,
        0,
        'error',
        'Upload cancelled',
        chunkUploadId
      );
    }
    resetUploadState();
  };

  const resetUploadState = () => {
    setChunkedFile(null);
    setChunkUploadId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="chunked-uploader">
      <h2>Chunked File Upload with Pause/Resume</h2>
      
      <div className="upload-controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading && !isPaused}
        />
        
        <div className="settings">
          <label>
            Chunk Size (MB):
            <input
              type="number"
              value={chunkSize / (1024 * 1024)}
              onChange={(e) => setChunkSize(Number(e.target.value) * 1024 * 1024)}
              min="1"
              disabled={isUploading && !isPaused}
            />
          </label>
          
          <label>
            Storage Method:
            <select
              value={chunkStorageMethod}
              onChange={(e) => setChunkStorageMethod(e.target.value as 'disk' | 'memory')}
              disabled={isUploading && !isPaused}
            >
              <option value="disk">Disk Storage</option>
              <option value="memory">Memory Storage</option>
            </select>
          </label>
        </div>
        
        {!isUploading ? (
          <button
            onClick={handleChunkedUpload}
            disabled={!chunkedFile}
            className="upload-button"
          >
            Start Upload
          </button>
        ) : isPaused ? (
          <button 
            onClick={resumeUpload}
            className="resume-button"
            disabled={!chunkedFile}
          >
            Resume Upload
          </button>
        ) : (
          <button 
            onClick={pauseUpload}
            className="pause-button"
          >
            Pause Upload
          </button>
        )}
        
        {(isUploading || isPaused) && (
          <button 
            onClick={cancelUpload}
            className="cancel-button"
          >
            Cancel
          </button>
        )}
      </div>
      
      {chunkedFile && (
        <div className="upload-info">
          <h3>File: {chunkedFile.name}</h3>
          <p>Size: {(chunkedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
          <p>Chunks: {Math.ceil(chunkedFile.size / chunkSize)}</p>
          <p>Storage Method: {chunkStorageMethod}</p>
          {filesProgress[chunkedFile.name]?.fileId && (
            <p>Upload ID: {filesProgress[chunkedFile.name].fileId}</p>
          )}
        </div>
      )}
      
      <div className="progress-container">
        {Object.values(filesProgress)
          .sort((a, b) => a.status === 'uploading' ? -1 : 1)
          .map((fileProgress) => (
            <div key={fileProgress.name} className={`progress-item ${fileProgress.status}`}>
              <div className="file-info">
                <span className="file-name">{fileProgress.name}</span>
                <span className="file-status">{fileProgress.message || fileProgress.status}</span>
                {fileProgress.status === 'paused' && (
                  <button 
                    onClick={() => {
                      // Create a dummy file object with same metadata
                      const file = new File([], fileProgress.name || '', {
                        type: 'application/octet-stream',
                        lastModified: Date.now()
                      });
                      Object.defineProperty(file, 'size', { value: fileProgress.fileSize || 0 });
                      
                      setChunkedFile(file);
                      setChunkUploadId(fileProgress.fileId || '');
                      setChunkSize(fileProgress.chunkSize || 5 * 1024 * 1024);
                      setChunkStorageMethod(fileProgress.storageMethod || 'disk');
                    }}
                    className="resume-file-button"
                  >
                    Select File to Resume
                  </button>
                )}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${fileProgress.progress}%` }}
                />
                <span className="progress-percent">{fileProgress.progress}%</span>
              </div>
            </div>
          ))}
      </div>
      
      {chunkStatus && <div className="status-message">{chunkStatus}</div>}

      <div className="upload-instructions">
        <h3>How to resume uploads:</h3>
        <ol>
          <li>Pause an ongoing upload</li>
          <li>Refresh the page</li>
          <li>Click "Select File to Resume" next to your file</li>
          <li>Click "Resume Upload"</li>
        </ol>
        <p><strong>Note:</strong> You must select the exact same file to resume the upload.</p>
      </div>
    </div>
  );
};

export default ChunkedUploader;