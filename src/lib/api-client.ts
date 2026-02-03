import type { ApiResponse, PaginatedResponse, PaginationParams } from '@/types/api';

const API_BASE = '/api';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.message || 'An error occurred',
      data.details
    );
  }

  return data;
}

/**
 * Build query string from params
 */
function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * API client for stickers
 */
export const stickersApi = {
  list: (params?: PaginationParams & { category?: string; search?: string; tags?: string }) =>
    fetchApi<PaginatedResponse<unknown>>(`/stickers${buildQueryString(params || {})}`),

  get: (id: string) => fetchApi<ApiResponse<unknown>>(`/stickers/${id}`),

  delete: (id: string) =>
    fetchApi<ApiResponse<void>>(`/stickers/${id}`, { method: 'DELETE' }),
};

/**
 * API client for projects
 */
export const projectsApi = {
  list: (params?: PaginationParams) =>
    fetchApi<PaginatedResponse<unknown>>(`/projects${buildQueryString(params || {})}`),

  get: (id: string) => fetchApi<ApiResponse<unknown>>(`/projects/${id}`),

  create: (data: { name: string; description?: string; width?: number; height?: number }) =>
    fetchApi<ApiResponse<unknown>>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, unknown>) =>
    fetchApi<ApiResponse<unknown>>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchApi<ApiResponse<void>>(`/projects/${id}`, { method: 'DELETE' }),
};

/**
 * API client for uploads
 */
export const uploadApi = {
  uploadFile: async (
    file: File,
    options?: {
      name?: string;
      categoryId?: string;
      tags?: string[];
      isPublic?: boolean;
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);

    if (options?.name) formData.append('name', options.name);
    if (options?.categoryId) formData.append('categoryId', options.categoryId);
    if (options?.tags) formData.append('tags', options.tags.join(','));
    if (options?.isPublic !== undefined) formData.append('isPublic', String(options.isPublic));

    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(response.status, data.message || 'Upload failed');
    }

    return data as ApiResponse<unknown>;
  },
};
