/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * API error response
 */
export interface ApiError {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Upload response
 */
export interface UploadResponse {
  url: string;
  key: string;
  filename: string;
  size: number;
  contentType: string;
}

/**
 * Presigned URL response for direct upload
 */
export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresAt: string;
}

/**
 * User profile
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project/Canvas document
 */
export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  width: number;
  height: number;
  data: string; // JSON string of canvas state
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Sticker asset
 */
export interface StickerAsset {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  tags: string[];
  category: string;
  userId: string | null;
  isPublic: boolean;
  createdAt: string;
}

/**
 * Sticker category
 */
export interface StickerCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  count: number;
}
