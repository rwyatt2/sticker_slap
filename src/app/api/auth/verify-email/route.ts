import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailToken } from '@/server/tokens';
import { sendWelcomeEmail } from '@/server/email';
import { withRateLimit } from '@/server/rate-limit';
import { db } from '@/server/db';

export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
          return NextResponse.redirect(
            new URL('/auth/error?error=MissingToken', request.url)
          );
        }

        const result = await verifyEmailToken(token);

        if (!result.success) {
          return NextResponse.redirect(
            new URL(
              `/auth/error?error=${encodeURIComponent(result.error || 'InvalidToken')}`,
              request.url
            )
          );
        }

        // Get user to send welcome email
        if (result.email) {
          const user = await db.user.findUnique({
            where: { email: result.email },
            select: { name: true, email: true },
          });

          if (user) {
            await sendWelcomeEmail(user.email, user.name || 'there');
          }
        }

        // Redirect to success page
        return NextResponse.redirect(
          new URL('/auth/verified?success=true', request.url)
        );
      } catch (error) {
        console.error('Email verification error:', error);
        return NextResponse.redirect(
          new URL('/auth/error?error=VerificationFailed', request.url)
        );
      }
    },
    'email-verification'
  );
}

/**
 * POST endpoint to resend verification email
 */
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();
        const { email } = body;

        if (!email) {
          return NextResponse.json(
            { success: false, message: 'Email is required' },
            { status: 400 }
          );
        }

        // Check if user exists and is not verified
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true, email: true, emailVerified: true },
        });

        // Always return success to prevent email enumeration
        if (!user || user.emailVerified) {
          return NextResponse.json(
            {
              success: true,
              message:
                'If your email is registered and not verified, you will receive a verification email shortly.',
            },
            { status: 200 }
          );
        }

        // Import here to avoid circular dependency
        const { createEmailVerificationToken } = await import('@/server/tokens');
        const { sendVerificationEmail } = await import('@/server/email');

        // Create new token and send email
        const token = await createEmailVerificationToken(user.email);
        await sendVerificationEmail(user.email, token);

        return NextResponse.json(
          {
            success: true,
            message:
              'If your email is registered and not verified, you will receive a verification email shortly.',
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('Resend verification error:', error);
        return NextResponse.json(
          {
            success: false,
            message: 'An error occurred. Please try again.',
          },
          { status: 500 }
        );
      }
    },
    'email-verification'
  );
}
