import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Create a new ratelimiter that allows 10 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: 'sticker-slap',
});

// Stricter rate limit for auth endpoints (5 attempts per 15 minutes)
const authRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'sticker-slap-auth',
});

// Rate limit for password reset requests (3 per hour)
const passwordResetRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: 'sticker-slap-password-reset',
});

// Rate limit for email verification requests (5 per hour)
const emailVerificationRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: 'sticker-slap-email-verification',
});

// Rate limit for uploads (10 per hour per user as per requirements)
const uploadRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'sticker-slap-upload',
});

export type RateLimitType = 'default' | 'auth' | 'upload' | 'password-reset' | 'email-verification';

/**
 * Get the appropriate rate limiter based on type
 */
function getRateLimiter(type: RateLimitType) {
  switch (type) {
    case 'auth':
      return authRatelimit;
    case 'upload':
      return uploadRatelimit;
    case 'password-reset':
      return passwordResetRatelimit;
    case 'email-verification':
      return emailVerificationRatelimit;
    default:
      return ratelimit;
  }
}

/**
 * Rate limit a request
 */
export async function rateLimit(
  request: NextRequest,
  type: RateLimitType = 'default'
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? '127.0.0.1';
  const limiter = getRateLimiter(type);

  const { success, limit, remaining, reset } = await limiter.limit(ip);

  return { success, limit, remaining, reset };
}

/**
 * Rate limit middleware for API routes
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  type: RateLimitType = 'default'
): Promise<NextResponse> {
  const { success, limit, remaining, reset } = await rateLimit(request, type);

  if (!success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  const response = await handler();

  // Add rate limit headers to successful responses
  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', reset.toString());

  return response;
}

/**
 * Rate limit specifically for uploads using user ID
 */
export async function rateLimitUpload(
  userId: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const { success, limit, remaining, reset } = await uploadRatelimit.limit(userId);
  return { success, limit, remaining, reset };
}
