/**
 * Security headers configuration (Helmet.js style)
 *
 * These headers provide protection against:
 * - XSS attacks
 * - Clickjacking
 * - MIME type sniffing
 * - Protocol downgrade attacks
 * - And more...
 */

/**
 * Content Security Policy directives
 */
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval needed for some React features in dev
  'style-src': ["'self'", "'unsafe-inline'"], // Inline styles needed for Tailwind
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    'https://api.github.com', // GitHub OAuth
    'https://accounts.google.com', // Google OAuth
    'https://*.upstash.io', // Upstash Redis
  ],
  'frame-src': ["'self'", 'https://accounts.google.com'],
  'frame-ancestors': ["'none'"], // Prevents clickjacking
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header value from directives
 */
function buildCSP(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Security headers configuration
 */
export const securityHeaders: Record<string, string> = {
  // Content Security Policy
  'Content-Security-Policy': buildCSP(),

  // Prevent XSS attacks
  'X-XSS-Protection': '1; mode=block',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Control how much referrer information should be included
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Control browser features
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), interest-cohort=()',

  // HTTPS enforcement (enable in production)
  ...(process.env.NODE_ENV === 'production'
    ? {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      }
    : {}),

  // Prevent DNS prefetching
  'X-DNS-Prefetch-Control': 'off',

  // Download options for IE
  'X-Download-Options': 'noopen',

  // Cross-Origin policies
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * Headers for API routes (more permissive for CORS)
 */
export const apiSecurityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  ...(process.env.NODE_ENV === 'production'
    ? {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      }
    : {}),
};

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(
  response: Response,
  isApi: boolean = false
): Response {
  const headers = new Headers(response.headers);
  const secHeaders = isApi ? apiSecurityHeaders : securityHeaders;

  Object.entries(secHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Get CSP header for specific contexts (e.g., nonce-based)
 */
export function getCSPWithNonce(nonce: string): string {
  const directives = { ...CSP_DIRECTIVES };
  directives['script-src'] = [
    ...directives['script-src'].filter((s) => s !== "'unsafe-inline'"),
    `'nonce-${nonce}'`,
  ];
  directives['style-src'] = [
    ...directives['style-src'].filter((s) => s !== "'unsafe-inline'"),
    `'nonce-${nonce}'`,
  ];

  return Object.entries(directives)
    .map(([directive, values]) => {
      if (values.length === 0) {
        return directive;
      }
      return `${directive} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * CORS headers for API routes
 */
export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    'http://localhost:3000',
  ].filter(Boolean) as string[];

  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}
