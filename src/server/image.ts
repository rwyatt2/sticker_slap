import sharp from 'sharp';
import { UPLOAD_CONFIG } from '@/lib/image-validation';

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha?: boolean;
  orientation?: number;
}

export interface ProcessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  stripExif?: boolean;
  convertToWebP?: boolean;
  preserveAnimation?: boolean;
}

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Get image metadata with extended info
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const metadata = await sharp(buffer).metadata();

  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'unknown',
    size: buffer.length,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
  };
}

/**
 * Validate image dimensions against max allowed
 */
export async function validateDimensions(
  buffer: Buffer,
  maxWidth = UPLOAD_CONFIG.maxDimensions.width,
  maxHeight = UPLOAD_CONFIG.maxDimensions.height
): Promise<{ valid: boolean; width: number; height: number; error?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width > maxWidth || height > maxHeight) {
      return {
        valid: false,
        width,
        height,
        error: `Image dimensions ${width}x${height} exceed maximum ${maxWidth}x${maxHeight}`,
      };
    }

    return { valid: true, width, height };
  } catch (error) {
    return {
      valid: false,
      width: 0,
      height: 0,
      error: `Failed to read image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Process and optimize an image with EXIF stripping
 */
export async function processImage(
  buffer: Buffer,
  options: ProcessOptions = {}
): Promise<{ buffer: Buffer; metadata: ImageMetadata }> {
  const {
    maxWidth = UPLOAD_CONFIG.maxDimensions.width,
    maxHeight = UPLOAD_CONFIG.maxDimensions.height,
    quality = 85,
    format,
    fit = 'inside',
    stripExif = true,
    convertToWebP = true,
    preserveAnimation = false,
  } = options;

  const inputMetadata = await sharp(buffer).metadata();

  // Handle animated GIFs specially
  const isAnimatedGif = inputMetadata.format === 'gif' && (inputMetadata.pages ?? 0) > 1;

  let pipeline = sharp(buffer, {
    animated: preserveAnimation && isAnimatedGif,
  });

  // Always rotate based on EXIF orientation first, then strip
  if (stripExif) {
    pipeline = pipeline.rotate(); // Auto-rotate based on EXIF
  }

  // Resize if needed
  if (inputMetadata.width && inputMetadata.height) {
    if (inputMetadata.width > maxWidth || inputMetadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit,
        withoutEnlargement: true,
      });
    }
  }

  // Determine output format
  let outputFormat = format;

  if (!outputFormat) {
    if (convertToWebP && !isAnimatedGif) {
      // Convert to WebP for better compression (except animated GIFs)
      outputFormat = 'webp';
    } else if (inputMetadata.format === 'jpeg' || inputMetadata.format === 'jpg') {
      outputFormat = 'jpeg';
    } else if (inputMetadata.format === 'png') {
      // Keep PNG for images with transparency
      outputFormat = inputMetadata.hasAlpha ? 'png' : 'webp';
    } else if (inputMetadata.format === 'gif') {
      // Keep GIF for animated images, convert static to WebP
      outputFormat = isAnimatedGif && preserveAnimation ? undefined : 'webp';
    } else {
      outputFormat = 'webp';
    }
  }

  // Apply format conversion
  if (outputFormat) {
    switch (outputFormat) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 6 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality, effort: 6 });
        break;
    }
  }

  // Strip EXIF data (remove all metadata except ICC profile for color accuracy)
  if (stripExif) {
    pipeline = pipeline.withMetadata({ orientation: undefined });
  }

  const processedBuffer = await pipeline.toBuffer();
  const newMetadata = await getImageMetadata(processedBuffer);

  return {
    buffer: processedBuffer,
    metadata: newMetadata,
  };
}

/**
 * Process image for optimized storage (WebP conversion + EXIF strip)
 */
export async function processImageForStorage(
  buffer: Buffer,
  originalMimeType: string
): Promise<{
  buffer: Buffer;
  metadata: ImageMetadata;
  mimeType: string;
}> {
  // SVG files don't need processing
  if (originalMimeType === 'image/svg+xml') {
    return {
      buffer,
      metadata: {
        width: 0,
        height: 0,
        format: 'svg',
        size: buffer.length,
      },
      mimeType: originalMimeType,
    };
  }

  const inputMetadata = await sharp(buffer).metadata();
  const isAnimatedGif =
    inputMetadata.format === 'gif' && (inputMetadata.pages ?? 0) > 1;

  // Process the image
  const result = await processImage(buffer, {
    maxWidth: UPLOAD_CONFIG.maxDimensions.width,
    maxHeight: UPLOAD_CONFIG.maxDimensions.height,
    stripExif: true,
    convertToWebP: !isAnimatedGif,
    preserveAnimation: isAnimatedGif,
  });

  // Determine final MIME type
  let mimeType: string;
  switch (result.metadata.format) {
    case 'webp':
      mimeType = 'image/webp';
      break;
    case 'jpeg':
    case 'jpg':
      mimeType = 'image/jpeg';
      break;
    case 'png':
      mimeType = 'image/png';
      break;
    case 'gif':
      mimeType = 'image/gif';
      break;
    case 'avif':
      mimeType = 'image/avif';
      break;
    default:
      mimeType = 'image/webp';
  }

  return {
    buffer: result.buffer,
    metadata: result.metadata,
    mimeType,
  };
}

/**
 * Generate a thumbnail
 */
export async function generateThumbnail(
  buffer: Buffer,
  options: ThumbnailOptions = { width: 200, height: 200 }
): Promise<{ buffer: Buffer; mimeType: string }> {
  const { width = 200, height = 200, quality = 80, format = 'webp' } = options;

  let pipeline = sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(width, height, {
      fit: 'cover',
      position: 'center',
    });

  let mimeType: string;

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      mimeType = 'image/jpeg';
      break;
    case 'png':
      pipeline = pipeline.png({ quality });
      mimeType = 'image/png';
      break;
    case 'webp':
    default:
      pipeline = pipeline.webp({ quality });
      mimeType = 'image/webp';
      break;
  }

  const thumbnailBuffer = await pipeline.toBuffer();

  return { buffer: thumbnailBuffer, mimeType };
}

/**
 * Convert image to different format
 */
export async function convertImage(
  buffer: Buffer,
  format: 'jpeg' | 'png' | 'webp' | 'avif',
  quality = 85
): Promise<Buffer> {
  let pipeline = sharp(buffer);

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality });
      break;
    case 'png':
      pipeline = pipeline.png({ quality });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
  }

  return pipeline.toBuffer();
}

/**
 * Extract dominant colors from an image
 */
export async function extractColors(buffer: Buffer, count = 5): Promise<string[]> {
  const { data, info } = await sharp(buffer)
    .resize(100, 100, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: Array<[number, number, number]> = [];
  for (let i = 0; i < data.length; i += info.channels) {
    pixels.push([data[i]!, data[i + 1]!, data[i + 2]!]);
  }

  // Simple k-means clustering for color extraction
  const colors = simplifyColors(pixels, count);

  return colors.map(
    ([r, g, b]) => `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  );
}

/**
 * Simple color quantization
 */
function simplifyColors(
  pixels: Array<[number, number, number]>,
  count: number
): Array<[number, number, number]> {
  // Use a simple bucket-based approach
  const buckets: Map<string, { sum: [number, number, number]; count: number }> = new Map();

  for (const [r, g, b] of pixels) {
    // Quantize to fewer colors
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.sum[0] += r;
      existing.sum[1] += g;
      existing.sum[2] += b;
      existing.count++;
    } else {
      buckets.set(key, { sum: [r, g, b], count: 1 });
    }
  }

  // Sort by frequency and take top colors
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, count);

  return sorted.map(({ sum, count }) => [
    Math.round(sum[0] / count),
    Math.round(sum[1] / count),
    Math.round(sum[2] / count),
  ]);
}

/**
 * Validate that a buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return Boolean(metadata.width && metadata.height);
  } catch {
    return false;
  }
}

/**
 * Get supported image formats
 */
export function getSupportedFormats(): string[] {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
}
