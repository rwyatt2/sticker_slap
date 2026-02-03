import { NextRequest, NextResponse } from 'next/server';
import { createPasswordResetToken } from '@/server/tokens';
import { sendPasswordResetEmail } from '@/server/email';
import { withRateLimit } from '@/server/rate-limit';
import { passwordResetRequestSchema } from '@/lib/validation';
import { sanitizeEmail } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parsed = passwordResetRequestSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              message: 'Invalid email address',
            },
            { status: 400 }
          );
        }

        const { email } = parsed.data;
        const sanitizedEmail = sanitizeEmail(email);

        // Create password reset token (returns null if user doesn't exist)
        const token = await createPasswordResetToken(sanitizedEmail);

        // Send email if user exists
        if (token) {
          await sendPasswordResetEmail(sanitizedEmail, token);
        }

        // Always return success to prevent email enumeration
        return NextResponse.json(
          {
            success: true,
            message:
              'If an account with that email exists, you will receive a password reset link shortly.',
          },
          { status: 200 }
        );
      } catch (error) {
        console.error('Password reset request error:', error);
        return NextResponse.json(
          {
            success: false,
            message: 'An error occurred. Please try again.',
          },
          { status: 500 }
        );
      }
    },
    'password-reset'
  );
}
