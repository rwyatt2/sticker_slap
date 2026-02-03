import NextAuth, { type NextAuthConfig } from 'next-auth';

/** Local type to avoid importing @prisma/client in Edge (middleware). */
type UserRole = 'USER' | 'ADMIN';

/**
 * Edge-safe auth config: no Prisma, no Node-only modules.
 * Used by middleware. Full config with DB lives in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Required by NextAuth internals; full providers live in auth.ts
  trustHost: true, // Required for dev (localhost) and common deployment hosts
  secret:
    process.env.AUTH_SECRET ||
    'dev-secret-min-32-chars-change-in-production',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/dashboard',
  },
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: '__Secure-next-auth.callback-url',
      options: {
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: '__Host-next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: UserRole }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.emailVerified = token.emailVerified as Date | null;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
};

/** Edge-safe auth for middleware. Use auth from auth.ts in API routes and server components. */
export const { auth } = NextAuth(authConfig);
