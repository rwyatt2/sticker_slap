/**
 * Level of Detail (LOD) system for zoom-based quality optimization
 * Provides different rendering quality based on zoom level
 */

import type { CanvasElement, StickerElement } from '@/types/canvas';

/**
 * LOD level definitions
 */
export type LodLevel = 'ultra-low' | 'low' | 'medium' | 'high' | 'ultra-high';

export interface LodSettings {
  /** Minimum zoom for this LOD level */
  minZoom: number;
  /** Maximum zoom for this LOD level */
  maxZoom: number;
  /** Image quality (0-1) */
  imageQuality: number;
  /** Maximum image dimension */
  maxImageSize: number;
  /** Whether to show shadows */
  showShadows: boolean;
  /** Whether to show filters */
  showFilters: boolean;
  /** Whether to show text details */
  showTextDetails: boolean;
  /** Stroke quality multiplier */
  strokeQuality: number;
  /** Whether to use anti-aliasing */
  antiAliasing: boolean;
  /** Skip rendering elements smaller than this (in pixels) */
  minRenderSize: number;
}

/**
 * Default LOD configuration
 */
export const LOD_SETTINGS: Record<LodLevel, LodSettings> = {
  'ultra-low': {
    minZoom: 0,
    maxZoom: 0.1,
    imageQuality: 0.1,
    maxImageSize: 50,
    showShadows: false,
    showFilters: false,
    showTextDetails: false,
    strokeQuality: 0.25,
    antiAliasing: false,
    minRenderSize: 10,
  },
  low: {
    minZoom: 0.1,
    maxZoom: 0.3,
    imageQuality: 0.25,
    maxImageSize: 128,
    showShadows: false,
    showFilters: false,
    showTextDetails: false,
    strokeQuality: 0.5,
    antiAliasing: false,
    minRenderSize: 5,
  },
  medium: {
    minZoom: 0.3,
    maxZoom: 0.7,
    imageQuality: 0.5,
    maxImageSize: 512,
    showShadows: false,
    showFilters: true,
    showTextDetails: true,
    strokeQuality: 0.75,
    antiAliasing: true,
    minRenderSize: 2,
  },
  high: {
    minZoom: 0.7,
    maxZoom: 2,
    imageQuality: 0.85,
    maxImageSize: 1024,
    showShadows: true,
    showFilters: true,
    showTextDetails: true,
    strokeQuality: 1,
    antiAliasing: true,
    minRenderSize: 0.5,
  },
  'ultra-high': {
    minZoom: 2,
    maxZoom: Infinity,
    imageQuality: 1,
    maxImageSize: 2048,
    showShadows: true,
    showFilters: true,
    showTextDetails: true,
    strokeQuality: 1,
    antiAliasing: true,
    minRenderSize: 0,
  },
};

/**
 * Get LOD level for a given zoom value
 */
export function getLodLevel(zoom: number): LodLevel {
  if (zoom < 0.1) return 'ultra-low';
  if (zoom < 0.3) return 'low';
  if (zoom < 0.7) return 'medium';
  if (zoom < 2) return 'high';
  return 'ultra-high';
}

/**
 * Get LOD settings for a given zoom value
 */
export function getLodSettings(zoom: number): LodSettings {
  return LOD_SETTINGS[getLodLevel(zoom)];
}

/**
 * Check if an element should be rendered at current LOD
 */
export function shouldRenderElement(
  element: CanvasElement,
  zoom: number,
  _viewport: { width: number; height: number }
): boolean {
  const settings = getLodSettings(zoom);
  const { width, height } = getElementSize(element);

  // Calculate screen size
  const screenWidth = width * zoom;
  const screenHeight = height * zoom;
  const screenSize = Math.max(screenWidth, screenHeight);

  return screenSize >= settings.minRenderSize;
}

/**
 * Get element dimensions
 */
export function getElementSize(element: CanvasElement): { width: number; height: number } {
  switch (element.type) {
    case 'sticker':
      return {
        width: element.width * element.scaleX,
        height: element.height * element.scaleY,
      };
    case 'text':
      return {
        width: (element.width ?? 200) * element.scaleX,
        height: element.fontSize * element.scaleY * 1.5,
      };
    case 'shape':
      switch (element.shapeType) {
        case 'rect':
          return {
            width: (element.width ?? 100) * element.scaleX,
            height: (element.height ?? 100) * element.scaleY,
          };
        case 'circle':
          const diameter = (element.radius ?? 50) * 2 * Math.max(element.scaleX, element.scaleY);
          return { width: diameter, height: diameter };
        case 'ellipse':
          return {
            width: (element.radiusX ?? 60) * 2 * element.scaleX,
            height: (element.radiusY ?? 40) * 2 * element.scaleY,
          };
        case 'star':
        case 'polygon':
          const size =
            (element.outerRadius ?? element.radius ?? 50) *
            2 *
            Math.max(element.scaleX, element.scaleY);
          return { width: size, height: size };
        case 'line':
          if (element.points && element.points.length >= 4) {
            const [x1, y1, x2, y2] = element.points;
            return {
              width: Math.abs((x2 ?? 0) - (x1 ?? 0)) * element.scaleX,
              height: Math.abs((y2 ?? 0) - (y1 ?? 0)) * element.scaleY,
            };
          }
          return { width: 100, height: 100 };
        default:
          return { width: 100, height: 100 };
      }
    default:
      return { width: 100, height: 100 };
  }
}

/**
 * Get image URL for LOD level
 */
export function getLodImageUrl(element: StickerElement, zoom: number): string {
  const settings = getLodSettings(zoom);
  const url = element.imageUrl;

  // If quality is full, return original URL
  if (settings.imageQuality >= 1) {
    return url;
  }

  // Check for supported CDN transformations
  try {
    const parsedUrl = new URL(url);
    const maxSize = settings.maxImageSize;
    const quality = Math.round(settings.imageQuality * 100);

    // Cloudinary
    if (parsedUrl.hostname.includes('cloudinary.com')) {
      return url.replace('/upload/', `/upload/q_${quality},w_${maxSize}/`);
    }

    // Imgix
    if (parsedUrl.hostname.includes('imgix.net')) {
      parsedUrl.searchParams.set('q', String(quality));
      parsedUrl.searchParams.set('w', String(maxSize));
      parsedUrl.searchParams.set('auto', 'format');
      return parsedUrl.toString();
    }

    // Vercel Image Optimization (Next.js)
    if (parsedUrl.pathname.startsWith('/_next/image')) {
      parsedUrl.searchParams.set('q', String(quality));
      parsedUrl.searchParams.set('w', String(maxSize));
      return parsedUrl.toString();
    }

    // For other URLs, try adding generic params (may or may not work)
    return url;
  } catch {
    return url;
  }
}

/**
 * Get optimized render properties for an element at current LOD
 */
export function getLodRenderProps(
  element: CanvasElement,
  zoom: number
): {
  shadowEnabled: boolean;
  shadowBlur: number;
  strokeWidth: number;
  perfectDrawEnabled: boolean;
  listening: boolean;
} {
  const settings = getLodSettings(zoom);
  const { width, height } = getElementSize(element);
  const screenSize = Math.max(width, height) * zoom;

  // At ultra-low LOD or very small elements, disable interaction
  const listening = screenSize >= 10;

  return {
    shadowEnabled: settings.showShadows,
    shadowBlur: settings.showShadows ? 10 : 0,
    strokeWidth:
      element.type === 'shape' ? element.strokeWidth * settings.strokeQuality : 0,
    perfectDrawEnabled: settings.antiAliasing,
    listening,
  };
}

/**
 * Get simplified text content for low LOD
 */
export function getLodTextContent(text: string, zoom: number): string {
  const level = getLodLevel(zoom);

  if (level === 'ultra-low' || level === 'low') {
    // Return first few characters or a placeholder
    if (text.length > 10) {
      return text.substring(0, 10) + '...';
    }
  }

  return text;
}

/**
 * Should use simple shapes instead of complex rendering
 */
export function shouldUseSimplifiedRendering(zoom: number): boolean {
  const level = getLodLevel(zoom);
  return level === 'ultra-low' || level === 'low';
}

/**
 * Get rendering batch size based on LOD
 * Higher LOD = smaller batches for better responsiveness
 */
export function getLodBatchSize(zoom: number): number {
  const level = getLodLevel(zoom);

  switch (level) {
    case 'ultra-low':
      return 1000;
    case 'low':
      return 500;
    case 'medium':
      return 200;
    case 'high':
      return 100;
    case 'ultra-high':
      return 50;
    default:
      return 100;
  }
}
