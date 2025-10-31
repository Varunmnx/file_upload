import React, { useState, useRef } from 'react';
import useChunkedUpload from './hooks/useChunkedUpload';
import { UploadStatus } from '../../types/upload.types';

const FileUploadV3 = () => {
  const { 
    isUploading, 
    isPaused, 
    progress, 
    error, 
    uploadId, 
    status,
    initializeUpload,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    getUploadStatus,
    completeUpload
  } = useChunkedUpload({ chunkSize: 5 * 1024 * 1024 }); // 5MB chunks

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentStatus, setCurrentStatus] = useState<UploadStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // File validation
      if (file.size === 0) {
        alert('File is empty');
        return;
      }
      
      // You can add more validations here (file type, max size, etc.)
      // For example, to check maximum file size (e.g. 100MB):
      // if (file.size > 100 * 1024 * 1024) {
      //   alert('File size exceeds 100MB limit');
      //   return;
      // }
      
      setSelectedFile(file);
      
      // Reset state
      setCurrentStatus(null);
      
      // Initialize the upload
      initializeUpload(file)
        .then(uploadId => {
          console.log('Upload initialized with ID:', uploadId);
        })
        .catch(err => {
          console.error('Error initializing upload:', err);
          // The error is already handled in the hook
        });
    }
  };

  const handleStartUpload = () => {
    if (selectedFile && uploadId) {
      console.log("uploading")
      startUpload();
    }
  };

  const handlePauseUpload = () => {
    pauseUpload();
  };

  const handleResumeUpload = () => {
    resumeUpload();
  };

  const handleCancelUpload = () => {
    cancelUpload();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setSelectedFile(null);
  };

  const handleCheckStatus = async () => {
    if (uploadId) {
      setIsCheckingStatus(true);
      try {
        const status = await getUploadStatus();
        if (status) {
          setCurrentStatus(status as UploadStatus);
        }
      } catch (err) {
        console.error('Error getting upload status:', err);
      } finally {
        setIsCheckingStatus(false);
      }
    }
  };

  const handleCompleteUpload = async () => {
    if (uploadId) {
      try {
        await completeUpload();
        // Refresh status after completion
        setTimeout(() => {
          handleCheckStatus();
        }, 1000);
      } catch (err) {
        console.error('Error completing upload:', err);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Chunked File Upload</h1>
      
      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select File to Upload
        </label>
        <div className="flex items-center">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            disabled={status === 'uploading' || status === 'initiating'}
          />
        </div>
        
        {selectedFile && (
          <div className="mt-2 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Selected file:</span> {selectedFile.name}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Size:</span> {formatFileSize(selectedFile.size)}
            </p>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          {status === 'idle' && uploadId && (
            <button
              onClick={handleStartUpload}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              disabled={!selectedFile || !uploadId || status !== 'idle'}
            >
              Start Upload
            </button>
          )}
          
          {status === 'uploading' && !isPaused && (
            <button
              onClick={handlePauseUpload}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Pause
            </button>
          )}
          
          {status === 'paused' && (
            <button
              onClick={handleResumeUpload}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Resume
            </button>
          )}
          
          {(status === 'uploading' || status === 'paused') && (
            <button
              onClick={handleCancelUpload}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Cancel
            </button>
          )}
          
          {status === 'completed' && (
            <button
              onClick={handleCompleteUpload}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? 'Processing...' : 'Complete Upload'}
            </button>
          )}
          
          {uploadId && (
            <button
              onClick={handleCheckStatus}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              disabled={isCheckingStatus}
            >
              {isCheckingStatus ? 'Loading...' : 'Check Status'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress: {progress.percentage.toFixed(2)}%</span>
            <span>{progress.loaded} / {progress.total} chunks</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status Information */}
      {currentStatus && (
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium text-gray-800 mb-2">Upload Status</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li><span className="font-medium">Upload ID:</span> {currentStatus.uploadId}</li>
            <li><span className="font-medium">File:</span> {currentStatus.fileName}</li>
            <li><span className="font-medium">Size:</span> {formatFileSize(currentStatus.fileSize)}</li>
            <li><span className="font-medium">Total Chunks:</span> {currentStatus.totalChunks}</li>
            <li><span className="font-medium">Uploaded Chunks:</span> {currentStatus.uploadedChunks.length}</li>
            <li><span className="font-medium">Progress:</span> {currentStatus.progress.toFixed(2)}%</li>
            <li><span className="font-medium">Status:</span> {currentStatus.isComplete ? 'Completed' : 'In Progress'}</li>
          </ul>
        </div>
      )}

      {/* Upload Status Display */}
      <div className="mb-4">
        <p className="text-sm">
          <span className="font-medium">Upload Status:</span> 
          <span className={`ml-2 px-2 py-1 rounded text-xs ${
            status === 'idle' ? 'bg-gray-200 text-gray-800' :
            status === 'initiating' ? 'bg-yellow-200 text-yellow-800' :
            status === 'uploading' ? 'bg-blue-200 text-blue-800' :
            status === 'paused' ? 'bg-orange-200 text-orange-800' :
            status === 'completed' ? 'bg-green-200 text-green-800' :
            status === 'cancelled' ? 'bg-red-200 text-red-800' :
            status === 'error' ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-800'
          }`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </p>
        
        {isUploading && (
          <p className="text-sm text-gray-600">
            {isPaused ? 'Upload is paused' : 'Upload in progress...'}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Status Indicator */}
      {uploadId && !currentStatus && (
        <div className="text-sm text-gray-500">
          Upload initialized. Upload ID: {uploadId}
        </div>
      )}
    </div>
  );
};

export default FileUploadV3