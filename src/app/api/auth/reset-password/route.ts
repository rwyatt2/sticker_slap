import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { hashPassword } from '@/server/auth';
import { verifyPasswordResetToken, consumePasswordResetToken } from '@/server/tokens';
import { withRateLimit } from '@/server/rate-limit';
import { passwordResetSchema } from '@/lib/validation';

/**
 * GET - Verify if a reset token is valid
 */
export async function GET(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
          return NextResponse.json(
            { success: false, valid: false, message: 'Token is required' },
            { status: 400 }
          );
        }

        const result = await verifyPasswordResetToken(token);

        return NextResponse.json({
          success: true,
          valid: result.success,
          message: result.error || 'Token is valid',
        });
      } catch (error) {
        console.error('Token verification error:', error);
        return NextResponse.json(
          { success: false, valid: false, message: 'Verification failed' },
          { status: 500 }
        );
      }
    },
    'password-reset'
  );
}

/**
 * POST - Reset password with valid token
 */
export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parsed = passwordResetSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              success: false,
              message: 'Validation failed',
              errors: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
          );
        }

        const { token, password } = parsed.data;

        // Verify token
        const result = await verifyPasswordResetToken(token);

        if (!result.success || !result.email) {
          return NextResponse.json(
            {
              success: false,
              message: result.error || 'Invalid or expired token',
            },
            { status: 400 }
          );
        }

        // Hash new password with bcrypt (12 rounds)
        const hashedPassword = await hashPassword(password);

        // Update user password
        const user = await db.user.update({
          where: { email: result.email },
          data: {
            password: hashedPassword,
            // Also verify email if not already verified
            emailVerified: new Date(),
          },
          select: { id: true },
        });

        // Consume the token (delete it)
        await consumePasswordResetToken(token);

        // Log password reset for audit
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'UPDATE',
            entityType: 'User',
            entityId: user.id,
            newData: {
              action: 'password_reset',
              timestamp: new Date().toISOString(),
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Password has been reset successfully. You can now sign in.',
        });
      } catch (error) {
        console.error('Password reset error:', error);
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
