import { useState, useCallback, useRef } from "react"; 
import useFileUpload from "./useFileUpload";
import useInitiateFileUpload from "./useFileInitiateFileUpload";
import useCompleteUpload from "./useCompleteUpload";
import useFileGetStatus from "./useFileGetStatus";
import { ChunkData, UploadProgress } from "@/types/upload.types";

interface UseChunkedUploadProps {
  chunkSize?: number;
}

export interface ChunkedUploadState {
  isUploading: boolean;
  isPaused: boolean;
  progress: UploadProgress | null;
  error: string | null;
  uploadId: string | null;
  status:
    | "idle"
    | "initiating"
    | "uploading"
    | "completed"
    | "paused"
    | "cancelled"
    | "error";
}

const useChunkedUpload = ({ chunkSize = 5 * 1024 * 1024 }: UseChunkedUploadProps = {}) => {
  const [state, setState] = useState<ChunkedUploadState>({
    isUploading: false,
    isPaused: false,
    progress: null,
    error: null,
    uploadId: null,
    status: "idle",
  });

  // ✅ Real-time refs to avoid React state race-condition
  const statusRef = useRef<ChunkedUploadState["status"]>("idle");
  const pausedRef = useRef(false);

  const fileUploadMutation = useFileUpload();
  const initiateFileUploadMutation = useInitiateFileUpload();
  const completeFileUploadMutation = useCompleteUpload();
  const getFileStatusMutation = useFileGetStatus();

  const currentFileRef = useRef<File | null>(null);
  const chunksQueueRef = useRef<ChunkData[]>([]);
  const uploadedChunksRef = useRef<number[]>([]);
  const totalChunksRef = useRef<number>(0);

  // ✅ Split file into chunks
  const splitFileIntoChunks = useCallback(
    (file: File): ChunkData[] => {
      const chunks: ChunkData[] = [];
      let offset = 0;
      let index = 0;

      while (offset < file.size) {
        const size = Math.min(chunkSize, file.size - offset);
        const blob = file.slice(offset, offset + size);

        chunks.push({ blob, index, size });
        offset += size;
        index++;
      }

      totalChunksRef.current = chunks.length;
      return chunks;
    },
    [chunkSize]
  );

  // ✅ Initialize upload session
  const initializeUpload = useCallback(
    async (file: File) => {
      setState((p) => ({ ...p, status: "initiating", error: null }));
      statusRef.current = "initiating";

      try {
        currentFileRef.current = file;

        const chunks = splitFileIntoChunks(file);
        chunksQueueRef.current = [...chunks];
        uploadedChunksRef.current = [];

        const result = await initiateFileUploadMutation.mutateAsync({
          fileName: file.name,
          fileSize: file.size,
        });

        const uploadId = (result as any)?.uploadId || result?.data?.uploadId;

        setState((p) => ({ ...p, uploadId, status: "idle" }));
        statusRef.current = "idle";

        return uploadId;
      } catch (error: any) {
        setState((p) => ({ ...p, status: "error", error: error.message }));
        statusRef.current = "error";
        throw error;
      }
    },
    [splitFileIntoChunks, initiateFileUploadMutation]
  );

  // ✅ Upload next chunk — main engine
  const uploadNextChunk = useCallback(async () => {
    if (pausedRef.current) return;
    if (statusRef.current !== "uploading") return;

    const queue = chunksQueueRef.current;
    if (queue.length === 0) {
      if (uploadedChunksRef.current.length === totalChunksRef.current) {
        setState((p) => ({ ...p, status: "completed" }));
        statusRef.current = "completed";
      }
      return;
    }

    const chunk = queue.shift();
    if (!chunk) return;

    try {
      const formData = new FormData();
      formData.append("chunk", chunk.blob, currentFileRef.current?.name);
      formData.append("uploadId", state.uploadId!);
      formData.append("chunkIndex", chunk.index.toString());
      formData.append("chunkSize", chunk.size.toString());

      await fileUploadMutation.mutateAsync(formData);

      uploadedChunksRef.current.push(chunk.index);
      uploadedChunksRef.current.sort((a, b) => a - b);

      setState((p) => ({
        ...p,
        progress: {
          loaded: uploadedChunksRef.current.length,
          total: totalChunksRef.current,
          percentage:
            (uploadedChunksRef.current.length / totalChunksRef.current) * 100,
          uploadedChunks: [...uploadedChunksRef.current],
        },
      }));

      // ✅ Continue immediately (no React state wait)
      setTimeout(uploadNextChunk, 0);
    } catch (err) {
      // Retry: put chunk back
      queue.unshift(chunk);

      setState((p) => ({
        ...p,
        status: "error",
        error: err instanceof Error ? err.message : "Chunk upload failed",
      }));
      statusRef.current = "error";
    }
  }, [fileUploadMutation, state.uploadId]);

  // ✅ Start uploading
  const startUpload = useCallback(() => {
    if (!currentFileRef.current || !state.uploadId) {
      setState((p) => ({ ...p, status: "error", error: "Missing file or upload ID" }));
      return;
    }

    pausedRef.current = false;
    statusRef.current = "uploading";

    setState((p) => ({
      ...p,
      status: "uploading",
      isUploading: true,
      isPaused: false,
    }));

    // ✅ FIX: start after state commits
    setTimeout(uploadNextChunk, 0);
  }, [uploadNextChunk, state.uploadId]);

  // ✅ Pause
  const pauseUpload = useCallback(() => {
    pausedRef.current = true;
    statusRef.current = "paused";

    setState((p) => ({ ...p, isPaused: true, status: "paused" }));
  }, []);

  // ✅ Resume
  const resumeUpload = useCallback(() => {
    pausedRef.current = false;
    statusRef.current = "uploading";

    setState((p) => ({ ...p, isPaused: false, status: "uploading" }));
    setTimeout(uploadNextChunk, 0);
  }, [uploadNextChunk]);

  // ✅ Cancel
  const cancelUpload = useCallback(() => {
    pausedRef.current = false;
    statusRef.current = "cancelled";

    chunksQueueRef.current = [];
    uploadedChunksRef.current = [];
    currentFileRef.current = null;

    setState({
      isUploading: false,
      isPaused: false,
      progress: null,
      error: null,
      uploadId: null,
      status: "cancelled",
    });
  }, []);

  // ✅ Check server status
  const getUploadStatus = useCallback(async () => {
    if (!state.uploadId) return null;

    try {
      return await getFileStatusMutation.mutateAsync(state.uploadId);
    } catch (err: any) {
      setState((p) => ({ ...p, error: err.message }));
      return null;
    }
  }, [state.uploadId, getFileStatusMutation]);

  // ✅ Complete upload
  const completeUpload = useCallback(async () => {
    if (!state.uploadId) return null;

    try {
      const result = await completeFileUploadMutation.mutateAsync(state.uploadId);

      setState((p) => ({ ...p, status: "completed" }));
      statusRef.current = "completed";

      return result;
    } catch (err: any) {
      setState((p) => ({ ...p, error: err.message, status: "error" }));
      statusRef.current = "error";
      return null;
    }
  }, [state.uploadId, completeFileUploadMutation]);

  return {
    ...state,
    initializeUpload,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    getUploadStatus,
    completeUpload,
  };
};

export default useChunkedUpload;
