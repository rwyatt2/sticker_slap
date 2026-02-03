'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone, FileRejection, DropzoneOptions } from 'react-dropzone';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Upload,
  X,
  Check,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  FileWarning,
  RefreshCw,
} from 'lucide-react';

// Types
export interface UploadFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'compressing' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: {
    stickerId?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    jobId?: string;
  };
}

export interface UploadLimits {
  maxFileSize: number;
  maxDimensions: { width: number; height: number };
  maxUploadsPerHour: number;
  quotaUsed: number;
  quotaTotal: number;
  quotaRemaining: number;
  quotaUsedPercentage: number;
  allowedTypes: string[];
  virusScanningEnabled: boolean;
}

export interface ImageUploaderProps {
  onUploadComplete?: (results: UploadFile[]) => void;
  onFileSelect?: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  showPreviews?: boolean;
  autoUpload?: boolean;
  compressImages?: boolean;
  compressionOptions?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
  };
  metadata?: {
    name?: string;
    tags?: string[];
    categoryId?: string;
    isPublic?: boolean;
  };
}

// Allowed MIME types (matching server)
const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
};

const ACCEPT_CONFIG = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
};

// Default compression options
const DEFAULT_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 4096,
  useWebWorker: true,
  fileType: 'image/webp',
};

// Format bytes for display
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function ImageUploader({
  onUploadComplete,
  onFileSelect,
  maxFiles = 10,
  disabled = false,
  className,
  showPreviews = true,
  autoUpload = true,
  compressImages = true,
  compressionOptions = DEFAULT_COMPRESSION_OPTIONS,
  metadata,
}: ImageUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [limits, setLimits] = useState<UploadLimits | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch upload limits on mount
  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      const response = await fetch('/api/upload');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLimits(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch upload limits:', error);
    }
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [files]);

  // Validate file on client side
  const validateFile = useCallback(
    (file: File): string | null => {
      const maxSize = limits?.maxFileSize || 5 * 1024 * 1024;

      if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
        return `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, SVG`;
      }

      if (file.size > maxSize) {
        return `File too large: ${formatBytes(file.size)}. Maximum: ${formatBytes(maxSize)}`;
      }

      return null;
    },
    [limits]
  );

  // Compress image using browser-image-compression
  const compressFile = async (file: File): Promise<File> => {
    // Don't compress SVGs or GIFs
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return file;
    }

    try {
      const options = {
        ...DEFAULT_COMPRESSION_OPTIONS,
        ...compressionOptions,
      };

      const compressedFile = await imageCompression(file, {
        maxSizeMB: options.maxSizeMB,
        maxWidthOrHeight: options.maxWidthOrHeight,
        useWebWorker: options.useWebWorker,
        preserveExif: false, // Strip EXIF data for privacy
      });

      return compressedFile;
    } catch (error) {
      console.error('Compression failed:', error);
      return file; // Return original if compression fails
    }
  };

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      // Handle rejected files
      const newFiles: UploadFile[] = [];

      for (const rejection of rejectedFiles) {
        const errorMessage =
          rejection.errors.map((e) => e.message).join(', ') ||
          'File rejected';
        newFiles.push({
          id: generateId(),
          file: rejection.file,
          preview: '',
          progress: 0,
          status: 'error',
          error: errorMessage,
        });
      }

      // Process accepted files
      for (const file of acceptedFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          newFiles.push({
            id: generateId(),
            file,
            preview: '',
            progress: 0,
            status: 'error',
            error: validationError,
          });
        } else {
          const preview = URL.createObjectURL(file);
          newFiles.push({
            id: generateId(),
            file,
            preview,
            progress: 0,
            status: 'pending',
          });
        }
      }

      setFiles((prev) => [...prev, ...newFiles]);

      // Notify parent
      if (onFileSelect) {
        onFileSelect(acceptedFiles);
      }

      // Auto upload if enabled
      if (autoUpload && newFiles.some((f) => f.status === 'pending')) {
        // Small delay to allow UI to update
        setTimeout(() => {
          uploadFiles(newFiles.filter((f) => f.status === 'pending'));
        }, 100);
      }
    },
    [validateFile, onFileSelect, autoUpload]
  );

  // Upload files
  const uploadFiles = async (filesToUpload?: UploadFile[]) => {
    const toUpload = filesToUpload || files.filter((f) => f.status === 'pending');

    if (toUpload.length === 0) return;

    setIsUploading(true);
    abortControllerRef.current = new AbortController();

    const updatedFiles = [...files];

    for (const uploadFile of toUpload) {
      const index = updatedFiles.findIndex((f) => f.id === uploadFile.id);
      if (index === -1) continue;

      try {
        // Compress if enabled
        let fileToUpload = uploadFile.file;
        if (compressImages) {
          updatedFiles[index] = {
            ...updatedFiles[index]!,
            status: 'compressing' as const,
            progress: 10,
          };
          setFiles([...updatedFiles]);

          fileToUpload = await compressFile(uploadFile.file);
        }

        // Update status to uploading
        updatedFiles[index] = {
          ...updatedFiles[index]!,
          status: 'uploading' as const,
          progress: 30,
        };
        setFiles([...updatedFiles]);

        // Create form data
        const formData = new FormData();
        formData.append('file', fileToUpload, uploadFile.file.name);

        if (metadata?.name) formData.append('name', metadata.name);
        if (metadata?.categoryId) formData.append('categoryId', metadata.categoryId);
        if (metadata?.tags) formData.append('tags', metadata.tags.join(','));
        if (metadata?.isPublic !== undefined) {
          formData.append('isPublic', String(metadata.isPublic));
        }

        // Upload with progress tracking via XHR
        const result = await uploadWithProgress(
          formData,
          (progress) => {
            updatedFiles[index] = {
              ...updatedFiles[index]!,
              progress: 30 + Math.floor(progress * 0.6), // 30-90%
            };
            setFiles([...updatedFiles]);
          },
          abortControllerRef.current.signal
        );

        if (result.success && result.results?.[0]?.success) {
          updatedFiles[index] = {
            ...updatedFiles[index]!,
            status: 'success' as const,
            progress: 100,
            result: result.results[0],
          };
        } else {
          const errorMsg =
            result.results?.[0]?.message || result.message || 'Upload failed';
          updatedFiles[index] = {
            ...updatedFiles[index]!,
            status: 'error' as const,
            error: errorMsg,
          };
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          updatedFiles[index] = {
            ...updatedFiles[index]!,
            status: 'error' as const,
            error: 'Upload cancelled',
          };
        } else {
          updatedFiles[index] = {
            ...updatedFiles[index]!,
            status: 'error' as const,
            error:
              error instanceof Error ? error.message : 'Upload failed',
          };
        }
      }

      setFiles([...updatedFiles]);
    }

    setIsUploading(false);

    // Notify parent of completion
    if (onUploadComplete) {
      onUploadComplete(updatedFiles);
    }
  };

  // Upload with XMLHttpRequest for progress tracking
  const uploadWithProgress = (
    formData: FormData,
    onProgress: (progress: number) => void,
    signal: AbortSignal
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          onProgress(event.loaded / event.total);
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

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      signal.addEventListener('abort', () => {
        xhr.abort();
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  // Remove a file from the list
  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // Retry a failed upload
  const retryUpload = (id: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: 'pending' as const, error: undefined, progress: 0 } : f
      )
    );

    const fileToRetry = files.find((f) => f.id === id);
    if (fileToRetry) {
      uploadFiles([{ ...fileToRetry, status: 'pending', progress: 0 }]);
    }
  };

  // Cancel ongoing uploads
  const cancelUploads = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Clear all files
  const clearAll = () => {
    files.forEach((file) => URL.revokeObjectURL(file.preview));
    setFiles([]);
  };

  // Dropzone config
  const dropzoneOptions: DropzoneOptions = {
    onDrop,
    accept: ACCEPT_CONFIG,
    maxFiles,
    disabled: disabled || isUploading,
    maxSize: limits?.maxFileSize || 5 * 1024 * 1024,
    multiple: true,
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone(dropzoneOptions);

  // Calculate stats
  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive &&
            !disabled &&
            'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-2 text-center">
          {isDragReject ? (
            <>
              <FileWarning className="h-12 w-12 text-destructive" />
              <p className="text-sm text-destructive">
                Some files are not allowed
              </p>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-12 w-12 text-primary animate-bounce" />
              <p className="text-sm text-primary">Drop files here</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drag & drop images here, or click to select
                </p>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, WebP, GIF, SVG up to{' '}
                  {formatBytes(limits?.maxFileSize || 5 * 1024 * 1024)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quota indicator */}
      {limits && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Storage used</span>
            <span>
              {formatBytes(limits.quotaUsed)} / {formatBytes(limits.quotaTotal)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                limits.quotaUsedPercentage > 90
                  ? 'bg-destructive'
                  : limits.quotaUsedPercentage > 70
                    ? 'bg-yellow-500'
                    : 'bg-primary'
              )}
              style={{ width: `${Math.min(limits.quotaUsedPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* File previews */}
      {showPreviews && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
              {successCount > 0 && (
                <span className="text-green-500 ml-2">
                  ({successCount} uploaded)
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-destructive ml-2">
                  ({errorCount} failed)
                </span>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={isUploading}
            >
              Clear all
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {files.map((file) => (
              <div
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {/* Preview image */}
                {file.preview && (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-full w-full object-cover"
                  />
                )}

                {/* Overlay for status */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity',
                    file.status === 'success' && 'bg-green-500/20',
                    file.status === 'error' && 'bg-destructive/20'
                  )}
                >
                  {file.status === 'pending' && (
                    <span className="text-xs text-white">Ready</span>
                  )}
                  {file.status === 'compressing' && (
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                      <span className="text-xs text-white">Compressing</span>
                    </div>
                  )}
                  {file.status === 'uploading' && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="h-1.5 w-16 rounded-full bg-white/30">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-white">
                        {file.progress}%
                      </span>
                    </div>
                  )}
                  {file.status === 'success' && (
                    <Check className="h-8 w-8 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <div className="flex flex-col items-center gap-1 p-2">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                      <span className="text-xs text-white text-center line-clamp-2">
                        {file.error}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.status === 'error' && (
                    <button
                      onClick={() => retryUpload(file.id)}
                      className="rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => removeFile(file.id)}
                    className="rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                    disabled={file.status === 'uploading'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* File name */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="truncate text-xs text-white">
                    {file.file.name}
                  </p>
                  <p className="text-xs text-white/70">
                    {formatBytes(file.file.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button (when autoUpload is disabled) */}
      {!autoUpload && pendingCount > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={() => uploadFiles()}
            disabled={isUploading || pendingCount === 0}
            className="flex-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
          {isUploading && (
            <Button variant="outline" onClick={cancelUploads}>
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
