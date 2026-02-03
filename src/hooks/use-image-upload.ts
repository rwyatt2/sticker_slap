'use client';

import { useState, useCallback, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { useToast } from './use-toast';

export interface UploadedImage {
  id: string;
  stickerId?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  jobId?: string;
  originalFile: File;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface UseImageUploadOptions {
  compressImages?: boolean;
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  };
  onProgress?: (progress: UploadProgress[]) => void;
  onComplete?: (results: UploadedImage[]) => void;
  onError?: (error: string) => void;
}

const DEFAULT_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 4096,
  useWebWorker: true,
};

// Allowed MIME types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    compressImages = true,
    compressionOptions = DEFAULT_COMPRESSION_OPTIONS,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Validate a single file
  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 5MB`;
    }
    return null;
  }, []);

  // Compress a single file
  const compressFile = async (file: File): Promise<File> => {
    // Don't compress SVGs or GIFs
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return file;
    }

    try {
      const options = {
        ...DEFAULT_COMPRESSION_OPTIONS,
        ...compressionOptions,
        preserveExif: false,
      };

      return await imageCompression(file, {
        maxSizeMB: options.maxSizeMB,
        maxWidthOrHeight: options.maxWidthOrHeight,
        useWebWorker: options.useWebWorker,
      });
    } catch (error) {
      console.error('Compression failed:', error);
      return file;
    }
  };

  // Update progress for a file
  const updateProgress = useCallback(
    (fileId: string, update: Partial<UploadProgress>) => {
      setProgress((prev) => {
        const updated = prev.map((p) =>
          p.fileId === fileId ? { ...p, ...update } : p
        );
        if (onProgress) onProgress(updated);
        return updated;
      });
    },
    [onProgress]
  );

  // Upload with XMLHttpRequest for progress tracking
  const uploadWithProgress = (
    formData: FormData,
    onProgressUpdate: (progress: number) => void,
    signal: AbortSignal
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgressUpdate(event.loaded / event.total);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ success: true });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      signal.addEventListener('abort', () => xhr.abort());

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  // Upload multiple files
  const uploadFiles = useCallback(
    async (
      files: File[],
      metadata?: {
        name?: string;
        tags?: string[];
        categoryId?: string;
        isPublic?: boolean;
      }
    ): Promise<UploadedImage[]> => {
      if (files.length === 0) return [];

      setIsUploading(true);
      abortControllerRef.current = new AbortController();

      // Validate files first
      const validFiles: { id: string; file: File }[] = [];
      const initialProgress: UploadProgress[] = [];

      for (const file of files) {
        const id = generateId();
        const error = validateFile(file);

        if (error) {
          initialProgress.push({
            fileId: id,
            filename: file.name,
            progress: 0,
            status: 'error',
            error,
          });
        } else {
          validFiles.push({ id, file });
          initialProgress.push({
            fileId: id,
            filename: file.name,
            progress: 0,
            status: 'pending',
          });
        }
      }

      setProgress(initialProgress);
      if (onProgress) onProgress(initialProgress);

      const results: UploadedImage[] = [];

      // Process each valid file
      for (const { id, file } of validFiles) {
        try {
          // Compress if enabled
          let fileToUpload = file;
          if (compressImages) {
            updateProgress(id, { status: 'compressing', progress: 10 });
            fileToUpload = await compressFile(file);
          }

          // Prepare for upload
          updateProgress(id, { status: 'uploading', progress: 20 });

          const formData = new FormData();
          formData.append('file', fileToUpload, file.name);

          if (metadata?.name) formData.append('name', metadata.name);
          if (metadata?.categoryId)
            formData.append('categoryId', metadata.categoryId);
          if (metadata?.tags) formData.append('tags', metadata.tags.join(','));
          if (metadata?.isPublic !== undefined) {
            formData.append('isPublic', String(metadata.isPublic));
          }

          // Upload with progress
          const response = await uploadWithProgress(
            formData,
            (prog) => {
              updateProgress(id, { progress: 20 + Math.floor(prog * 70) });
            },
            abortControllerRef.current!.signal
          );

          if (response.success && response.results?.[0]?.success) {
            const result = response.results[0];
            updateProgress(id, { status: 'success', progress: 100 });

            const uploaded: UploadedImage = {
              id,
              stickerId: result.stickerId,
              imageUrl: result.imageUrl,
              thumbnailUrl: result.thumbnailUrl,
              jobId: result.jobId,
              originalFile: file,
            };

            results.push(uploaded);
            setUploadedImages((prev) => [...prev, uploaded]);
          } else {
            const errorMsg =
              response.results?.[0]?.message ||
              response.message ||
              'Upload failed';
            updateProgress(id, { status: 'error', error: errorMsg });

            if (onError) onError(errorMsg);
            toast({
              title: 'Upload failed',
              description: errorMsg,
              variant: 'destructive',
            });
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Upload failed';
          updateProgress(id, { status: 'error', error: errorMsg });

          if (error instanceof Error && error.message !== 'Upload cancelled') {
            if (onError) onError(errorMsg);
            toast({
              title: 'Upload failed',
              description: errorMsg,
              variant: 'destructive',
            });
          }
        }
      }

      setIsUploading(false);

      if (onComplete && results.length > 0) {
        onComplete(results);
      }

      if (results.length > 0) {
        toast({
          title: 'Upload complete',
          description: `Successfully uploaded ${results.length} file${results.length !== 1 ? 's' : ''}`,
        });
      }

      return results;
    },
    [
      validateFile,
      compressImages,
      compressionOptions,
      updateProgress,
      onProgress,
      onComplete,
      onError,
      toast,
    ]
  );

  // Cancel ongoing uploads
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
    }
  }, []);

  // Clear upload state
  const clearUploads = useCallback(() => {
    setProgress([]);
    setUploadedImages([]);
  }, []);

  // Retry a failed upload
  const retryUpload = useCallback(
    async (
      fileId: string,
      metadata?: {
        name?: string;
        tags?: string[];
        categoryId?: string;
        isPublic?: boolean;
      }
    ) => {
      const failedProgress = progress.find((p) => p.fileId === fileId);
      if (!failedProgress) return;

      // Find the original file (if still available)
      const uploadedImage = uploadedImages.find((u) => u.id === fileId);
      if (!uploadedImage?.originalFile) {
        toast({
          title: 'Cannot retry',
          description: 'Original file is no longer available',
          variant: 'destructive',
        });
        return;
      }

      // Remove from failed list and retry
      setProgress((prev) => prev.filter((p) => p.fileId !== fileId));
      return uploadFiles([uploadedImage.originalFile], metadata);
    },
    [progress, uploadedImages, uploadFiles, toast]
  );

  return {
    uploadFiles,
    cancelUpload,
    clearUploads,
    retryUpload,
    isUploading,
    progress,
    uploadedImages,
    validateFile,
  };
}

export default useImageUpload;
