/**
 * Input sanitization utilities for XSS protection
 *
 * Note: For server-side rendering and API routes, we use a lightweight
 * sanitization approach. For client-side user-generated content, DOMPurify
 * should be used directly in components.
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS attacks
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags from a string
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe display (escape HTML and trim)
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return escapeHtml(str.trim());
}

/**
 * Sanitize user input for database storage
 * Removes null bytes and normalizes whitespace
 */
export function sanitizeInput(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  return email.toLowerCase().trim().slice(0, 254); // Max email length per RFC 5321
}

/**
 * Sanitize a URL - validates and returns only safe URLs
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

/**
 * Check if a string contains potential SQL injection patterns
 * Note: Prisma already handles SQL injection through parameterized queries,
 * but this provides an additional layer of detection for logging/monitoring
 */
export function containsSqlInjection(str: string): boolean {
  if (typeof str !== 'string') {
    return false;
  }

  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
    /(--)/, // SQL comment
    /(;)/, // Statement terminator
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i, // OR 1=1 pattern
    /(\/\*|\*\/)/, // Block comments
    /(\b(EXEC|EXECUTE|SP_|XP_)\b)/i, // Stored procedures
  ];

  return patterns.some((pattern) => pattern.test(str));
}

/**
 * Log potential injection attempts (for monitoring)
 */
export function logSuspiciousInput(input: string, context: string): void {
  if (containsSqlInjection(input)) {
    console.warn('[SECURITY] Potential SQL injection detected', {
      context,
      timestamp: new Date().toISOString(),
      // Don't log the actual input in production to avoid log injection
      inputLength: input.length,
    });
  }
}
