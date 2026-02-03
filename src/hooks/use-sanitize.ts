'use client';

import { useCallback, useMemo } from 'react';

/**
 * Client-side sanitization hook using DOMPurify
 *
 * Note: DOMPurify must be installed: npm install dompurify @types/dompurify
 *
 * Usage:
 * ```tsx
 * const { sanitizeHtml, sanitizeText } = useSanitize();
 * const safeHtml = sanitizeHtml(userInput);
 * ```
 */
export function useSanitize() {
  /**
   * Sanitize HTML content (allows safe HTML tags)
   */
  const sanitizeHtml = useCallback(async (dirty: string): Promise<string> => {
    if (typeof window === 'undefined') {
      return dirty;
    }

    try {
      const DOMPurify = (await import('dompurify')).default;
      return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
          'b',
          'i',
          'em',
          'strong',
          'a',
          'p',
          'br',
          'ul',
          'ol',
          'li',
          'span',
          'div',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'blockquote',
          'code',
          'pre',
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id'],
        ALLOW_DATA_ATTR: false,
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input'],
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
      });
    } catch {
      // Fallback to basic escaping if DOMPurify fails to load
      return escapeHtmlFallback(dirty);
    }
  }, []);

  /**
   * Sanitize text content (strips all HTML)
   */
  const sanitizeText = useCallback(async (dirty: string): Promise<string> => {
    if (typeof window === 'undefined') {
      return dirty;
    }

    try {
      const DOMPurify = (await import('dompurify')).default;
      return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    } catch {
      return stripHtmlFallback(dirty);
    }
  }, []);

  /**
   * Synchronous HTML escape (safe for SSR)
   */
  const escapeHtml = useCallback((str: string): string => {
    return escapeHtmlFallback(str);
  }, []);

  /**
   * Synchronous HTML strip (safe for SSR)
   */
  const stripHtml = useCallback((str: string): string => {
    return stripHtmlFallback(str);
  }, []);

  return {
    sanitizeHtml,
    sanitizeText,
    escapeHtml,
    stripHtml,
  };
}

/**
 * Fallback HTML escape function
 */
function escapeHtmlFallback(str: string): string {
  if (typeof str !== 'string') return '';

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Fallback HTML strip function
 */
function stripHtmlFallback(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Hook for creating a memoized sanitized value
 */
export function useSanitizedValue(value: string, type: 'html' | 'text' = 'text'): string {
  const { escapeHtml, stripHtml } = useSanitize();

  return useMemo(() => {
    if (type === 'html') {
      // For HTML, use synchronous escape as fallback
      // Full sanitization should be done async
      return escapeHtml(value);
    }
    return stripHtml(value);
  }, [value, type, escapeHtml, stripHtml]);
}
