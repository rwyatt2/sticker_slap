/**
 * Hook for spatial indexing with Web Worker support
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SpatialIndex } from '@/features/canvas/utils/spatial-index';
import type { CanvasElement, ViewportBounds } from '@/types/canvas';

interface SpatialIndexState {
  isReady: boolean;
  elementCount: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

interface UseSpatialIndexConfig {
  /** Use Web Worker for heavy computations */
  useWorker?: boolean;
  /** Elements to index */
  elements: CanvasElement[];
}

/**
 * Hook for managing spatial index
 */
export function useSpatialIndex({ elements, useWorker = true }: UseSpatialIndexConfig) {
  const indexRef = useRef<SpatialIndex>(new SpatialIndex());
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<SpatialIndexState>({
    isReady: false,
    elementCount: 0,
    bounds: null,
  });

  // Initialize worker
  useEffect(() => {
    if (useWorker && typeof Worker !== 'undefined') {
      try {
        workerRef.current = new Worker(
          new URL('../features/canvas/workers/spatial.worker.ts', import.meta.url)
        );

        workerRef.current.onmessage = (event) => {
          const { type } = event.data;
          if (type === 'LOADED') {
            setState((prev) => ({ ...prev, isReady: true, elementCount: event.data.count }));
          }
        };

        workerRef.current.onerror = (error) => {
          console.error('Spatial worker error:', error);
        };
      } catch (error) {
        console.warn('Failed to create spatial worker:', error);
      }
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [useWorker]);

  // Update index when elements change
  useEffect(() => {
    indexRef.current.load(elements);
    setState((prev) => ({
      ...prev,
      elementCount: elements.length,
      bounds: indexRef.current.getBounds(),
      isReady: true,
    }));

    // Also update worker if available
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'LOAD_ELEMENTS', elements });
    }
  }, [elements]);

  /**
   * Query elements in viewport
   */
  const queryViewport = useCallback(
    (viewport: ViewportBounds, padding = 100): CanvasElement[] => {
      return indexRef.current.queryViewport(viewport, padding);
    },
    []
  );

  /**
   * Query visible element IDs
   */
  const queryViewportIds = useCallback(
    (viewport: ViewportBounds, padding = 100): string[] => {
      return indexRef.current.queryViewportIds(viewport, padding);
    },
    []
  );

  /**
   * Query viewport using worker (async)
   */
  const queryViewportAsync = useCallback(
    (viewport: ViewportBounds, padding = 100, zoom = 1): Promise<string[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve(queryViewportIds(viewport, padding));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'VIEWPORT_RESULT') {
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve(event.data.visibleIds);
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'QUERY_VIEWPORT',
          viewport,
          padding,
          zoom,
        });
      });
    },
    [queryViewportIds]
  );

  /**
   * Find collisions for an element
   */
  const findCollisions = useCallback((elementId: string): CanvasElement[] => {
    return indexRef.current.findCollisions(elementId);
  }, []);

  /**
   * Find collisions using worker (async)
   */
  const findCollisionsAsync = useCallback(
    (elementId: string): Promise<string[]> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve(findCollisions(elementId).map((e) => e.id));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'COLLISION_RESULT') {
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve(event.data.collisionIds);
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'FIND_COLLISIONS',
          elementId,
        });
      });
    },
    [findCollisions]
  );

  /**
   * Query elements at a point
   */
  const queryPoint = useCallback((x: number, y: number): CanvasElement[] => {
    return indexRef.current.queryPoint(x, y);
  }, []);

  /**
   * Query elements in a radius
   */
  const queryRadius = useCallback((x: number, y: number, radius: number): CanvasElement[] => {
    return indexRef.current.queryRadius(x, y, radius);
  }, []);

  /**
   * Get bounds of all elements
   */
  const getBounds = useCallback(() => {
    return indexRef.current.getBounds();
  }, []);

  /**
   * Insert a single element
   */
  const insert = useCallback((element: CanvasElement) => {
    indexRef.current.insert(element);
    setState((prev) => ({
      ...prev,
      elementCount: indexRef.current.size,
      bounds: indexRef.current.getBounds(),
    }));
  }, []);

  /**
   * Update a single element
   */
  const update = useCallback((element: CanvasElement) => {
    indexRef.current.update(element);
    setState((prev) => ({
      ...prev,
      bounds: indexRef.current.getBounds(),
    }));
  }, []);

  /**
   * Remove an element
   */
  const remove = useCallback((id: string) => {
    indexRef.current.remove(id);
    setState((prev) => ({
      ...prev,
      elementCount: indexRef.current.size,
      bounds: indexRef.current.getBounds(),
    }));
  }, []);

  return {
    ...state,
    queryViewport,
    queryViewportIds,
    queryViewportAsync,
    findCollisions,
    findCollisionsAsync,
    queryPoint,
    queryRadius,
    getBounds,
    insert,
    update,
    remove,
    index: indexRef.current,
  };
}
