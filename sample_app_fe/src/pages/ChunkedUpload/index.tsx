import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './index.css'; // Assuming your CSS is already set up

interface FileProgress {
  name: string;
  progress: number; // Overall progress for THIS file (0-100)
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  message?: string;
  fileId?: string;
  totalChunks?: number;
  uploadedChunks?: number[]; // List of successfully uploaded chunk indices
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
  uploadedChunks?: number[]; // Chunks known to the server
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
  // Removed chunkProgress, as per-file progress is now in filesProgress state
  const [overallSiteProgress, setOverallSiteProgress] = useState<number>(0); // Progress across ALL files
  const [currentFileStatusMessage, setCurrentFileStatusMessage] = useState<string | null>(null); // Status for the currently selected file
  const [currentFileId, setCurrentFileId] = useState<string>(''); // File ID for the currently selected file

  const [filesProgress, setFilesProgress] = useState<Record<string, FileProgress>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  const activeChunkAbortControllersRef = useRef<Map<number, AbortController>>(new Map()); // Map of chunkIndex to AbortController

  // --- Utility Functions (moved inside component or memoized) ---

  const updateProgress = useCallback(
    (
      fileName: string,
      progress: number,
      status: FileProgress['status'],
      message?: string,
      fileId?: string,
      totalChunks?: number,
      uploadedChunks?: number[]
    ) => {
      setFilesProgress(prev => {
        const currentFileEntry = prev[fileName];
        const newUploadedChunks = uploadedChunks ? Array.from(new Set(uploadedChunks)).sort((a, b) => a - b) : currentFileEntry?.uploadedChunks;

        const updatedFilesProgress = {
          ...prev,
          [fileName]: {
            ...currentFileEntry, // Keep existing fields
            name: fileName,
            progress,
            status,
            message,
            fileId: fileId || currentFileEntry?.fileId,
            totalChunks: totalChunks || currentFileEntry?.totalChunks,
            uploadedChunks: newUploadedChunks || [],
            fileSize: currentFileEntry?.fileSize || chunkedFile?.size, // Use currentFileEntry's size if available
            chunkSize: currentFileEntry?.chunkSize || chunkSize,
            storageMethod: currentFileEntry?.storageMethod || chunkStorageMethod
          }
        };

        // Calculate overall site progress
        const totalFiles = Object.keys(updatedFilesProgress).length;
        if (totalFiles === 0) {
          setOverallSiteProgress(0);
          return updatedFilesProgress;
        }

        const aggregatedProgress = Object.values(updatedFilesProgress).reduce((sum, file) => {
          // Weighted average based on progress * (file's total chunks) or just its progress
          // For simplicity, let's just average the individual file progress
          return sum + (file.progress || 0);
        }, 0);

        setOverallSiteProgress(Math.round(aggregatedProgress / totalFiles));

        return updatedFilesProgress;
      });
    },
    [chunkedFile, chunkSize, chunkStorageMethod] // Dependencies for useCallback
  );

  const checkUploadStatus = useCallback(async (fileId: string): Promise<UploadStatusResponse> => {
    try {
      const response = await axios.get<UploadStatusResponse>(
        `${API_BASE_URL}/status/${fileId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error checking upload status:', error);
      return { exists: false };
    }
  }, []);

  const uploadChunkWithRetry = useCallback(
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
      const chunkFormData = new FormData();
      chunkFormData.append('chunk', chunk, `${fileName}.part${chunkIndex}`);
      chunkFormData.append('chunkIndex', chunkIndex.toString());
      chunkFormData.append('totalChunks', totalChunks.toString());
      chunkFormData.append('fileName', fileName);
      chunkFormData.append('fileId', fileId);
      chunkFormData.append('storageMethod', chunkStorageMethod);

      const controller = new AbortController();
      activeChunkAbortControllersRef.current.set(chunkIndex, controller);

      while (retryCount <= maxRetries && isMountedRef.current) {
        if (isPaused) {
          // If paused, abort this specific chunk request (if it's still in the map)
          activeChunkAbortControllersRef.current.get(chunkIndex)?.abort('Upload paused by user');
          activeChunkAbortControllersRef.current.delete(chunkIndex); // Clean up
          throw new Error('Upload paused');
        }

        try {
          const response = await axios.post<ChunkUploadResponse>(endpoint, chunkFormData, {
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total && isMountedRef.current) {
                const chunkPercent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                // Calculate current file's progress based on completed chunks + current chunk's progress
                const currentFileProgressCalculated = (
                    (filesProgress[fileName]?.uploadedChunks?.length || 0) * chunkSize + progressEvent.loaded
                  ) / (totalChunks * chunkSize) * 100;

                updateProgress(
                  fileName,
                  Math.min(100, Math.round(currentFileProgressCalculated)), // Cap at 100
                  'uploading',
                  `Chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)`,
                  fileId,
                  totalChunks,
                  // Do not add chunkIndex to uploadedChunks here, only on successful completion
                  filesProgress[fileName]?.uploadedChunks
                );
              }
            },
            signal: controller.signal,
            timeout: 30 * 60 * 1000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          });

          // Chunk successfully uploaded, remove its controller from the map
          activeChunkAbortControllersRef.current.delete(chunkIndex);

          // Update the file's uploadedChunks list
          setFilesProgress(prev => {
            const currentFileEntry = prev[fileName];
            const updatedUploadedChunks = currentFileEntry?.uploadedChunks
              ? [...currentFileEntry.uploadedChunks, chunkIndex]
              : [chunkIndex];
            const uniqueUploadedChunks = Array.from(new Set(updatedUploadedChunks)).sort((a, b) => a - b);
            const newProgress = Math.round((uniqueUploadedChunks.length / totalChunks) * 100);

            return {
              ...prev,
              [fileName]: {
                ...currentFileEntry,
                uploadedChunks: uniqueUploadedChunks,
                progress: newProgress,
                message: `Chunk ${chunkIndex + 1} completed.`
              }
            };
          });

          return response.data;
        } catch (error) {
          if (axios.isCancel(error)) {
            // Request was intentionally cancelled (e.g., by pause or unmount)
            throw error; // Re-throw to exit the loop/function gracefully
          }

          if (retryCount === maxRetries) {
            console.error(`Max retries exceeded for chunk ${chunkIndex}.`, error);
            throw error;
          }

          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000;
          console.warn(`Chunk ${chunkIndex} upload failed, retrying in ${delay / 1000}ms (attempt ${retryCount}/${maxRetries})...`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      throw new Error('Upload process interrupted or max retries exceeded for chunk.');
    },
    [isPaused, isMountedRef, updateProgress, chunkSize, chunkStorageMethod, filesProgress] // Added filesProgress as a dependency
  );


  // --- Effects ---

  // Load previous uploads on component mount
  useEffect(() => {
    const savedUploads = localStorage.getItem('chunkedUploads');
    if (savedUploads) {
      try {
        const parsed = JSON.parse(savedUploads);
        setFilesProgress(parsed);

        // Find any paused uploads to set initial state for selected file
        const pausedUpload = Object.values(parsed).find(
          (file: any) => file.status === 'paused'
        ) as FileProgress | undefined;

        if (pausedUpload) {
          // If a paused upload exists, pre-select it
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
          setCurrentFileStatusMessage(`Found paused upload for '${pausedUpload.name}'. Click Resume to continue.`);
        }
      } catch (error) {
        console.error('Failed to parse saved uploads', error);
      }
    }

    return () => {
      isMountedRef.current = false;
      // Abort any remaining active requests on unmount
      activeChunkAbortControllersRef.current.forEach(controller => controller.abort('Component unmounted'));
      activeChunkAbortControllersRef.current.clear();
    };
  }, []);

  // Save upload progress to localStorage whenever filesProgress changes
  useEffect(() => {
    localStorage.setItem('chunkedUploads', JSON.stringify(filesProgress));
  }, [filesProgress]);

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setChunkedFile(file);

      // Check if this file has existing progress in state
      const existingProgress = filesProgress[file.name];
      if (existingProgress && existingProgress.status === 'paused' && existingProgress.fileId) {
        setCurrentFileId(existingProgress.fileId);
        setChunkSize(existingProgress.chunkSize || 5 * 1024 * 1024);
        setChunkStorageMethod(existingProgress.storageMethod || 'disk');
        setIsPaused(true);
        setIsUploading(false);
        setCurrentFileStatusMessage(`Selected previously paused file '${file.name}'. Click Resume to continue.`);
      } else {
        setCurrentFileId(''); // Reset for a new file or non-resumable state
        setIsPaused(false);
        setIsUploading(false);
        setCurrentFileStatusMessage(null);
        // Also ensure the input is clear if a new file is selected, effectively resetting for that file
        // This is important if you choose a file, cancel, then pick it again.
        updateProgress(file.name, 0, 'pending', 'Ready to upload.', '', 0, []);
      }
    }
  };

  const handleChunkedUpload = useCallback(async () => {
    if (!chunkedFile) return;

    setIsUploading(true);
    setIsPaused(false); // Ensure isPaused is false when starting/resuming

    const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
    const chunkUploadEndpoint = chunkStorageMethod === 'disk'
      ? `${API_BASE_URL}/upload`
      : `${API_BASE_URL}/upload-memory`;

    let fileId = currentFileId; // Start with existing ID if available

    try {
      // 1. Determine if resuming or starting new
      if (!fileId) {
        // Check if backend has a record of this file (e.g., from an aborted session not in localStorage)
        const existingProgressOnBackend = await checkUploadStatus(filesProgress[chunkedFile.name]?.fileId || '');
        if (existingProgressOnBackend.exists &&
            existingProgressOnBackend.fileName === chunkedFile.name &&
            existingProgressOnBackend.fileSize === chunkedFile.size) {
            fileId = existingProgressOnBackend.fileId!;
            console.log(`Backend found existing session for '${chunkedFile.name}' with ID: ${fileId}`);
        }
      }

      if (!fileId) {
        // Start a brand new upload session
        const startResponse = await axios.post<ChunkUploadResponse>(`${API_BASE_URL}/start`, {
          fileName: chunkedFile.name,
          fileSize: chunkedFile.size,
          totalChunks,
          storageMethod: chunkStorageMethod
        });
        fileId = startResponse.data.fileId;
        console.log(`Started new upload session with fileId: ${fileId}`);
      }

      setCurrentFileId(fileId); // Update currentFileId state
      updateProgress(
        chunkedFile.name,
        0,
        'uploading',
        'Preparing upload...',
        fileId,
        totalChunks,
        [] // Start with empty uploadedChunks for initial update
      );

      // 2. Get server status for already uploaded chunks
      const serverStatus = await checkUploadStatus(fileId);
      let uploadedChunksFromServer = serverStatus.uploadedChunks || [];
      if (serverStatus.exists && serverStatus.totalChunks !== totalChunks) {
          // Mismatch in totalChunks, potentially an old or corrupt session. Decide how to handle.
          // For now, let's assume it's an error and restart or notify.
          throw new Error('Total chunks mismatch with server. Starting new session or error.');
      }

      // Merge client-side known uploaded chunks (from localStorage) with server-side known chunks
      const clientKnownUploadedChunks = filesProgress[chunkedFile.name]?.uploadedChunks || [];
      const combinedUploadedChunks = Array.from(new Set([...uploadedChunksFromServer, ...clientKnownUploadedChunks])).sort((a,b) => a-b);


      // Update progress based on combined uploaded chunks
      const initialProgress = (combinedUploadedChunks.length / totalChunks) * 100;
      updateProgress(
        chunkedFile.name,
        initialProgress,
        'uploading',
        `Resuming from ${initialProgress.toFixed(0)}% (${combinedUploadedChunks.length}/${totalChunks} chunks)...`,
        fileId,
        totalChunks,
        combinedUploadedChunks
      );

      // 3. Prepare chunks to upload
      const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !combinedUploadedChunks.includes(i));

      console.log(`Chunks remaining to upload: ${chunksToUpload.length}`);

      // 4. Implement Concurrency Control
      const concurrencyLimit = 3; // Number of concurrent chunk uploads
      const uploadQueue = [...chunksToUpload];
      const activeUploadPromises: Promise<ChunkUploadResponse>[] = [];

      const processNextChunk = async () => {
        if (!isMountedRef.current || isPaused) {
          // Stop processing if component unmounted or paused
          return;
        }

        if (uploadQueue.length === 0 && activeUploadPromises.length === 0) {
          // All chunks are either processed or in flight, and no more in queue
          return;
        }

        while (uploadQueue.length > 0 && activeUploadPromises.length < concurrencyLimit && !isPaused && isMountedRef.current) {
          const chunkIndex = uploadQueue.shift() as number; // Safe because we check length
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
          ).catch(error => {
            if (axios.isCancel(error) || error.message === 'Upload paused') {
              console.log(`Chunk ${chunkIndex} upload cancelled/paused.`);
              // Do not re-add to queue, just don't re-throw to stop higher-level flow
            } else {
              console.error(`Unhandled error for chunk ${chunkIndex}:`, error);
              updateProgress(chunkedFile.name, filesProgress[chunkedFile.name]?.progress || 0, 'error', `Chunk ${chunkIndex} failed.`, fileId);
              // You might want to re-add to queue or handle critical error
            }
            return null; // Return null on error to indicate it didn't complete successfully
          });
          activeUploadPromises.push(uploadPromise as Promise<ChunkUploadResponse>); // Add to active promises
        }

        // Wait for any of the active uploads to complete, then try to process next
        if (activeUploadPromises.length > 0) {
            await Promise.race(activeUploadPromises.map(p => p.catch(() => null))); // Race but ignore rejections
            // Filter out completed/failed promises and then recursively call to process more
            const completedOrFailed = await Promise.all(activeUploadPromises.map(p => Promise.resolve(p).then(res => ({res, p})).catch(err => ({err, p}))));
            activeUploadPromises.splice(0, activeUploadPromises.length, ...completedOrFailed.filter(item => {
                if (item.res) return false; // Completed
                if (axios.isCancel(item.err) || item.err.message === 'Upload paused') return false; // Cancelled/paused
                return true; // Still active or truly failed
            }).map(item => item.p));

            // Small delay to prevent tight loop if all promises fail quickly
            await new Promise(resolve => setTimeout(resolve, 50));

            // Continue processing the queue
            await processNextChunk();
        }
      };

      await processNextChunk(); // Start the concurrent upload process


      // 5. Finalize upload if not paused and all chunks are uploaded
      // Re-check server status to be sure
      const finalServerStatus = await checkUploadStatus(fileId);
      if (!isPaused && isMountedRef.current && finalServerStatus.uploadedChunks?.length === totalChunks) {
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
            totalChunks,
            Array.from({ length: totalChunks }, (_, i) => i) // Mark all as uploaded
          );
          setCurrentFileStatusMessage('Upload completed successfully!');
          // Clear selected file after successful upload
          resetUploadState();
        } else {
          throw new Error('Upload incomplete after finalization. Missing final path.');
        }
      } else if (isPaused) {
        setCurrentFileStatusMessage('Upload paused. Ready to resume.');
      } else if (!isMountedRef.current) {
        setCurrentFileStatusMessage('Upload interrupted due to component unmount.');
      } else {
         // This else block catches cases where the loop finished but not all chunks were uploaded
         // (e.g., due to an error, or a chunk was skipped without proper handling)
         console.warn("Upload loop completed, but not all chunks were reported as uploaded. Final status:", finalServerStatus);
         setCurrentFileStatusMessage('Upload process ended, but not all chunks completed. Check network/server or retry.');
         updateProgress(
           chunkedFile.name,
           finalServerStatus.uploadedChunks?.length ? (finalServerStatus.uploadedChunks.length / totalChunks) * 100 : 0,
           'error',
           'Upload incomplete or interrupted.',
           fileId
         );
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        if (axios.isCancel(error) || error.message === 'Upload paused' || error.message.includes('Component unmounted')) {
          console.log('Upload process intentionally stopped/cancelled/paused.');
          setCurrentFileStatusMessage('Upload paused by user.');
          // Ensure file status is 'paused' in state if it was a pause action
          if (isPaused) {
              updateProgress(
                  chunkedFile.name,
                  filesProgress[chunkedFile.name]?.progress || 0,
                  'paused',
                  'Upload paused.',
                  currentFileId
              );
          }
        } else {
          console.error('Chunked upload critical error:', error);
          const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
          updateProgress(
            chunkedFile.name,
            filesProgress[chunkedFile.name]?.progress || 0,
            'error',
            `Upload failed: ${errorMessage}`,
            currentFileId
          );
          setCurrentFileStatusMessage(`Upload failed: ${errorMessage}`);
        }
        setIsUploading(false); // Stop uploading state
      }
    }
  }, [
    chunkedFile,
    chunkSize,
    chunkStorageMethod,
    currentFileId,
    isPaused, // Depend on isPaused to react to changes
    isMountedRef,
    updateProgress,
    checkUploadStatus,
    filesProgress, // Depend on filesProgress for correct initial uploaded chunks
    uploadChunkWithRetry // Depend on memoized function
  ]);


  const pauseUpload = useCallback(() => {
    setIsPaused(true);
    setIsUploading(false); // Visually stop uploading

    // Abort all active requests immediately
    activeChunkAbortControllersRef.current.forEach(controller => {
      controller.abort('Upload paused by user');
    });
    activeChunkAbortControllersRef.current.clear(); // Clear the map

    if (chunkedFile) {
      updateProgress(
        chunkedFile.name,
        filesProgress[chunkedFile.name]?.progress || 0,
        'paused',
        'Upload paused - you can resume later',
        currentFileId
      );
      setCurrentFileStatusMessage('Upload paused.');
    }
  }, [chunkedFile, currentFileId, filesProgress, updateProgress]);

  const resumeUpload = useCallback(async () => {
    if (!chunkedFile || !currentFileId) {
      setCurrentFileStatusMessage("No file or upload ID available to resume.");
      return;
    }

    try {
      console.log(`Attempting to resume upload for file ID: ${currentFileId}`);

      const status = await checkUploadStatus(currentFileId);
      console.log("Upload status response for resume:", status);

      if (!status.exists) {
        throw new Error('Upload session expired or not found on server.');
      }

      // Crucial: Verify the file matches the one being resumed
      if (status.fileName !== chunkedFile.name || status.fileSize !== chunkedFile.size) {
        console.error("File mismatch detected. Cannot resume upload.");
        setCurrentFileStatusMessage("File has changed! Please select the original file to resume.");
        throw new Error('File has changed - please select the original file');
      }

      setIsPaused(false); // Unpause
      setIsUploading(true); // Start uploading visuals
      setCurrentFileStatusMessage('Resuming upload...');
      console.log("Resuming upload...");

      // Call handleChunkedUpload, which will pick up from the existing status
      await handleChunkedUpload();
    } catch (error) {
      console.error('Resume failed:', error);
      if (chunkedFile) {
        updateProgress(
          chunkedFile.name,
          filesProgress[chunkedFile.name]?.progress || 0,
          'error',
          'Resume failed - ' + (error as Error).message,
          currentFileId
        );
      }
      setCurrentFileStatusMessage('Resume failed: ' + (error as Error).message);
      setIsUploading(false);
    }
  }, [chunkedFile, currentFileId, checkUploadStatus, handleChunkedUpload, filesProgress, updateProgress]);

  const cancelUpload = useCallback(() => {
    setIsUploading(false);
    setIsPaused(false);
    setCurrentFileStatusMessage('Upload cancelled.');

    // Abort all active requests immediately
    activeChunkAbortControllersRef.current.forEach(controller => {
      controller.abort('Upload cancelled by user');
    });
    activeChunkAbortControllersRef.current.clear(); // Clear the map

    if (chunkedFile) {
      updateProgress(
        chunkedFile.name,
        0, // Reset progress
        'error', // Indicate cancelled status
        'Upload cancelled',
        currentFileId
      );
    }
    // Clean up current selection
    resetUploadState();
  }, [chunkedFile, currentFileId, updateProgress]);

  const resetUploadState = useCallback(() => {
    setChunkedFile(null);
    setCurrentFileId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input field
    }
  }, []);

  // --- Render Logic ---

  return (
    <div className="chunked-uploader">
      <h2>Chunked File Upload with Pause/Resume</h2>

      <div className="upload-controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          // Disable file input only when an upload is truly active (not just paused)
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
              disabled={isUploading}
            />
          </label>

          <label>
            Storage Method:
            <select
              value={chunkStorageMethod}
              onChange={(e) => setChunkStorageMethod(e.target.value as 'disk' | 'memory')}
              disabled={isUploading}
            >
              <option value="disk">Disk Storage</option>
              <option value="memory">Memory Storage</option>
            </select>
          </label>
        </div>

        {/* Action Buttons */}
        {!isUploading && !isPaused ? (
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
            disabled={!chunkedFile || !currentFileId} // Can only resume if a file and its ID are selected
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

        {(isUploading || isPaused) && ( // Show Cancel button if uploading or paused
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
          <h3>Currently Selected File: {chunkedFile.name}</h3>
          <p>Size: {(chunkedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
          <p>Estimated Chunks: {Math.ceil(chunkedFile.size / chunkSize)}</p>
          <p>Storage Method: {chunkStorageMethod}</p>
          {currentFileId && (
            <p>Current Upload ID: {currentFileId}</p>
          )}
        </div>
      )}

      {/* --- Overall Site Progress --- */}
      <div className="overall-progress">
        <h3>Overall Site Progress (All Uploads)</h3>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${overallSiteProgress}%` }}
          />
          <span className="progress-percent">{overallSiteProgress.toFixed(0)}%</span>
        </div>
      </div>

      {/* --- Individual File Progress List --- */}
      <div className="progress-container">
        <h3>Individual File Progress</h3>
        {Object.values(filesProgress)
          .sort((a, b) => {
            // Sort to show uploading/paused files first
            const statusOrder = { 'uploading': 1, 'paused': 2, 'pending': 3, 'error': 4, 'completed': 5 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
          })
          .map((fileProgress) => (
            <div key={fileProgress.name} className={`progress-item ${fileProgress.status}`}>
              <div className="file-info">
                <span className="file-name">{fileProgress.name}</span>
                <span className="file-status">({fileProgress.status}): {fileProgress.message}</span>
                {/* Button to select a paused file from the list to make it the "current" file for resume */}
                {fileProgress.status === 'paused' && fileProgress.fileId && fileProgress.name !== chunkedFile?.name && (
                  <button
                    onClick={() => {
                      const dummyFile = new File([], fileProgress.name || '', {
                        type: 'application/octet-stream',
                        lastModified: Date.now()
                      });
                      Object.defineProperty(dummyFile, 'size', { value: fileProgress.fileSize || 0 });

                      setChunkedFile(dummyFile);
                      setCurrentFileId(fileProgress.fileId || '');
                      setChunkSize(fileProgress.chunkSize || 5 * 1024 * 1024);
                      setChunkStorageMethod(fileProgress.storageMethod || 'disk');
                      setIsPaused(true);
                      setIsUploading(false);
                      setCurrentFileStatusMessage(`Selected '${fileProgress.name}' for resume. Click Resume Upload.`);
                      // Visually update the file input too
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''; // Cannot programmatically set file, but clear for clarity
                      }
                    }}
                    className="resume-file-button"
                  >
                    Select to Resume
                  </button>
                )}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${fileProgress.progress}%` }}
                />
                <span className="progress-percent">{fileProgress.progress.toFixed(0)}%</span>
              </div>
            </div>
          ))}
      </div>

      {currentFileStatusMessage && <div className="status-message">{currentFileStatusMessage}</div>}

      <div className="upload-instructions">
        <h3>How to resume uploads:</h3>
        <ol>
          <li>**Pause** an ongoing upload using the "Pause Upload" button.</li>
          <li>You can **refresh the page**; the saved progress will load automatically into the list.</li>
          <li>To resume a specific file, ensure it's displayed as "Currently Selected File". If not, click "Select to Resume" next to your desired file in the "Individual File Progress" list.</li>
          <li>Click the **"Resume Upload"** button.</li>
        </ol>
        <p>
          **Important:** For a successful resume, you should preferably use the **exact same file** you started uploading originally. The system verifies file name and size.
        </p>
      </div>
    </div>
  );
};

export default ChunkedUploader;