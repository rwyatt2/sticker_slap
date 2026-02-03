import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElement, ViewportBounds } from '@/types/canvas';

/**
 * Hook to use the canvas Web Worker for heavy computations
 */
export function useCanvasWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize worker
  useEffect(() => {
    // Create worker
    workerRef.current = new Worker(
      new URL('../features/canvas/workers/canvas.worker.ts', import.meta.url)
    );

    setIsReady(true);

    // Cleanup
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  /**
   * Cull elements outside viewport for performance
   */
  const cullElements = useCallback(
    (
      elements: CanvasElement[],
      viewport: ViewportBounds,
      padding = 100
    ): Promise<string[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not ready'));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'CULL_RESULT') {
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve(event.data.visibleIds);
          } else if (event.data.type === 'ERROR') {
            workerRef.current?.removeEventListener('message', handleMessage);
            reject(new Error(event.data.message));
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'CULL_ELEMENTS',
          elements,
          viewport,
          padding,
        });
      });
    },
    []
  );

  /**
   * Calculate bounds of all elements
   */
  const calculateBounds = useCallback(
    (
      elements: CanvasElement[]
    ): Promise<{ x: number; y: number; width: number; height: number } | null> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not ready'));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'BOUNDS_RESULT') {
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve(event.data.bounds);
          } else if (event.data.type === 'ERROR') {
            workerRef.current?.removeEventListener('message', handleMessage);
            reject(new Error(event.data.message));
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'CALCULATE_BOUNDS',
          elements,
        });
      });
    },
    []
  );

  /**
   * Find elements overlapping with target
   */
  const findOverlapping = useCallback(
    (elements: CanvasElement[], targetId: string): Promise<string[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Worker not ready'));
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'OVERLAPPING_RESULT') {
            workerRef.current?.removeEventListener('message', handleMessage);
            resolve(event.data.overlappingIds);
          } else if (event.data.type === 'ERROR') {
            workerRef.current?.removeEventListener('message', handleMessage);
            reject(new Error(event.data.message));
          }
        };

        workerRef.current.addEventListener('message', handleMessage);
        workerRef.current.postMessage({
          type: 'FIND_OVERLAPPING',
          elements,
          targetId,
        });
      });
    },
    []
  );

  return {
    isReady,
    cullElements,
    calculateBounds,
    findOverlapping,
  };
}
