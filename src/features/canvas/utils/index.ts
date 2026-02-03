/**
 * Canvas utilities barrel export
 */

export {
  SpatialIndex,
  createRegions,
  getAdjacentRegions,
  distanceToViewport,
} from './spatial-index';
export type { SpatialItem } from './spatial-index';

export { ImageCache, getImageCache, getLodLevel as getImageLodLevel } from './image-cache';

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
} from './lod-system';
export type { LodLevel, LodSettings } from './lod-system';
