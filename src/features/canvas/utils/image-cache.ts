/**
 * Image preloading and caching system
 * Manages image loading, caching, and memory optimization
 */

interface CacheEntry {
  image: HTMLImageElement;
  url: string;
  timestamp: number;
  size: number;
  lod: 'low' | 'medium' | 'high';
}

interface LoadingEntry {
  promise: Promise<HTMLImageElement>;
  abortController: AbortController;
}

/**
 * LRU (Least Recently Used) image cache with memory management
 */
export class ImageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private loading: Map<string, LoadingEntry> = new Map();
  private maxMemoryBytes: number;
  private currentMemoryBytes = 0;

  constructor(maxMemoryMB = 100) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
  }

  /**
   * Generate cache key from URL and LOD level
   */
  private getCacheKey(url: string, lod: 'low' | 'medium' | 'high'): string {
    return `${lod}:${url}`;
  }

  /**
   * Estimate image memory size (width * height * 4 bytes for RGBA)
   */
  private estimateImageSize(image: HTMLImageElement): number {
    return image.naturalWidth * image.naturalHeight * 4;
  }

  /**
   * Load an image with optional LOD (Level of Detail)
   */
  async load(
    url: string,
    lod: 'low' | 'medium' | 'high' = 'high',
    priority: 'high' | 'low' = 'low'
  ): Promise<HTMLImageElement> {
    const key = this.getCacheKey(url, lod);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      cached.timestamp = Date.now();
      return cached.image;
    }

    // Check if already loading
    const loading = this.loading.get(key);
    if (loading) {
      return loading.promise;
    }

    // Start loading
    const abortController = new AbortController();
    const promise = this.loadImage(url, lod, abortController.signal, priority);

    this.loading.set(key, { promise, abortController });

    try {
      const image = await promise;

      // Add to cache
      const size = this.estimateImageSize(image);
      this.ensureCapacity(size);

      this.cache.set(key, {
        image,
        url,
        timestamp: Date.now(),
        size,
        lod,
      });

      this.currentMemoryBytes += size;
      return image;
    } finally {
      this.loading.delete(key);
    }
  }

  /**
   * Internal image loading with LOD support
   */
  private loadImage(
    url: string,
    lod: 'low' | 'medium' | 'high',
    signal: AbortSignal,
    priority: 'high' | 'low'
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';

      // Set priority hint
      if ('fetchPriority' in image) {
        (image as HTMLImageElement & { fetchPriority: string }).fetchPriority = priority;
      }

      const handleLoad = () => {
        cleanup();

        // Apply LOD quality reduction if needed
        if (lod !== 'high') {
          this.applyLod(image, lod)
            .then(resolve)
            .catch(() => resolve(image)); // Fallback to original on error
        } else {
          resolve(image);
        }
      };

      const handleError = () => {
        cleanup();
        reject(new Error(`Failed to load image: ${url}`));
      };

      const handleAbort = () => {
        cleanup();
        reject(new Error('Image loading aborted'));
      };

      const cleanup = () => {
        image.removeEventListener('load', handleLoad);
        image.removeEventListener('error', handleError);
        signal.removeEventListener('abort', handleAbort);
      };

      image.addEventListener('load', handleLoad);
      image.addEventListener('error', handleError);
      signal.addEventListener('abort', handleAbort);

      // Add LOD query parameter if supported by the server
      const lodUrl = this.getLodUrl(url, lod);
      image.src = lodUrl;
    });
  }

  /**
   * Get URL with LOD parameter
   */
  private getLodUrl(url: string, lod: 'low' | 'medium' | 'high'): string {
    if (lod === 'high') return url;

    try {
      const parsedUrl = new URL(url);
      const quality = lod === 'low' ? 25 : 50;
      const width = lod === 'low' ? 100 : 400;

      // Check if it's a common image service URL
      if (parsedUrl.hostname.includes('cloudinary')) {
        // Cloudinary transformation
        return url.replace('/upload/', `/upload/w_${width},q_${quality}/`);
      } else if (parsedUrl.hostname.includes('imgix')) {
        // Imgix transformation
        parsedUrl.searchParams.set('w', String(width));
        parsedUrl.searchParams.set('q', String(quality));
        return parsedUrl.toString();
      } else {
        // Add generic query params (some CDNs support this)
        parsedUrl.searchParams.set('w', String(width));
        parsedUrl.searchParams.set('q', String(quality));
        return parsedUrl.toString();
      }
    } catch {
      return url;
    }
  }

  /**
   * Apply LOD reduction using canvas downscaling
   */
  private applyLod(
    image: HTMLImageElement,
    lod: 'low' | 'medium' | 'high'
  ): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const scale = lod === 'low' ? 0.1 : 0.5;
      const width = Math.max(1, Math.floor(image.naturalWidth * scale));
      const height = Math.max(1, Math.floor(image.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(image);
        return;
      }

      // Use smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(image, 0, 0, width, height);

      const lowResImage = new Image();
      lowResImage.onload = () => resolve(lowResImage);
      lowResImage.onerror = () => reject(new Error('Failed to create LOD image'));
      lowResImage.src = canvas.toDataURL('image/webp', lod === 'low' ? 0.3 : 0.6);
    });
  }

  /**
   * Ensure there's enough capacity for new image
   */
  private ensureCapacity(requiredBytes: number): void {
    if (this.currentMemoryBytes + requiredBytes <= this.maxMemoryBytes) {
      return;
    }

    // Sort by timestamp (oldest first) and remove until we have space
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    for (const [key, entry] of entries) {
      if (this.currentMemoryBytes + requiredBytes <= this.maxMemoryBytes) {
        break;
      }

      this.cache.delete(key);
      this.currentMemoryBytes -= entry.size;
    }
  }

  /**
   * Preload multiple images
   */
  async preload(
    urls: string[],
    lod: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<Map<string, HTMLImageElement>> {
    const results = new Map<string, HTMLImageElement>();

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          const image = await this.load(url, lod, 'low');
          results.set(url, image);
        } catch {
          // Ignore failed loads during preload
        }
      })
    );

    return results;
  }

  /**
   * Cancel pending image load
   */
  cancel(url: string, lod: 'low' | 'medium' | 'high' = 'high'): void {
    const key = this.getCacheKey(url, lod);
    const loading = this.loading.get(key);
    if (loading) {
      loading.abortController.abort();
      this.loading.delete(key);
    }
  }

  /**
   * Cancel all pending loads
   */
  cancelAll(): void {
    this.loading.forEach((loading) => {
      loading.abortController.abort();
    });
    this.loading.clear();
  }

  /**
   * Check if image is cached
   */
  has(url: string, lod: 'low' | 'medium' | 'high' = 'high'): boolean {
    return this.cache.has(this.getCacheKey(url, lod));
  }

  /**
   * Get cached image without loading
   */
  get(url: string, lod: 'low' | 'medium' | 'high' = 'high'): HTMLImageElement | undefined {
    const entry = this.cache.get(this.getCacheKey(url, lod));
    if (entry) {
      entry.timestamp = Date.now();
      return entry.image;
    }
    return undefined;
  }

  /**
   * Remove specific image from cache
   */
  remove(url: string, lod?: 'low' | 'medium' | 'high'): void {
    if (lod) {
      const key = this.getCacheKey(url, lod);
      const entry = this.cache.get(key);
      if (entry) {
        this.currentMemoryBytes -= entry.size;
        this.cache.delete(key);
      }
    } else {
      // Remove all LOD versions
      for (const level of ['low', 'medium', 'high'] as const) {
        this.remove(url, level);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cancelAll();
    this.cache.clear();
    this.currentMemoryBytes = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    count: number;
    memoryMB: number;
    maxMemoryMB: number;
    loadingCount: number;
  } {
    return {
      count: this.cache.size,
      memoryMB: this.currentMemoryBytes / (1024 * 1024),
      maxMemoryMB: this.maxMemoryBytes / (1024 * 1024),
      loadingCount: this.loading.size,
    };
  }
}

// Singleton instance
let globalImageCache: ImageCache | null = null;

/**
 * Get the global image cache instance
 */
export function getImageCache(): ImageCache {
  if (!globalImageCache) {
    globalImageCache = new ImageCache(100);
  }
  return globalImageCache;
}

/**
 * Determine appropriate LOD level based on zoom
 */
export function getLodLevel(zoom: number): 'low' | 'medium' | 'high' {
  if (zoom < 0.25) return 'low';
  if (zoom < 0.75) return 'medium';
  return 'high';
}
