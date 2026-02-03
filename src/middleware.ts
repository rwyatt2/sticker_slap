import { auth } from '@/server/auth.config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityHeaders, apiSecurityHeaders, getCorsHeaders } from '@/lib/security-headers';

/**
 * Route configuration for authentication and authorization
 */
const routeConfig = {
  // Routes that require authentication
  protected: ['/dashboard', '/projects', '/settings', '/editor'],
  // Routes that should redirect to dashboard if authenticated
  auth: ['/auth/signin', '/auth/signup', '/auth/forgot-password'],
  // Routes that require admin role
  admin: ['/admin', '/api/admin'],
  // API routes that require authentication
  protectedApi: ['/api/projects', '/api/stickers', '/api/upload', '/api/user'],
  // Public API routes (no auth required)
  publicApi: [
    '/api/auth',
    '/api/health',
  ],
};

/**
 * Check if a pathname matches any route in the list
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some((route) => pathname.startsWith(route));
}

/**
 * Check if the request is for an API route
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api');
}

/**
 * Apply security headers to response
 */
function applyHeaders(response: NextResponse, isApi: boolean): NextResponse {
  const headers = isApi ? apiSecurityHeaders : securityHeaders;
  
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Handle CORS for API routes
 */
function handleCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin || undefined);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  return response;
}

/**
 * Main middleware function
 */
export default auth(async (req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isAuthenticated = !!req.auth;
  const userRole = req.auth?.user?.role;
  const emailVerified = req.auth?.user?.emailVerified;
  const isApi = isApiRoute(pathname);

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS' && isApi) {
    const response = new NextResponse(null, { status: 204 });
    return handleCors(req, applyHeaders(response, true));
  }

  // ============================================================================
  // API ROUTE PROTECTION
  // ============================================================================
  if (isApi) {
    // Skip auth check for public API routes
    if (matchesRoute(pathname, routeConfig.publicApi)) {
      const response = NextResponse.next();
      return handleCors(req, applyHeaders(response, true));
    }

    // Protected API routes require authentication
    if (matchesRoute(pathname, routeConfig.protectedApi)) {
      if (!isAuthenticated) {
        return applyHeaders(
          NextResponse.json(
            { success: false, message: 'Unauthorized' },
            { status: 401 }
          ),
          true
        );
      }

      // Admin API routes require admin role
      if (matchesRoute(pathname, routeConfig.admin)) {
        if (userRole !== 'ADMIN') {
          return applyHeaders(
            NextResponse.json(
              { success: false, message: 'Forbidden' },
              { status: 403 }
            ),
            true
          );
        }
      }
    }

    const response = NextResponse.next();
    return handleCors(req, applyHeaders(response, true));
  }

  // ============================================================================
  // PAGE ROUTE PROTECTION
  // ============================================================================

  // Check if the route requires authentication
  const isProtectedRoute = matchesRoute(pathname, routeConfig.protected);
  const isAuthRoute = matchesRoute(pathname, routeConfig.auth);
  const isAdminRoute = matchesRoute(pathname, routeConfig.admin);

  // Redirect unauthenticated users from protected routes
  if ((isProtectedRoute || isAdminRoute) && !isAuthenticated) {
    const redirectUrl = new URL('/auth/signin', nextUrl.origin);
    redirectUrl.searchParams.set('callbackUrl', pathname);
    return applyHeaders(NextResponse.redirect(redirectUrl), false);
  }

  // Check admin access
  if (isAdminRoute && userRole !== 'ADMIN') {
    // Redirect non-admin users to dashboard with error
    const redirectUrl = new URL('/dashboard', nextUrl.origin);
    redirectUrl.searchParams.set('error', 'AccessDenied');
    return applyHeaders(NextResponse.redirect(redirectUrl), false);
  }

  // Check email verification for protected routes (optional, can be enabled per route)
  // Uncomment below if you want to require email verification for protected routes
  /*
  if (isProtectedRoute && isAuthenticated && !emailVerified) {
    const redirectUrl = new URL('/auth/verify-request', nextUrl.origin);
    redirectUrl.searchParams.set('email', req.auth?.user?.email || '');
    return applyHeaders(NextResponse.redirect(redirectUrl), false);
  }
  */

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && isAuthenticated) {
    return applyHeaders(
      NextResponse.redirect(new URL('/dashboard', nextUrl.origin)),
      false
    );
  }

  // Continue with request and apply security headers
  return applyHeaders(NextResponse.next(), false);
});

/**
 * Matcher configuration
 * Excludes static files, images, and other assets
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     * - Static files (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
