import { fileTypeFromBuffer } from 'file-type';

// Allowed MIME types and their extensions
export const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_IMAGE_TYPES;

// Configuration constants
export const UPLOAD_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxDimensions: { width: 4096, height: 4096 },
  maxUploadsPerHour: 10,
  defaultQuotaBytes: 500 * 1024 * 1024, // 500MB
} as const;


export interface ValidationResult {
  valid: boolean;
  error?: string;
  detectedType?: string;
  dimensions?: { width: number; height: number };
}

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: AllowedMimeType[];
  maxDimensions?: { width: number; height: number };
  checkMagicBytes?: boolean;
}

/**
 * Validate file extension against allowed types
 */
export function isAllowedExtension(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return false;

  for (const extensions of Object.values(ALLOWED_IMAGE_TYPES)) {
    if (extensions.some((e) => e.slice(1) === ext)) {
      return true;
    }
  }
  return false;
}

/**
 * Check magic bytes to detect actual file type
 */
function checkMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // Check JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // Check PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // Check GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    return 'image/gif';
  }

  // Check WebP (RIFF....WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Check SVG (starts with < or <?xml)
  const textStart = buffer.toString('utf8', 0, Math.min(100, buffer.length)).trim();
  if (textStart.startsWith('<?xml') || textStart.startsWith('<svg')) {
    return 'image/svg+xml';
  }

  return null;
}

/**
 * Validate MIME type matches actual file content
 */
export async function validateMimeType(
  buffer: Buffer,
  declaredType: string
): Promise<ValidationResult> {
  // Use file-type library for accurate detection
  const detected = await fileTypeFromBuffer(buffer);

  // Handle SVG separately (file-type doesn't detect it well)
  if (declaredType === 'image/svg+xml') {
    const textStart = buffer.toString('utf8', 0, Math.min(500, buffer.length)).trim();
    if (textStart.startsWith('<?xml') || textStart.startsWith('<svg')) {
      return { valid: true, detectedType: 'image/svg+xml' };
    }
    return { valid: false, error: 'Invalid SVG file content' };
  }

  // Check detected type
  if (!detected) {
    // Fallback to magic bytes check
    const magicType = checkMagicBytes(buffer);
    if (magicType && magicType === declaredType) {
      return { valid: true, detectedType: magicType };
    }
    return { valid: false, error: 'Could not detect file type' };
  }

  // Verify detected type matches declared type
  if (detected.mime !== declaredType) {
    return {
      valid: false,
      error: `File type mismatch: declared ${declaredType}, detected ${detected.mime}`,
    };
  }

  // Verify it's an allowed type
  if (!(detected.mime in ALLOWED_IMAGE_TYPES)) {
    return {
      valid: false,
      error: `File type ${detected.mime} is not allowed`,
    };
  }

  return { valid: true, detectedType: detected.mime };
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = filename.split(/[/\\]/).pop() || 'unnamed';

  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Remove leading dots and spaces
  sanitized = sanitized.replace(/^[\s.]+/, '');

  // Limit length
  if (sanitized.length > 100) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.slice(0, 100 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }

  // Fallback for empty names
  if (!sanitized || sanitized === '.') {
    sanitized = 'unnamed';
  }

  return sanitized;
}

/**
 * Check SVG for potentially malicious content
 */
export function validateSvgContent(svgContent: string): ValidationResult {
  const lowerContent = svgContent.toLowerCase();

  // Check for script tags
  if (/<script[\s>]/i.test(svgContent)) {
    return { valid: false, error: 'SVG contains script tags' };
  }

  // Check for event handlers
  const eventHandlers = [
    'onload',
    'onerror',
    'onclick',
    'onmouseover',
    'onfocus',
    'onblur',
    'onchange',
    'onsubmit',
    'onkeydown',
    'onkeyup',
    'onkeypress',
  ];
  for (const handler of eventHandlers) {
    if (lowerContent.includes(handler + '=')) {
      return { valid: false, error: `SVG contains ${handler} event handler` };
    }
  }

  // Check for javascript: URLs
  if (/javascript:/i.test(svgContent)) {
    return { valid: false, error: 'SVG contains javascript: URL' };
  }

  // Check for data: URLs with scripts
  if (/data:text\/html/i.test(svgContent)) {
    return { valid: false, error: 'SVG contains data:text/html URL' };
  }

  // Check for external references that could leak data
  if (/<use[^>]+href\s*=\s*["']http/i.test(svgContent)) {
    return { valid: false, error: 'SVG contains external use references' };
  }

  // Check for foreignObject (can contain arbitrary HTML)
  if (/<foreignobject/i.test(svgContent)) {
    return { valid: false, error: 'SVG contains foreignObject element' };
  }

  return { valid: true };
}

/**
 * Comprehensive file validation
 */
export async function validateUploadFile(
  buffer: Buffer,
  _filename: string,
  declaredType: string,
  options: FileValidationOptions = {}
): Promise<ValidationResult> {
  const {
    maxSize = UPLOAD_CONFIG.maxFileSize,
    allowedTypes = Object.keys(ALLOWED_IMAGE_TYPES) as AllowedMimeType[],
  } = options;

  // Check file size
  if (buffer.length > maxSize) {
    return {
      valid: false,
      error: `File size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  // Check if declared type is allowed
  if (!allowedTypes.includes(declaredType as AllowedMimeType)) {
    return {
      valid: false,
      error: `File type ${declaredType} is not allowed. Allowed: ${allowedTypes.join(', ')}`,
    };
  }

  // Validate MIME type matches content
  const mimeResult = await validateMimeType(buffer, declaredType);
  if (!mimeResult.valid) {
    return mimeResult;
  }

  // Additional SVG validation
  if (declaredType === 'image/svg+xml') {
    const svgContent = buffer.toString('utf8');
    const svgResult = validateSvgContent(svgContent);
    if (!svgResult.valid) {
      return svgResult;
    }
  }

  return { valid: true, detectedType: mimeResult.detectedType };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mimeType: string): string {
  const extensions = ALLOWED_IMAGE_TYPES[mimeType as AllowedMimeType];
  return extensions?.[0] || '.bin';
}
