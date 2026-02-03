import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stickersApi, uploadApi, ApiError } from '@/lib/api-client';
import { toast } from './use-toast';

/**
 * Query key factory for stickers
 */
export const stickerKeys = {
  all: ['stickers'] as const,
  lists: () => [...stickerKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...stickerKeys.lists(), filters] as const,
  details: () => [...stickerKeys.all, 'detail'] as const,
  detail: (id: string) => [...stickerKeys.details(), id] as const,
};

/**
 * Hook to fetch stickers with pagination and filtering
 */
export function useStickers(filters?: {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  tags?: string;
}) {
  return useQuery({
    queryKey: stickerKeys.list(filters || {}),
    queryFn: () => stickersApi.list(filters),
  });
}

/**
 * Hook to fetch a single sticker
 */
export function useSticker(id: string) {
  return useQuery({
    queryKey: stickerKeys.detail(id),
    queryFn: () => stickersApi.get(id),
    enabled: Boolean(id),
  });
}

/**
 * Hook to upload a sticker
 */
export function useUploadSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      options,
    }: {
      file: File;
      options?: {
        name?: string;
        categoryId?: string;
        tags?: string[];
        isPublic?: boolean;
      };
    }) => uploadApi.uploadFile(file, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stickerKeys.lists() });
      toast({
        title: 'Success',
        description: 'Sticker uploaded successfully',
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a sticker
 */
export function useDeleteSticker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => stickersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stickerKeys.lists() });
      toast({
        title: 'Deleted',
        description: 'Sticker deleted successfully',
      });
    },
    onError: (error: ApiError) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
