import { randomBytes } from 'crypto';
import { db } from './db';

/**
 * Token expiration times
 */
export const TOKEN_EXPIRY = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Create an email verification token
 */
export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_EXPIRY.EMAIL_VERIFICATION);

  // Delete any existing tokens for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token
  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return token;
}

/**
 * Verify an email verification token
 */
export async function verifyEmailToken(
  token: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const verificationToken = await db.verificationToken.findFirst({
    where: { token },
  });

  if (!verificationToken) {
    return { success: false, error: 'Invalid token' };
  }

  if (verificationToken.expires < new Date()) {
    // Clean up expired token
    await db.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });
    return { success: false, error: 'Token has expired' };
  }

  // Mark email as verified
  await db.user.update({
    where: { email: verificationToken.identifier },
    data: { emailVerified: new Date() },
  });

  // Delete the used token
  await db.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
      },
    },
  });

  return { success: true, email: verificationToken.identifier };
}

/**
 * Create a password reset token
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  // Check if user exists
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if user exists or not
    return null;
  }

  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_EXPIRY.PASSWORD_RESET);

  // Delete any existing tokens for this email
  await db.passwordResetToken.deleteMany({
    where: { email },
  });

  // Create new token
  await db.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return token;
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  const resetToken = await db.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    return { success: false, error: 'Invalid token' };
  }

  if (resetToken.expires < new Date()) {
    // Clean up expired token
    await db.passwordResetToken.delete({
      where: { id: resetToken.id },
    });
    return { success: false, error: 'Token has expired' };
  }

  return { success: true, email: resetToken.email };
}

/**
 * Consume a password reset token (mark as used by deleting)
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
  await db.passwordResetToken.delete({
    where: { token },
  });
}

/**
 * Clean up expired tokens (should be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  await Promise.all([
    db.verificationToken.deleteMany({
      where: { expires: { lt: now } },
    }),
    db.passwordResetToken.deleteMany({
      where: { expires: { lt: now } },
    }),
  ]);
}
