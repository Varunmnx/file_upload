import React, { useState, useRef } from 'react';
import { Upload, Trash2, CheckCircle, AlertCircle, RotateCcw, HardDrive, MemoryStick } from 'lucide-react';

// Simulated API functions (replace with your actual API calls)
const mockApi = {
  startChunkedUpload: async (p0: { fileName: string; fileSize: number; totalChunks: number; storageMethod: "disk" | "memory"; }) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: { fileId: `upload_${Date.now()}`, message: 'Upload session started' } };
  },
  
  uploadChunk: async (formData: FormData) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      throw new Error(`Network error uploading chunk ${chunkIndex + 1}`);
    }
    
    return {
      data: {
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
        progress: ((chunkIndex + 1) / totalChunks) * 100,
        remainingChunks: totalChunks - (chunkIndex + 1)
      }
    };
  },
  
  finalizeUpload: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      data: {
        finalPath: `/uploads/${data.fileName}`,
        message: 'Upload completed successfully',
        totalSize: 1024 * 1024 * 50 // 50MB example
      }
    };
  },
  
  checkStatus: async (p0: { fileId: string; }) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      data: {
        fileName: 'example-file.zip',
        totalSize: 1024 * 1024 * 50,
        progress: 75,
        remainingChunks: 5,
        totalChunks: 20,
        message: 'Upload in progress'
      }
    };
  }
};

interface ChunkUploadResponse {
  message: string;
  fileId: string;
  progress?: number;
  remainingChunks?: number;
  finalPath?: string;
  totalSize?: number;
  fileName?: string;
  totalChunks?: number;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  message?: string;
}

const FixedChunkedUpload: React.FC = () => {
  const [chunkedFile, setChunkedFile] = useState<File | null>(null);
  const [chunkSize] = useState(2 * 1024 * 1024); // 2MB chunks for demo
  const [chunkUploadId, setChunkUploadId] = useState<string>('');
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState<ChunkUploadResponse | null>(null);
  const [statusCheckId, setStatusCheckId] = useState<string>('');
  const [chunkStorageMethod, setChunkStorageMethod] = useState<'disk' | 'memory'>('disk');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const addDebugLog = (message: string) => {
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const updateProgress = (fileName: string, progress: number, status: UploadProgress['status'], message?: string) => {
    setUploadProgress(prev => {
      const existing = prev.find(p => p.fileName === fileName);
      if (existing) {
        return prev.map(p =>
          p.fileName === fileName
            ? { ...p, progress, status, message }
            : p
        );
      }
      return [...prev, { fileName, progress, status, message }];
    });
  };

  const clearProgress = () => {
    setUploadProgress([]);
    setDebugLog([]);
  };

  // Fixed chunked upload function
  const handleChunkedUpload = async () => {
    if (!chunkedFile) {
      addDebugLog('❌ No file selected');
      return;
    }

    setIsUploading(true);
    setChunkProgress(0);
    setDebugLog([]);
    
    addDebugLog(`🚀 Starting chunked upload for: ${chunkedFile.name}`);
    addDebugLog(`📊 File size: ${formatFileSize(chunkedFile.size)}`);
    
    updateProgress(chunkedFile.name, 0, 'uploading');

    const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
    const maxRetries = 3;
    
    addDebugLog(`🔢 Total chunks to upload: ${totalChunks}`);
    addDebugLog(`💾 Storage method: ${chunkStorageMethod}`);

    try {
      // Start chunked upload session
      addDebugLog('📡 Starting upload session...');
      const startResponse = await mockApi.startChunkedUpload({
        fileName: chunkedFile.name,
        fileSize: chunkedFile.size,
        totalChunks,
        storageMethod: chunkStorageMethod
      });

      const fileId = startResponse.data.fileId;
      setChunkUploadId(fileId);
      addDebugLog(`✅ Upload session started with ID: ${fileId}`);

      // Track failed chunks for retry
      const failedChunks = new Set<number>();
      
      // Upload chunks function with better error handling
      const uploadChunk = async (chunkIndex: number, retryCount = 0): Promise<void> => {
        try {
          addDebugLog(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (attempt ${retryCount + 1})`);
          
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, chunkedFile.size);
          const chunk = chunkedFile.slice(start, end);

          const chunkFormData = new FormData();
          chunkFormData.append('chunk', chunk);
          chunkFormData.append('chunkIndex', chunkIndex.toString());
          chunkFormData.append('totalChunks', totalChunks.toString());
          chunkFormData.append('fileName', chunkedFile.name);
          chunkFormData.append('fileId', fileId);
          chunkFormData.append('storageMethod', chunkStorageMethod);

          await mockApi.uploadChunk(chunkFormData);
          
          // Update progress
          const overallProgress = Math.round(((chunkIndex + 1) / totalChunks) * 100);
          setChunkProgress(overallProgress);
          updateProgress(
            chunkedFile.name,
            overallProgress,
            'uploading',
            `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`
          );
          
          addDebugLog(`✅ Chunk ${chunkIndex + 1} uploaded successfully`);
          failedChunks.delete(chunkIndex); // Remove from failed set if it was there
          
        } catch (error: any) {
          addDebugLog(`❌ Chunk ${chunkIndex + 1} failed: ${error.message}`);
          failedChunks.add(chunkIndex);
          
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            addDebugLog(`⏳ Retrying chunk ${chunkIndex + 1} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return uploadChunk(chunkIndex, retryCount + 1);
          } else {
            addDebugLog(`💀 Chunk ${chunkIndex + 1} failed after ${maxRetries} retries`);
            throw error;
          }
        }
      };

      // Sequential upload (safer for demo, you can make it concurrent)
      addDebugLog('🔄 Starting sequential chunk upload...');
      for (let i = 0; i < totalChunks; i++) {
        await uploadChunk(i);
      }

      // Check if any chunks failed
      if (failedChunks.size > 0) {
        throw new Error(`Failed to upload ${failedChunks.size} chunks: [${Array.from(failedChunks).map(i => i + 1).join(', ')}]`);
      }

      addDebugLog('🏁 All chunks uploaded successfully, finalizing...');
      
      // Finalize the upload
      const finalizeResponse = await mockApi.finalizeUpload({
        fileId: fileId,
        fileName: chunkedFile.name,
        totalChunks: totalChunks,
        storageMethod: chunkStorageMethod
      });

      if (finalizeResponse.data?.finalPath) {
        addDebugLog(`🎉 Upload completed! File saved to: ${finalizeResponse.data.finalPath}`);
        updateProgress(chunkedFile.name, 100, 'completed', 'Upload complete');
        
        // Reset form
        setChunkedFile(null);
        setChunkUploadId('');
        setChunkStatus(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error('Upload incomplete after finalization - no final path received');
      }
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      addDebugLog(`💥 Upload failed: ${errorMessage}`);
      console.error('Chunked upload failed:', error);
      
      updateProgress(
        chunkedFile.name,
        0,
        'error',
        `Upload failed: ${errorMessage}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleChunkStatusCheck = async () => {
    if (!statusCheckId.trim()) {
      addDebugLog('❌ Please enter an upload ID');
      return;
    }

    try {
      addDebugLog(`🔍 Checking status for ID: ${statusCheckId}`);
      const response = await mockApi.checkStatus({
        fileId: statusCheckId,
      });

      setChunkStatus(response.data);
      addDebugLog('✅ Status retrieved successfully');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Upload session may not exist.';
      addDebugLog(`❌ Status check failed: ${errorMessage}`);
      alert(`Failed to get upload status: ${errorMessage}`);
      setChunkStatus(null);
    }
  };

  const ProgressBar: React.FC<{ progress: UploadProgress }> = ({ progress }) => (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 truncate">{progress.fileName}</span>
        <div className="flex items-center space-x-2">
          {progress.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500" />}
          {progress.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          {progress.status === 'uploading' && <RotateCcw className="w-4 h-4 text-blue-500 animate-spin" />}
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            progress.status === 'completed' ? 'bg-green-500' :
            progress.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>
      {progress.message && (
        <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white flex items-center">
              <Upload className="w-6 h-6 mr-2" />
              Fixed Chunked Upload Demo
            </h1>
          </div>

          <div className="p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Chunked Upload (Large Files)</h2>
            <p className="text-sm text-gray-600">
              For large files, uploads are split into {formatFileSize(chunkSize)} chunks for better reliability.
              This demo includes detailed logging and error handling.
            </p>

            {/* Chunk Storage Method Selection */}
            <div className="border p-4 rounded-md bg-gray-50">
              <h3 className="text-md font-medium text-gray-800 mb-2">Chunk Storage Method:</h3>
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-blue-600"
                    name="chunkStorage"
                    value="disk"
                    checked={chunkStorageMethod === 'disk'}
                    onChange={() => setChunkStorageMethod('disk')}
                  />
                  <span className="ml-2 text-gray-700 flex items-center">
                    <HardDrive className="w-4 h-4 mr-1"/> Disk Storage
                  </span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-purple-600"
                    name="chunkStorage"
                    value="memory"
                    checked={chunkStorageMethod === 'memory'}
                    onChange={() => setChunkStorageMethod('memory')}
                  />
                  <span className="ml-2 text-gray-700 flex items-center">
                    <MemoryStick className="w-4 h-4 mr-1"/> Memory Storage
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Large File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setChunkedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {chunkedFile && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>File:</strong> {chunkedFile.name}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Size:</strong> {formatFileSize(chunkedFile.size)}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Chunks:</strong> {Math.ceil(chunkedFile.size / chunkSize)}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleChunkedUpload}
              disabled={!chunkedFile || isUploading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : `Start Chunked Upload (${chunkStorageMethod === 'disk' ? 'Disk' : 'Memory'})`}
            </button>

            {chunkUploadId && (
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-700">
                  Upload ID: {chunkUploadId}
                </p>
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-blue-600 mb-1">
                    <span>Chunked Upload Progress</span>
                    <span>{Math.round(chunkProgress)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${chunkProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Status Check Section */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">Check Upload Status</h3>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={statusCheckId}
                  onChange={(e) => setStatusCheckId(e.target.value)}
                  placeholder="Enter upload ID"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleChunkStatusCheck}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                >
                  Check Status
                </button>
              </div>

              {chunkStatus && (
                <div className="mt-4 bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-800 mb-2">Upload Status</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">File Name:</span>
                      <span className="ml-2 text-gray-800">{chunkStatus.fileName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">File Size:</span>
                      <span className="ml-2 text-gray-800">{formatFileSize(chunkStatus.totalSize || 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Progress:</span>
                      <span className="ml-2 text-gray-800">
                        {chunkStatus.progress !== undefined ? `${Math.round(chunkStatus.progress)}%` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Remaining:</span>
                      <span className="ml-2 text-gray-800">{chunkStatus.remainingChunks || 0} chunks</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Debug Log */}
            {debugLog.length > 0 && (
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">Debug Log</h3>
                  <button
                    onClick={() => setDebugLog([])}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Clear Log
                  </button>
                </div>
                <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-xs max-h-60 overflow-y-auto">
                  {debugLog.map((log, index) => (
                    <div key={index} className="mb-1">{log}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress.length > 0 && (
              <div className="border-t pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">Upload Progress</h2>
                  <button
                    onClick={clearProgress}
                    className="text-red-500 hover:text-red-700 text-sm flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Clear All
                  </button>
                </div>
                <div className="space-y-3">
                  {uploadProgress.map((p, index) => (
                    <ProgressBar key={index} progress={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FixedChunkedUpload;