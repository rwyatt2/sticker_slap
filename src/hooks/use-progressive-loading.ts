/**
 * Progressive loading hook for infinite canvas
 * Loads stickers in chunks based on viewport with prefetching
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/features/canvas';
import { getAdjacentRegions, distanceToViewport } from '@/features/canvas/utils/spatial-index';
import { getImageCache, getLodLevel as getImageLodLevel } from '@/features/canvas/utils/image-cache';
import type { StickerElement, ViewportBounds } from '@/types/canvas';

interface LoadingState {
  /** Currently loading region IDs */
  loading: Set<string>;
  /** Loaded region IDs */
  loaded: Set<string>;
  /** Failed region IDs */
  failed: Set<string>;
  /** Number of images being loaded */
  imagesLoading: number;
  /** Number of images loaded */
  imagesLoaded: number;
}

interface ProgressiveLoadingConfig {
  /** Size of loading regions in canvas units */
  regionSize?: number;
  /** Number of adjacent regions to prefetch */
  prefetchDepth?: number;
  /** Batch size for image loading */
  batchSize?: number;
  /** Delay between batches in ms */
  batchDelay?: number;
  /** Whether to enable progressive loading */
  enabled?: boolean;
}

const DEFAULT_CONFIG: Required<ProgressiveLoadingConfig> = {
  regionSize: 1000,
  prefetchDepth: 1,
  batchSize: 5,
  batchDelay: 50,
  enabled: true,
};

/**
 * Hook for progressive loading of canvas content
 */
export function useProgressiveLoading(
  viewport: ViewportBounds | null,
  config: ProgressiveLoadingConfig = {}
) {
  const {
    regionSize = DEFAULT_CONFIG.regionSize,
    prefetchDepth = DEFAULT_CONFIG.prefetchDepth,
    batchSize = DEFAULT_CONFIG.batchSize,
    batchDelay = DEFAULT_CONFIG.batchDelay,
    enabled = DEFAULT_CONFIG.enabled,
  } = config;

  const { elements, zoom } = useCanvasStore();
  const [loadingState, setLoadingState] = useState<LoadingState>({
    loading: new Set(),
    loaded: new Set(),
    failed: new Set(),
    imagesLoading: 0,
    imagesLoaded: 0,
  });

  const imageCache = getImageCache();
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedRegionsRef = useRef<Set<string>>(new Set());

  /**
   * Get region ID from coordinates
   */
  const getRegionId = useCallback(
    (x: number, y: number): string => {
      const regionX = Math.floor(x / regionSize);
      const regionY = Math.floor(y / regionSize);
      return `${regionX},${regionY}`;
    },
    [regionSize]
  );

  /**
   * Get stickers in a region
   */
  const getStickersInRegion = useCallback(
    (regionX: number, regionY: number): StickerElement[] => {
      const minX = regionX * regionSize;
      const minY = regionY * regionSize;
      const maxX = minX + regionSize;
      const maxY = minY + regionSize;

      return elements.filter(
        (el): el is StickerElement =>
          el.type === 'sticker' &&
          el.x < maxX &&
          el.x + el.width * el.scaleX > minX &&
          el.y < maxY &&
          el.y + el.height * el.scaleY > minY
      );
    },
    [elements, regionSize]
  );

  /**
   * Load images for a region
   */
  const loadRegion = useCallback(
    async (regionX: number, regionY: number): Promise<void> => {
      const regionId = `${regionX},${regionY}`;

      if (loadedRegionsRef.current.has(regionId)) return;

      setLoadingState((prev) => ({
        ...prev,
        loading: new Set([...Array.from(prev.loading), regionId]),
      }));

      try {
        const stickers = getStickersInRegion(regionX, regionY);
        const lod = getImageLodLevel(zoom);

        // Load images in batches
        for (let i = 0; i < stickers.length; i += batchSize) {
          const batch = stickers.slice(i, i + batchSize);

          await Promise.allSettled(
            batch.map(async (sticker) => {
              if (!imageCache.has(sticker.imageUrl, lod)) {
                setLoadingState((prev) => ({
                  ...prev,
                  imagesLoading: prev.imagesLoading + 1,
                }));

                try {
                  await imageCache.load(sticker.imageUrl, lod, 'high');
                  setLoadingState((prev) => ({
                    ...prev,
                    imagesLoaded: prev.imagesLoaded + 1,
                    imagesLoading: prev.imagesLoading - 1,
                  }));
                } catch {
                  setLoadingState((prev) => ({
                    ...prev,
                    imagesLoading: prev.imagesLoading - 1,
                  }));
                }
              }
            })
          );

          // Add delay between batches
          if (i + batchSize < stickers.length) {
            await new Promise((resolve) => setTimeout(resolve, batchDelay));
          }
        }

        loadedRegionsRef.current.add(regionId);
        setLoadingState((prev) => {
          const loading = new Set(Array.from(prev.loading));
          loading.delete(regionId);
          return {
            ...prev,
            loading,
            loaded: new Set([...Array.from(prev.loaded), regionId]),
          };
        });
      } catch {
        setLoadingState((prev) => {
          const loading = new Set(Array.from(prev.loading));
          loading.delete(regionId);
          return {
            ...prev,
            loading,
            failed: new Set([...Array.from(prev.failed), regionId]),
          };
        });
      }
    },
    [getStickersInRegion, zoom, batchSize, batchDelay, imageCache]
  );

  /**
   * Load visible regions and prefetch adjacent ones
   */
  useEffect(() => {
    if (!enabled || !viewport) return;

    // Cancel previous loading
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const loadVisibleRegions = async () => {
      // Get all regions that need loading
      const regions = getAdjacentRegions(viewport, regionSize, prefetchDepth);

      // Sort by distance from viewport center (load closest first)
      const sortedRegions = regions.sort(
        (a, b) => distanceToViewport(a, viewport) - distanceToViewport(b, viewport)
      );

      // Load regions
      for (const region of sortedRegions) {
        if (abortControllerRef.current?.signal.aborted) break;

        const regionX = Math.floor(region.x / regionSize);
        const regionY = Math.floor(region.y / regionSize);

        await loadRegion(regionX, regionY);
      }
    };

    loadVisibleRegions();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [viewport, enabled, regionSize, prefetchDepth, loadRegion]);

  /**
   * Upgrade LOD when zoom changes
   */
  useEffect(() => {
    if (!enabled) return;

    const lod = getImageLodLevel(zoom);

    // Find stickers that need higher resolution
    const stickers = elements.filter(
      (el): el is StickerElement =>
        el.type === 'sticker' && !imageCache.has(el.imageUrl, lod)
    );

    if (stickers.length === 0) return;

    // Load high-res versions for visible stickers
    const loadHighRes = async () => {
      for (const sticker of stickers.slice(0, 10)) {
        if (!imageCache.has(sticker.imageUrl, lod)) {
          try {
            await imageCache.load(sticker.imageUrl, lod, 'low');
          } catch {
            // Ignore errors for LOD upgrades
          }
        }
      }
    };

    loadHighRes();
  }, [zoom, elements, enabled, imageCache]);

  /**
   * Clear cache for regions outside viewport + buffer
   */
  const clearDistantRegions = useCallback(
    (bufferMultiplier = 3) => {
      if (!viewport) return;

      const buffer = regionSize * bufferMultiplier;
      const minX = viewport.x - buffer;
      const minY = viewport.y - buffer;
      const maxX = viewport.x + viewport.width + buffer;
      const maxY = viewport.y + viewport.height + buffer;

      const regionsToRemove: string[] = [];

    loadedRegionsRef.current.forEach((regionId) => {
      const parts = regionId.split(',').map(Number);
      const rx = parts[0] ?? 0;
      const ry = parts[1] ?? 0;
      const regionX = rx * regionSize;
      const regionY = ry * regionSize;

        if (
          regionX + regionSize < minX ||
          regionX > maxX ||
          regionY + regionSize < minY ||
          regionY > maxY
        ) {
          regionsToRemove.push(regionId);
        }
      });

      regionsToRemove.forEach((id) => {
        loadedRegionsRef.current.delete(id);
      });

      setLoadingState((prev) => {
        const loaded = new Set(prev.loaded);
        regionsToRemove.forEach((id) => loaded.delete(id));
        return { ...prev, loaded };
      });
    },
    [viewport, regionSize]
  );

  /**
   * Force reload a specific region
   */
  const reloadRegion = useCallback(
    async (x: number, y: number) => {
      const regionId = getRegionId(x, y);
      loadedRegionsRef.current.delete(regionId);

      setLoadingState((prev) => {
        const loaded = new Set(prev.loaded);
        const failed = new Set(prev.failed);
        loaded.delete(regionId);
        failed.delete(regionId);
        return { ...prev, loaded, failed };
      });

      const regionX = Math.floor(x / regionSize);
      const regionY = Math.floor(y / regionSize);
      await loadRegion(regionX, regionY);
    },
    [getRegionId, regionSize, loadRegion]
  );

  /**
   * Clear all loaded regions
   */
  const clearAll = useCallback(() => {
    loadedRegionsRef.current.clear();
    setLoadingState({
      loading: new Set(),
      loaded: new Set(),
      failed: new Set(),
      imagesLoading: 0,
      imagesLoaded: 0,
    });
  }, []);

  return {
    loadingState,
    isLoading: loadingState.loading.size > 0,
    progress:
      loadingState.imagesLoaded /
      Math.max(1, loadingState.imagesLoaded + loadingState.imagesLoading),
    getRegionId,
    isRegionLoaded: (x: number, y: number) => loadedRegionsRef.current.has(getRegionId(x, y)),
    clearDistantRegions,
    reloadRegion,
    clearAll,
  };
}
