import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db';
import { hashPassword } from '@/server/auth';
import { createEmailVerificationToken } from '@/server/tokens';
import { sendVerificationEmail } from '@/server/email';
import { withRateLimit } from '@/server/rate-limit';
import { registerSchema } from '@/lib/validation';
import { sanitizeEmail, sanitizeInput } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  return withRateLimit(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parsed = registerSchema.safeParse(body);
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

        const { name, email, password } = parsed.data;

        // Sanitize inputs
        const sanitizedEmail = sanitizeEmail(email);
        const sanitizedName = sanitizeInput(name);

        // Check if user already exists
        const existingUser = await db.user.findUnique({
          where: { email: sanitizedEmail },
        });

        if (existingUser) {
          // Don't reveal if email exists for security
          return NextResponse.json(
            {
              success: true,
              message:
                'If this email is not already registered, you will receive a verification email shortly.',
            },
            { status: 200 }
          );
        }

        // Hash password with bcrypt (12 rounds)
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await db.user.create({
          data: {
            name: sanitizedName,
            email: sanitizedEmail,
            password: hashedPassword,
            role: 'USER',
          },
        });

        // Create email verification token
        const token = await createEmailVerificationToken(sanitizedEmail);

        // Send verification email
        await sendVerificationEmail(sanitizedEmail, token);

        // Log user creation
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entityType: 'User',
            entityId: user.id,
            newData: {
              email: sanitizedEmail,
              name: sanitizedName,
              timestamp: new Date().toISOString(),
            },
          },
        });

        return NextResponse.json(
          {
            success: true,
            message:
              'Registration successful! Please check your email to verify your account.',
          },
          { status: 201 }
        );
      } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
          {
            success: false,
            message: 'An error occurred during registration. Please try again.',
          },
          { status: 500 }
        );
      }
    },
    'auth'
  );
}
