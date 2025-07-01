import React, { useState, useRef, useEffect } from 'react';
import axios, { AxiosProgressEvent, AxiosResponse } from 'axios';
import { Upload, File, FileText, Image, User, Trash2, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/upload';

// Types
interface FileUploadResponse {
  message: string;
  file?: File;
  files?: File[];
  uploadedFiles?: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    destination: string;
    filename: string;
    path: string;
    size: number;
  }[];
  totalSize?: number;
}

interface ChunkUploadResponse {
  message: string;
  fileId: string;
  chunkIndex?: number;
  fileName?: string;
  progress?: number;
  remainingChunks?: number;
  finalPath?: string;
  totalSize?: number;
  status?: 'completed' | 'in_progress' | 'expired';
  uploadedChunks?: Array<{ index: number; timestamp: string }>;
  error?: string;
}

interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'paused';
  message?: string;
}

const FileUploadApp: React.FC = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<'single' | 'multiple' | 'mixed' | 'chunked'>('single');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Check for incomplete uploads on mount
  useEffect(() => {
    const state = getUploadState();
    if (state) {
      updateProgress(
        state.fileName,
        (state.uploadedChunks.length / state.totalChunks) * 100,
        'paused',
        `Previous upload found. ${state.uploadedChunks.length}/${state.totalChunks} chunks completed. Click to resume.`
      );
    }
  }, []);

  // Cleanup upload state on unmount if not completed
  useEffect(() => {
    return () => {
      const state = getUploadState();
      if (state) {
        // Check if the upload is still in progress
        axios.post(`${API_BASE_URL}/chunk/status`, { fileId: state.fileId })
          .then(response => {
            if (response.data.status !== 'completed') {
              clearUploadState();
            }
          })
          .catch(() => {
            clearUploadState();
          });
      }
    };
  }, []);
  
  // Single file upload
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleDescription, setSingleDescription] = useState('');
  const [singleCategory, setSingleCategory] = useState('');
  
  // Multiple files upload
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [multipleDescription, setMultipleDescription] = useState('');
  const [multipleCategory, setMultipleCategory] = useState('');
  
  // Mixed fields upload
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [mixedDescription, setMixedDescription] = useState('');
  
  // Chunked upload
  const [chunkedFile, setChunkedFile] = useState<File | null>(null);
  const [chunkSize] = useState(5 * 1024 * 1024); // 5MB chunks
  const [chunkUploadId, setChunkUploadId] = useState<string>('');
  const [chunkProgress, setChunkProgress] = useState(0);
  const [chunkStatus, setChunkStatus] = useState<ChunkUploadResponse | null>(null);
  const [statusCheckId, setStatusCheckId] = useState<string>('');
  
  interface FileInputRefs {
    single: React.RefObject<HTMLInputElement>;
    multiple: React.RefObject<HTMLInputElement>;
    avatar: React.RefObject<HTMLInputElement>;
    documents: React.RefObject<HTMLInputElement>;
    images: React.RefObject<HTMLInputElement>;
    chunked: React.RefObject<HTMLInputElement>;
  }

  const fileInputRefs: FileInputRefs = {
    single: useRef<HTMLInputElement>(null),
    multiple: useRef<HTMLInputElement>(null),
    avatar: useRef<HTMLInputElement>(null),
    documents: useRef<HTMLInputElement>(null),
    images: useRef<HTMLInputElement>(null),
    chunked: useRef<HTMLInputElement>(null),
  };

  // Utility functions
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  };

  const updateProgress = (fileName: string, progress: number, status: UploadProgress['status'], message?: string): void => {
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

  const clearProgress = (): void => {
    setUploadProgress([]);
  };

  // Chunked upload status check
  const handleChunkStatusCheck = async (): Promise<void> => {
    if (!statusCheckId.trim()) return;
    
    try {
      const response: AxiosResponse<ChunkUploadResponse> = await axios.post(`${API_BASE_URL}/chunk/status`, {
        fileId: statusCheckId,
      });
      
      setChunkStatus(response.data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message :
        axios.isAxiosError(error) ? error.response?.data?.message || error.message :
        'Unknown error';
      console.error('Failed to get upload status:', errorMessage);
      alert('Failed to get upload status. Upload session may not exist.');
      setChunkStatus(null);
    }
  };

  // Single file upload
  const handleSingleFileUpload = async (): Promise<void> => {
    if (!singleFile) return;
    
    setIsUploading(true);
    updateProgress(singleFile.name, 0, 'uploading');
    
    const formData = new FormData();
    formData.append('file', singleFile);
    formData.append('description', singleDescription);
    formData.append('category', singleCategory);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/single`, formData, {
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            updateProgress(singleFile.name, percentComplete, 'uploading');
          }
        },
      });

      updateProgress(singleFile.name, 100, 'completed', response.data.message);
      setSingleFile(null);
      setSingleDescription('');
      setSingleCategory('');
      if (fileInputRefs.single.current) {
        fileInputRefs.single.current.value = '';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message :
        axios.isAxiosError(error) ? error.response?.data?.message || error.message :
        'Unknown error';
      console.error('Single file upload failed:', errorMessage);
      updateProgress(singleFile.name, 0, 'error', `Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Multiple files upload
  const handleMultipleFilesUpload = async (): Promise<void> => {
    if (multipleFiles.length === 0) return;
    
    setIsUploading(true);
    
    // Initialize progress for all files
    multipleFiles.forEach(file => {
      updateProgress(file.name, 0, 'uploading');
    });
    
    const uploadPromises = multipleFiles.map(file => {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('description', multipleDescription);
      formData.append('category', multipleCategory);
      
      return axios.post(`${API_BASE_URL}/multiple-parallel`, formData, {
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            updateProgress(file.name, percentComplete, 'uploading');
          }
        },
      });
    });
    
    try {
      await Promise.all(uploadPromises);
      multipleFiles.forEach(file => {
        updateProgress(file.name, 100, 'completed', 'Processed successfully');
      });
      setMultipleFiles([]);
      setMultipleDescription('');
      setMultipleCategory('');
      if (fileInputRefs.multiple.current) {
        fileInputRefs.multiple.current.value = '';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message :
        axios.isAxiosError(error) ? error.response?.data?.message || error.message :
        'Unknown error';
      console.error('Multiple files upload failed:', errorMessage);
      multipleFiles.forEach(file => {
        updateProgress(file.name, 0, 'error', `Upload failed: ${errorMessage}`);
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Mixed fields upload
  const handleMixedFieldsUpload = async (): Promise<void> => {
    if (!avatarFile && documentFiles.length === 0 && imageFiles.length === 0) return;
    
    setIsUploading(true);
    
    const allFiles = [
      ...(avatarFile ? [avatarFile] : []),
      ...documentFiles,
      ...imageFiles
    ];
    
    allFiles.forEach(file => {
      updateProgress(file.name, 0, 'uploading');
    });
    
    const uploadPromises = allFiles.map(file => {
      const formData = new FormData();
      
      // Determine the field name based on file type
      if (avatarFile && file === avatarFile) {
        formData.append('avatar', file);
      } else if (documentFiles.includes(file)) {
        formData.append('documents', file);
      } else {
        formData.append('images', file);
      }
      
      formData.append('description', mixedDescription);
      
      return axios.post(`${API_BASE_URL}/mixed-fields`, formData, {
        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
          if (progressEvent.total) {
            const percentComplete = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            updateProgress(file.name, percentComplete, 'uploading');
          }
        },
      });
    });
    
    try {
      await Promise.all(uploadPromises);
      allFiles.forEach(file => {
        updateProgress(file.name, 100, 'completed', 'Processed successfully');
      });
      setAvatarFile(null);
      setDocumentFiles([]);
      setImageFiles([]);
      setMixedDescription('');
      Object.values(fileInputRefs).forEach(ref => {
        if (ref.current) ref.current.value = '';
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message :
        axios.isAxiosError(error) ? error.response?.data?.message || error.message :
        'Unknown error';
      console.error('Mixed fields upload failed:', errorMessage);
      allFiles.forEach(file => {
        updateProgress(file.name, 0, 'error', `Upload failed: ${errorMessage}`);
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Chunked upload
  const UPLOAD_STATE_KEY = 'chunked_upload_state';

  interface UploadState {
    fileId: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    uploadedChunks: number[];
  }

  const saveUploadState = (state: UploadState): void => {
    localStorage.setItem(UPLOAD_STATE_KEY, JSON.stringify(state));
  };

  const getUploadState = (): UploadState | null => {
    const state = localStorage.getItem(UPLOAD_STATE_KEY);
    return state ? JSON.parse(state) : null;
  };

  const clearUploadState = (): void => {
    localStorage.removeItem(UPLOAD_STATE_KEY);
  };

  const handleChunkedUpload = async (): Promise<void> => {
    if (!chunkedFile) return;
    
    setIsUploading(true);
    setChunkProgress(0);
    updateProgress(chunkedFile.name, 0, 'uploading');
    
    const totalChunks = Math.ceil(chunkedFile.size / chunkSize);
    const maxRetries = 3;
    
    try {
      // Check for existing upload
      let fileId = '';
      let uploadedChunks: number[] = [];
      
      const savedState = getUploadState();
      if (savedState && 
          savedState.fileName === chunkedFile.name && 
          savedState.fileSize === chunkedFile.size) {
        // Verify the upload session is still valid
        try {
          const statusResponse = await axios.post(`${API_BASE_URL}/chunk/status`, {
            fileId: savedState.fileId
          });
          
          if (statusResponse.data.status !== 'expired') {
            fileId = savedState.fileId;
            uploadedChunks = statusResponse.data.uploadedChunks.map((chunk: any) => chunk.index);
            setChunkProgress((uploadedChunks.length / totalChunks) * 100);
            updateProgress(
              chunkedFile.name,
              (uploadedChunks.length / totalChunks) * 100,
              'uploading',
              `Resuming upload: ${uploadedChunks.length}/${totalChunks} chunks completed`
            );
          }
        } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message :
        axios.isAxiosError(error) ? error.response?.data?.message || error.message :
        'Unknown error';
          console.log('Failed to verify upload session, starting new upload');
        }
      }
      
      if (!fileId) {
        // Start new chunked upload
        const response: AxiosResponse<{ fileId: string }> = await axios.post(`${API_BASE_URL}/chunk/start`, {
          fileName: chunkedFile.name,
          fileSize: chunkedFile.size,
          totalChunks,
        });
        
        fileId = startResponse.data.fileId;
        uploadedChunks = [];
      }
      
      setChunkUploadId(fileId);
      
      // Save initial state
      saveUploadState({
        fileId,
        fileName: chunkedFile.name,
        fileSize: chunkedFile.size,
        totalChunks,
        uploadedChunks
      });
      
      // Upload chunks with retry logic
      const uploadChunk = async (chunkIndex: number, retryCount = 0): Promise<void> => {
        try {
          const start = chunkIndex * chunkSize;
          const end = Math.min(start + chunkSize, chunkedFile.size);
          const chunk = chunkedFile.slice(start, end);
          
          const chunkFormData = new FormData();
          chunkFormData.append('chunk', chunk);
          chunkFormData.append('chunkIndex', chunkIndex.toString());
          chunkFormData.append('totalChunks', totalChunks.toString());
          chunkFormData.append('fileName', chunkedFile.name);
          chunkFormData.append('fileId', fileId);
          
          const response = await axios.post(`${API_BASE_URL}/chunk/upload`, chunkFormData, {
            onUploadProgress: (progressEvent: AxiosProgressEvent) => {
              if (progressEvent.total) {
                const chunkPercent = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                const overallProgress = Math.round(
                  ((chunkIndex * chunkSize + progressEvent.loaded) / chunkedFile.size) * 100
                );
                setChunkProgress(overallProgress);
                updateProgress(
                  chunkedFile.name, 
                  overallProgress, 
                  'uploading', 
                  `Chunk ${chunkIndex + 1}/${totalChunks} (${chunkPercent}%)`
                );
              }
            },
            timeout: 30000, // 30 seconds timeout
          });

          return response.data;
        } catch (error) {
          if (retryCount < maxRetries) {
            // Exponential backoff
            const delay = Math.pow(2, retryCount) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return uploadChunk(chunkIndex, retryCount + 1);
          }
          throw error;
        }
      };

      // Upload all chunks with concurrency control
      const concurrencyLimit = 3;
      const chunks = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !uploadedChunks.includes(i)); // Skip already uploaded chunks
      const results = [];
      
      for (let i = 0; i < chunks.length; i += concurrencyLimit) {
        const batch = chunks.slice(i, i + concurrencyLimit);
        const promises = batch.map(chunkIndex => uploadChunk(chunkIndex));
        
        try {
          const batchResults = await Promise.all(promises);
          results.push(...batchResults);
          
          // Update upload state after each batch
          const newUploadedChunks = [
            ...uploadedChunks,
            ...batch.filter(index => {
              const result = batchResults.find(r => r.chunkIndex === index);
              return result && !result.error;
            })
          ];
          
          saveUploadState({
            fileId,
            fileName: chunkedFile.name,
            fileSize: chunkedFile.size,
            totalChunks,
            uploadedChunks: newUploadedChunks
          });
        } catch (error) {
          console.error(`Failed to upload batch starting at chunk ${i}:`, error);
          throw error;
        }
      }

      // Verify upload completion
      const statusResponse: AxiosResponse<ChunkUploadResponse> = await axios.post(`${API_BASE_URL}/chunk/status`, { fileId });
      
      if (statusResponse.data.status === 'completed' && statusResponse.data.finalPath) {
        updateProgress(chunkedFile.name, 100, 'completed', 'Upload complete');
        setChunkedFile(null);
        setChunkUploadId('');
        setChunkStatus(null);
        clearUploadState();
        if (fileInputRefs.chunked.current) {
          fileInputRefs.chunked.current.value = '';
        }
      } else if (statusResponse.data.missingChunks?.length > 0) {
        throw new Error(`Upload incomplete. Missing chunks: ${statusResponse.data.missingChunks.join(', ')}`);
      }
    } catch (error) {
      console.error('Chunked upload failed:', errorMessage);
      
      // Check if the upload can be resumed
      const state = getUploadState();
      if (state && state.uploadedChunks.length > 0) {
        updateProgress(
          chunkedFile.name,
          (state.uploadedChunks.length / state.totalChunks) * 100,
          'paused',
          `Upload paused. ${state.uploadedChunks.length}/${state.totalChunks} chunks completed. Click to resume.`
        );
      } else {
        updateProgress(
          chunkedFile.name,
          0,
          'error',
          `Upload failed: ${error.response?.data?.message || error.message || 'Unknown error'}`
        );
        clearUploadState();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (fileList: File[], setFileList: React.Dispatch<React.SetStateAction<File[]>>, index: number): void => {
    setFileList(fileList.filter((_, i) => i !== index));
  };

  const ProgressBar: React.FC<{ progress: UploadProgress }> = ({ progress }): JSX.Element => (
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
              File Upload Demo
            </h1>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { key: 'single', label: 'Single File', icon: File },
                { key: 'multiple', label: 'Multiple Files', icon: FileText },
                { key: 'mixed', label: 'Mixed Fields', icon: Image },
                { key: 'chunked', label: 'Chunked Upload', icon: Upload },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-colors ${
                    activeTab === key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Single File Upload */}
            {activeTab === 'single' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Single File Upload</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select File
                    </label>
                    <input
                      ref={fileInputRefs.single}
                      type="file"
                      onChange={(e) => setSingleFile(e.target.files?.[0] || null)}
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {singleFile && (
                      <p className="text-sm text-gray-600 mt-1">
                        {singleFile.name} ({formatFileSize(singleFile.size)})
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={singleDescription}
                        onChange={(e) => setSingleDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional description"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={singleCategory}
                        onChange={(e) => setSingleCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        <option value="images">Images</option>
                        <option value="documents">Documents</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleSingleFileUpload}
                  disabled={!singleFile || isUploading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </button>
              </div>
            )}

            {/* Multiple Files Upload */}
            {activeTab === 'multiple' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Multiple Files Upload</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Files (Max 10)
                    </label>
                    <input
                      ref={fileInputRefs.multiple}
                      type="file"
                      multiple
                      onChange={(e) => setMultipleFiles(Array.from(e.target.files || []))}
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    
                    {multipleFiles.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">Selected Files:</h4>
                        {multipleFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-600 truncate">
                              {file.name} ({formatFileSize(file.size)})
                            </span>
                            <button
                              onClick={() => removeFile(multipleFiles, setMultipleFiles, index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={multipleDescription}
                        onChange={(e) => setMultipleDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional description"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category
                      </label>
                      <select
                        value={multipleCategory}
                        onChange={(e) => setMultipleCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        <option value="images">Images</option>
                        <option value="documents">Documents</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleMultipleFilesUpload}
                  disabled={multipleFiles.length === 0 || isUploading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Upload {multipleFiles.length} Files
                </button>
              </div>
            )}

            {/* Mixed Fields Upload */}
            {activeTab === 'mixed' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Mixed Fields Upload</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      Avatar (1 file)
                    </label>
                    <input
                      ref={fileInputRefs.avatar}
                      type="file"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                      accept=".jpg,.jpeg,.png,.gif"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    {avatarFile && (
                      <p className="text-sm text-gray-600 mt-1">
                        {avatarFile.name}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Documents (Max 5)
                    </label>
                    <input
                      ref={fileInputRefs.documents}
                      type="file"
                      multiple
                      onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                      accept=".pdf,.doc,.docx"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                    />
                    {documentFiles.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {documentFiles.length} document(s) selected
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Image className="w-4 h-4 inline mr-1" />
                      Images (Max 10)
                    </label>
                    <input
                      ref={fileInputRefs.images}
                      type="file"
                      multiple
                      onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                      accept=".jpg,.jpeg,.png,.gif"
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                    />
                    {imageFiles.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {imageFiles.length} image(s) selected
                      </p>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={mixedDescription}
                    onChange={(e) => setMixedDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>
                
                <button
                  onClick={handleMixedFieldsUpload}
                  disabled={(!avatarFile && documentFiles.length === 0 && imageFiles.length === 0) || isUploading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Mixed Fields
                </button>
              </div>
            )}

            {/* Chunked Upload */}
            {activeTab === 'chunked' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-800">Chunked Upload (Large Files)</h2>
                <p className="text-sm text-gray-600">
                  For large files, uploads are split into {formatFileSize(chunkSize)} chunks for better reliability.
                </p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Large File
                  </label>
                  <input
                    ref={fileInputRefs.chunked}
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
                
                {/* Chunk Status Check Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">Check Upload Status</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter your upload ID to check the status of an ongoing or completed chunked upload.
                  </p>
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
                          <span className="ml-2 text-gray-800">{chunkStatus.fileName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">File Size:</span>
                          <span className="ml-2 text-gray-800">{formatFileSize(chunkStatus.totalSize || 0)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Chunks Received:</span>
                          <span className="ml-2 text-gray-800">
                            {chunkStatus.totalChunks - (chunkStatus.remainingChunks || 0)}/{chunkStatus.totalChunks}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Status:</span>
                          <span className="ml-2 text-gray-800">
                            {chunkStatus.finalPath ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                        {chunkStatus.finalPath && (
                          <div className="col-span-2">
                            <span className="text-gray-600">Final Path:</span>
                            <span className="ml-2 text-gray-800 break-all">{chunkStatus.finalPath}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleChunkedUpload}
                  disabled={!chunkedFile || isUploading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Start Chunked Upload
                </button>
              </div>
            )}

            {/* Upload Progress Section */}
            {uploadProgress.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-800">Upload Progress</h3>
                  <button
                    onClick={clearProgress}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Clear All
                  </button>
                </div>
                
                <div className="space-y-3">
                  {uploadProgress.map((progress, index) => (
                    <ProgressBar key={index} progress={progress} />
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

export default FileUploadApp;