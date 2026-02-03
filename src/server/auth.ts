import NextAuth, { type DefaultSession } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { db } from './db';
import { loginSchema } from '@/lib/validation';
import type { UserRole } from '@prisma/client';

/**
 * Bcrypt configuration
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Session configuration
 */
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24 hours

/**
 * Module augmentation for NextAuth types
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      emailVerified: Date | null;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
    emailVerified: Date | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: UserRole;
    emailVerified: Date | null;
  }
}

/**
 * Full NextAuth config (used by API routes and server components only).
 * Extends edge-safe auth.config with adapter, providers, and DB-dependent logic.
 */
const fullAuthConfig = {
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            role: true,
            emailVerified: true,
            isActive: true,
          },
        });

        // User not found or no password (OAuth user)
        if (!user || !user.password) {
          return null;
        }

        // Check if account is active
        if (!user.isActive) {
          throw new Error('Account is disabled');
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        // Update last login timestamp
        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') return true;
      return !!user;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.emailVerified = user.emailVerified;
      }
      if (trigger === 'update' && session) {
        if (session.emailVerified !== undefined) token.emailVerified = session.emailVerified;
        if (session.role !== undefined) token.role = session.role;
      }
      return token;
    },
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      // Log sign-in for audit purposes
      if (user.id) {
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'SIGN_IN',
            entityType: 'User',
            entityId: user.id,
            newData: {
              provider: account?.provider,
              isNewUser,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    },
    async signOut({ token }) {
      // Log sign-out for audit purposes
      if (token?.id) {
        await db.auditLog.create({
          data: {
            userId: token.id,
            action: 'SIGN_OUT',
            entityType: 'User',
            entityId: token.id,
            newData: {
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    },
    async createUser({ user }) {
      // Log user creation for audit purposes
      if (user.id) {
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: 'CREATE',
            entityType: 'User',
            entityId: user.id,
            newData: {
              email: user.email,
              name: user.name,
              timestamp: new Date().toISOString(),
            },
          },
        });
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

export const { handlers, signIn, signOut, auth } = NextAuth(fullAuthConfig);

/**
 * Hash a password with bcrypt (12 rounds)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Helper to get session in server components
 */
export async function getSession() {
  return await auth();
}

/**
 * Helper to require authentication
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Helper to require a specific role
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const session = await requireAuth();
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Forbidden');
  }
  return session;
}

/**
 * Helper to require admin role
 */
export async function requireAdmin() {
  return requireRole(['ADMIN']);
}

/**
 * Helper to require verified email
 */
export async function requireVerifiedEmail() {
  const session = await requireAuth();
  if (!session.user.emailVerified) {
    throw new Error('Email not verified');
  }
  return session;
}
