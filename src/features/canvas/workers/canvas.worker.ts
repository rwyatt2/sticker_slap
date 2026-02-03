/**
 * Web Worker for heavy canvas computations
 * This runs in a separate thread to avoid blocking the main UI
 */

import type { CanvasElement, ViewportBounds } from '@/types/canvas';

// Message types
type WorkerMessage =
  | { type: 'CULL_ELEMENTS'; elements: CanvasElement[]; viewport: ViewportBounds; padding: number }
  | { type: 'CALCULATE_BOUNDS'; elements: CanvasElement[] }
  | { type: 'FIND_OVERLAPPING'; elements: CanvasElement[]; targetId: string }
  | { type: 'SORT_BY_DEPTH'; elements: CanvasElement[] };

type WorkerResponse =
  | { type: 'CULL_RESULT'; visibleIds: string[] }
  | { type: 'BOUNDS_RESULT'; bounds: { x: number; y: number; width: number; height: number } | null }
  | { type: 'OVERLAPPING_RESULT'; overlappingIds: string[] }
  | { type: 'SORTED_RESULT'; sortedElements: CanvasElement[] }
  | { type: 'ERROR'; message: string };

/**
 * Check if an element is within the viewport bounds
 */
function isInViewport(element: CanvasElement, viewport: ViewportBounds, padding: number): boolean {
  const elementBounds = getElementBounds(element);

  return !(
    elementBounds.x + elementBounds.width < viewport.x - padding ||
    elementBounds.x > viewport.x + viewport.width + padding ||
    elementBounds.y + elementBounds.height < viewport.y - padding ||
    elementBounds.y > viewport.y + viewport.height + padding
  );
}

/**
 * Get the bounding box of an element
 */
function getElementBounds(element: CanvasElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let width = 0;
  let height = 0;

  switch (element.type) {
    case 'sticker':
      width = element.width * element.scaleX;
      height = element.height * element.scaleY;
      break;
    case 'text':
      // Approximate text bounds (real bounds would need font metrics)
      width = (element.width ?? 200) * element.scaleX;
      height = element.fontSize * element.scaleY * 1.5;
      break;
    case 'shape':
      switch (element.shapeType) {
        case 'rect':
          width = (element.width ?? 100) * element.scaleX;
          height = (element.height ?? 100) * element.scaleY;
          break;
        case 'circle':
          width = height = (element.radius ?? 50) * 2 * Math.max(element.scaleX, element.scaleY);
          break;
        case 'ellipse':
          width = (element.radiusX ?? 60) * 2 * element.scaleX;
          height = (element.radiusY ?? 40) * 2 * element.scaleY;
          break;
        case 'star':
        case 'polygon':
          width = height = (element.outerRadius ?? element.radius ?? 50) * 2 * Math.max(element.scaleX, element.scaleY);
          break;
        case 'line':
          if (element.points && element.points.length >= 4) {
            const [x1, y1, x2, y2] = element.points;
            width = Math.abs((x2 ?? 0) - (x1 ?? 0)) * element.scaleX;
            height = Math.abs((y2 ?? 0) - (y1 ?? 0)) * element.scaleY;
          }
          break;
      }
      break;
  }

  return {
    x: element.x,
    y: element.y,
    width,
    height,
  };
}

/**
 * Check if two elements overlap
 */
function doElementsOverlap(a: CanvasElement, b: CanvasElement): boolean {
  const boundsA = getElementBounds(a);
  const boundsB = getElementBounds(b);

  return !(
    boundsA.x + boundsA.width < boundsB.x ||
    boundsA.x > boundsB.x + boundsB.width ||
    boundsA.y + boundsA.height < boundsB.y ||
    boundsA.y > boundsB.y + boundsB.height
  );
}

/**
 * Calculate combined bounds of all elements
 */
function calculateAllBounds(
  elements: CanvasElement[]
): { x: number; y: number; width: number; height: number } | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const element of elements) {
    const bounds = getElementBounds(element);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'CULL_ELEMENTS': {
        const visibleIds = message.elements
          .filter((element) => isInViewport(element, message.viewport, message.padding))
          .map((e) => e.id);

        self.postMessage({ type: 'CULL_RESULT', visibleIds } as WorkerResponse);
        break;
      }

      case 'CALCULATE_BOUNDS': {
        const bounds = calculateAllBounds(message.elements);
        self.postMessage({ type: 'BOUNDS_RESULT', bounds } as WorkerResponse);
        break;
      }

      case 'FIND_OVERLAPPING': {
        const target = message.elements.find((e) => e.id === message.targetId);
        if (!target) {
          self.postMessage({ type: 'OVERLAPPING_RESULT', overlappingIds: [] } as WorkerResponse);
          break;
        }

        const overlappingIds = message.elements
          .filter((e) => e.id !== message.targetId && doElementsOverlap(target, e))
          .map((e) => e.id);

        self.postMessage({ type: 'OVERLAPPING_RESULT', overlappingIds } as WorkerResponse);
        break;
      }

      case 'SORT_BY_DEPTH': {
        const sortedElements = [...message.elements].sort((a, b) => a.zIndex - b.zIndex);
        self.postMessage({ type: 'SORTED_RESULT', sortedElements } as WorkerResponse);
        break;
      }

      default:
        self.postMessage({
          type: 'ERROR',
          message: 'Unknown message type',
        } as WorkerResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    } as WorkerResponse);
  }
};

export {};
