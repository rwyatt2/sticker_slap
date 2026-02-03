/**
 * R-tree based spatial indexing for efficient collision detection and viewport culling
 * Uses rbush for high-performance spatial queries
 */

import RBush from 'rbush';
import type { CanvasElement, ViewportBounds } from '@/types/canvas';

/**
 * Item stored in the R-tree spatial index
 */
export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  element: CanvasElement;
}

/**
 * R-tree implementation for canvas elements
 */
export class SpatialIndex {
  private tree: RBush<SpatialItem>;
  private itemMap: Map<string, SpatialItem> = new Map();

  constructor(maxEntries = 9) {
    this.tree = new RBush<SpatialItem>(maxEntries);
  }

  /**
   * Get bounding box for a canvas element
   */
  static getElementBounds(element: CanvasElement): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
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
              (element.outerRadius ?? element.radius ?? 50) * 2 * Math.max(element.scaleX, element.scaleY);
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

    // Account for rotation (use bounding box of rotated element)
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
      width,
      height,
    };
  }

  /**
   * Insert a single element into the index
   */
  insert(element: CanvasElement): void {
    // Remove existing item if present
    this.remove(element.id);

    const bounds = SpatialIndex.getElementBounds(element);
    const item: SpatialItem = {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      id: element.id,
      element,
    };

    this.tree.insert(item);
    this.itemMap.set(element.id, item);
  }

  /**
   * Remove an element from the index by ID
   */
  remove(id: string): boolean {
    const item = this.itemMap.get(id);
    if (item) {
      this.tree.remove(item, (a, b) => a.id === b.id);
      this.itemMap.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Update an existing element
   */
  update(element: CanvasElement): void {
    this.insert(element);
  }

  /**
   * Bulk load elements (much faster than individual inserts)
   */
  load(elements: CanvasElement[]): void {
    this.clear();
    const items: SpatialItem[] = elements.map((element) => {
      const bounds = SpatialIndex.getElementBounds(element);
      return {
        minX: bounds.minX,
        minY: bounds.minY,
        maxX: bounds.maxX,
        maxY: bounds.maxY,
        id: element.id,
        element,
      };
    });

    this.tree.load(items);
    items.forEach((item) => this.itemMap.set(item.id, item));
  }

  /**
   * Clear all elements from the index
   */
  clear(): void {
    this.tree.clear();
    this.itemMap.clear();
  }

  /**
   * Search for elements within a bounding box
   */
  search(bounds: { minX: number; minY: number; maxX: number; maxY: number }): SpatialItem[] {
    return this.tree.search(bounds);
  }

  /**
   * Get elements visible in viewport with optional padding
   */
  queryViewport(viewport: ViewportBounds, padding = 0): CanvasElement[] {
    const results = this.tree.search({
      minX: viewport.x - padding,
      minY: viewport.y - padding,
      maxX: viewport.x + viewport.width + padding,
      maxY: viewport.y + viewport.height + padding,
    });
    return results.map((r) => r.element);
  }

  /**
   * Get visible element IDs (more efficient for large canvases)
   */
  queryViewportIds(viewport: ViewportBounds, padding = 0): string[] {
    const results = this.tree.search({
      minX: viewport.x - padding,
      minY: viewport.y - padding,
      maxX: viewport.x + viewport.width + padding,
      maxY: viewport.y + viewport.height + padding,
    });
    return results.map((r) => r.id);
  }

  /**
   * Find all elements that collide with a given element
   */
  findCollisions(elementId: string): CanvasElement[] {
    const item = this.itemMap.get(elementId);
    if (!item) return [];

    return this.tree
      .search(item)
      .filter((r) => r.id !== elementId)
      .map((r) => r.element);
  }

  /**
   * Find elements at a point (for hit testing)
   */
  queryPoint(x: number, y: number): CanvasElement[] {
    const results = this.tree.search({
      minX: x,
      minY: y,
      maxX: x,
      maxY: y,
    });
    return results.map((r) => r.element);
  }

  /**
   * Find nearest elements to a point
   */
  queryRadius(x: number, y: number, radius: number): CanvasElement[] {
    const results = this.tree.search({
      minX: x - radius,
      minY: y - radius,
      maxX: x + radius,
      maxY: y + radius,
    });
    return results.map((r) => r.element);
  }

  /**
   * Get all elements in the index
   */
  all(): CanvasElement[] {
    return this.tree.all().map((r) => r.element);
  }

  /**
   * Get the total bounds of all elements
   */
  getBounds(): { minX: number; minY: number; maxX: number; maxY: number } | null {
    const items = this.tree.all();
    if (items.length === 0) return null;

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

    return { minX, minY, maxX, maxY };
  }

  /**
   * Get the number of elements in the index
   */
  get size(): number {
    return this.itemMap.size;
  }

  /**
   * Serialize the index for transfer to worker
   */
  toJSON(): { elements: CanvasElement[] } {
    return { elements: this.all() };
  }

  /**
   * Create index from serialized data
   */
  static fromJSON(data: { elements: CanvasElement[] }): SpatialIndex {
    const index = new SpatialIndex();
    index.load(data.elements);
    return index;
  }
}

/**
 * Create regions for progressive loading
 * Divides the canvas into grid cells for chunked loading
 */
export function createRegions(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  cellSize: number
): { x: number; y: number; width: number; height: number }[] {
  const regions: { x: number; y: number; width: number; height: number }[] = [];

  const startX = Math.floor(bounds.minX / cellSize) * cellSize;
  const startY = Math.floor(bounds.minY / cellSize) * cellSize;
  const endX = Math.ceil(bounds.maxX / cellSize) * cellSize;
  const endY = Math.ceil(bounds.maxY / cellSize) * cellSize;

  for (let x = startX; x < endX; x += cellSize) {
    for (let y = startY; y < endY; y += cellSize) {
      regions.push({
        x,
        y,
        width: cellSize,
        height: cellSize,
      });
    }
  }

  return regions;
}

/**
 * Calculate distance between viewport center and a region
 */
export function distanceToViewport(
  region: { x: number; y: number; width: number; height: number },
  viewport: ViewportBounds
): number {
  const viewportCenterX = viewport.x + viewport.width / 2;
  const viewportCenterY = viewport.y + viewport.height / 2;
  const regionCenterX = region.x + region.width / 2;
  const regionCenterY = region.y + region.height / 2;

  return Math.sqrt(
    Math.pow(viewportCenterX - regionCenterX, 2) + Math.pow(viewportCenterY - regionCenterY, 2)
  );
}

/**
 * Get regions to prefetch based on viewport position
 */
export function getAdjacentRegions(
  viewport: ViewportBounds,
  cellSize: number,
  depth = 1
): { x: number; y: number; width: number; height: number }[] {
  const regions: { x: number; y: number; width: number; height: number }[] = [];

  const startX = Math.floor(viewport.x / cellSize) * cellSize - cellSize * depth;
  const startY = Math.floor(viewport.y / cellSize) * cellSize - cellSize * depth;
  const endX = Math.ceil((viewport.x + viewport.width) / cellSize) * cellSize + cellSize * depth;
  const endY = Math.ceil((viewport.y + viewport.height) / cellSize) * cellSize + cellSize * depth;

  for (let x = startX; x < endX; x += cellSize) {
    for (let y = startY; y < endY; y += cellSize) {
      regions.push({
        x,
        y,
        width: cellSize,
        height: cellSize,
      });
    }
  }

  return regions;
}
