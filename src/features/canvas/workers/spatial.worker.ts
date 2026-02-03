/**
 * Web Worker for spatial indexing and collision detection
 * Handles heavy computations in a separate thread
 */

import type { CanvasElement, ViewportBounds } from '@/types/canvas';

// R-tree implementation for worker
interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  element: CanvasElement;
}

// Simple R-tree implementation for the worker
class WorkerRTree {
  private items: SpatialItem[] = [];
  private itemMap: Map<string, SpatialItem> = new Map();

  clear(): void {
    this.items = [];
    this.itemMap.clear();
  }

  load(elements: CanvasElement[]): void {
    this.clear();
    this.items = elements.map((element) => {
      const bounds = this.getElementBounds(element);
      const item: SpatialItem = {
        ...bounds,
        id: element.id,
        element,
      };
      this.itemMap.set(element.id, item);
      return item;
    });
  }

  getElementBounds(element: CanvasElement): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let width = 0;
    let height = 0;

    switch (element.type) {
      case 'sticker':
        width = element.width * element.scaleX;
        height = element.height * element.scaleY;
        break;
      case 'text':
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
            width = height =
              (element.outerRadius ?? element.radius ?? 50) *
              2 *
              Math.max(element.scaleX, element.scaleY);
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

    // Account for rotation
    if (element.rotation !== 0) {
      const angle = (element.rotation * Math.PI) / 180;
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const rotatedWidth = width * cos + height * sin;
      const rotatedHeight = width * sin + height * cos;
      width = rotatedWidth;
      height = rotatedHeight;
    }

    return {
      minX: element.x,
      minY: element.y,
      maxX: element.x + width,
      maxY: element.y + height,
    };
  }

  search(bounds: { minX: number; minY: number; maxX: number; maxY: number }): SpatialItem[] {
    return this.items.filter(
      (item) =>
        item.maxX >= bounds.minX &&
        item.minX <= bounds.maxX &&
        item.maxY >= bounds.minY &&
        item.minY <= bounds.maxY
    );
  }

  all(): SpatialItem[] {
    return this.items;
  }

  get(id: string): SpatialItem | undefined {
    return this.itemMap.get(id);
  }
}

// Global R-tree instance
const rtree = new WorkerRTree();

// Message types
type WorkerMessage =
  | { type: 'LOAD_ELEMENTS'; elements: CanvasElement[] }
  | { type: 'QUERY_VIEWPORT'; viewport: ViewportBounds; padding: number; zoom: number }
  | { type: 'FIND_COLLISIONS'; elementId: string }
  | { type: 'QUERY_POINT'; x: number; y: number }
  | { type: 'QUERY_REGION'; bounds: { minX: number; minY: number; maxX: number; maxY: number } }
  | { type: 'GET_BOUNDS' }
  | { type: 'SORT_BY_DEPTH'; elements: CanvasElement[] }
  | { type: 'CALCULATE_SNAP'; elementId: string; gridSize: number }
  | { type: 'GET_VISIBLE_REGIONS'; viewport: ViewportBounds; cellSize: number };

type WorkerResponse =
  | { type: 'LOADED'; count: number }
  | { type: 'VIEWPORT_RESULT'; visibleIds: string[]; count: number }
  | { type: 'COLLISION_RESULT'; collisionIds: string[] }
  | { type: 'POINT_RESULT'; elementIds: string[] }
  | { type: 'REGION_RESULT'; elements: CanvasElement[] }
  | { type: 'BOUNDS_RESULT'; bounds: { minX: number; minY: number; maxX: number; maxY: number } | null }
  | { type: 'SORTED_RESULT'; elements: CanvasElement[] }
  | { type: 'SNAP_RESULT'; snapX: number; snapY: number; snappedToGrid: boolean }
  | { type: 'REGIONS_RESULT'; regions: { x: number; y: number; width: number; height: number }[] }
  | { type: 'ERROR'; message: string };

/**
 * Calculate which regions are visible and should be loaded
 */
function getVisibleRegions(
  viewport: ViewportBounds,
  cellSize: number
): { x: number; y: number; width: number; height: number }[] {
  const regions: { x: number; y: number; width: number; height: number }[] = [];

  const startX = Math.floor(viewport.x / cellSize) * cellSize;
  const startY = Math.floor(viewport.y / cellSize) * cellSize;
  const endX = Math.ceil((viewport.x + viewport.width) / cellSize) * cellSize;
  const endY = Math.ceil((viewport.y + viewport.height) / cellSize) * cellSize;

  for (let x = startX; x < endX; x += cellSize) {
    for (let y = startY; y < endY; y += cellSize) {
      regions.push({ x, y, width: cellSize, height: cellSize });
    }
  }

  return regions;
}

/**
 * Calculate snap position to grid
 */
function calculateSnap(
  element: CanvasElement,
  gridSize: number
): { snapX: number; snapY: number; snappedToGrid: boolean } {
  const snapX = Math.round(element.x / gridSize) * gridSize;
  const snapY = Math.round(element.y / gridSize) * gridSize;
  const snappedToGrid =
    Math.abs(element.x - snapX) < gridSize / 4 &&
    Math.abs(element.y - snapY) < gridSize / 4;

  return { snapX, snapY, snappedToGrid };
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'LOAD_ELEMENTS': {
        rtree.load(message.elements);
        self.postMessage({ type: 'LOADED', count: message.elements.length } as WorkerResponse);
        break;
      }

      case 'QUERY_VIEWPORT': {
        const { viewport, padding, zoom } = message;
        const minScreenSize = zoom < 0.3 ? 5 : 1; // Skip tiny elements at low zoom

        const results = rtree.search({
          minX: viewport.x - padding,
          minY: viewport.y - padding,
          maxX: viewport.x + viewport.width + padding,
          maxY: viewport.y + viewport.height + padding,
        });

        // Filter out elements that would be too small to see
        const visibleIds = results
          .filter((item) => {
            const width = item.maxX - item.minX;
            const height = item.maxY - item.minY;
            const screenSize = Math.max(width, height) * zoom;
            return screenSize >= minScreenSize;
          })
          .map((item) => item.id);

        self.postMessage({
          type: 'VIEWPORT_RESULT',
          visibleIds,
          count: visibleIds.length,
        } as WorkerResponse);
        break;
      }

      case 'FIND_COLLISIONS': {
        const item = rtree.get(message.elementId);
        if (!item) {
          self.postMessage({ type: 'COLLISION_RESULT', collisionIds: [] } as WorkerResponse);
          break;
        }

        const collisions = rtree.search(item).filter((r) => r.id !== message.elementId);
        self.postMessage({
          type: 'COLLISION_RESULT',
          collisionIds: collisions.map((c) => c.id),
        } as WorkerResponse);
        break;
      }

      case 'QUERY_POINT': {
        const results = rtree.search({
          minX: message.x,
          minY: message.y,
          maxX: message.x,
          maxY: message.y,
        });
        self.postMessage({
          type: 'POINT_RESULT',
          elementIds: results.map((r) => r.id),
        } as WorkerResponse);
        break;
      }

      case 'QUERY_REGION': {
        const results = rtree.search(message.bounds);
        self.postMessage({
          type: 'REGION_RESULT',
          elements: results.map((r) => r.element),
        } as WorkerResponse);
        break;
      }

      case 'GET_BOUNDS': {
        const items = rtree.all();
        if (items.length === 0) {
          self.postMessage({ type: 'BOUNDS_RESULT', bounds: null } as WorkerResponse);
          break;
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const item of items) {
          minX = Math.min(minX, item.minX);
          minY = Math.min(minY, item.minY);
          maxX = Math.max(maxX, item.maxX);
          maxY = Math.max(maxY, item.maxY);
        }

        self.postMessage({
          type: 'BOUNDS_RESULT',
          bounds: { minX, minY, maxX, maxY },
        } as WorkerResponse);
        break;
      }

      case 'SORT_BY_DEPTH': {
        const sorted = [...message.elements].sort((a, b) => a.zIndex - b.zIndex);
        self.postMessage({ type: 'SORTED_RESULT', elements: sorted } as WorkerResponse);
        break;
      }

      case 'CALCULATE_SNAP': {
        const item = rtree.get(message.elementId);
        if (!item) {
          self.postMessage({
            type: 'SNAP_RESULT',
            snapX: 0,
            snapY: 0,
            snappedToGrid: false,
          } as WorkerResponse);
          break;
        }

        const snapResult = calculateSnap(item.element, message.gridSize);
        self.postMessage({ type: 'SNAP_RESULT', ...snapResult } as WorkerResponse);
        break;
      }

      case 'GET_VISIBLE_REGIONS': {
        const regions = getVisibleRegions(message.viewport, message.cellSize);
        self.postMessage({ type: 'REGIONS_RESULT', regions } as WorkerResponse);
        break;
      }

      default:
        self.postMessage({
          type: 'ERROR',
          message: `Unknown message type: ${(message as { type: string }).type}`,
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
