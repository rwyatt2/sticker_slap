// Components
export { Canvas } from './components/canvas';
export { InfiniteCanvas } from './components/infinite-canvas';
export { StickerNode } from './components/sticker-node';
export { TextNode } from './components/text-node';
export { ShapeNode } from './components/shape-node';
export { SelectionBox } from './components/selection-box';
export { TransformControls } from './components/transform-controls';
export { MiniMap } from './components/mini-map';

// Store
export { useCanvasStore } from './store/canvas-store';

// Utilities
export { SpatialIndex, createRegions, getAdjacentRegions, distanceToViewport } from './utils/spatial-index';
export { ImageCache, getImageCache, getLodLevel as getImageLodLevel } from './utils/image-cache';
export {
  getLodLevel,
  getLodSettings,
  shouldRenderElement,
  getElementSize,
  getLodImageUrl,
  getLodRenderProps,
  getLodTextContent,
  shouldUseSimplifiedRendering,
  getLodBatchSize,
  LOD_SETTINGS,
} from './utils/lod-system';
export type { LodLevel, LodSettings } from './utils/lod-system';
export type { SpatialItem } from './utils/spatial-index';
