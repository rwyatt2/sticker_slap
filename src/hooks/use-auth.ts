'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useCallback, useMemo } from 'react';
import type { UserRole } from '@prisma/client';
import { hasPermission, isAtLeastRole, type OAuthProvider } from '@/types/auth';

/**
 * Hook for accessing authentication state and methods
 */
export function useAuth() {
  const { data: session, status, update } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';
  const user = session?.user ?? null;

  /**
   * Sign in with credentials
   */
  const signInWithCredentials = useCallback(
    async (email: string, password: string, callbackUrl?: string) => {
      return signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        callbackUrl: callbackUrl || '/dashboard',
        redirect: false,
      });
    },
    []
  );

  /**
   * Sign in with OAuth provider
   */
  const signInWithOAuth = useCallback(
    (provider: OAuthProvider, callbackUrl?: string) => {
      return signIn(provider, {
        callbackUrl: callbackUrl || '/dashboard',
      });
    },
    []
  );

  /**
   * Sign out
   */
  const handleSignOut = useCallback(
    (callbackUrl?: string) => {
      return signOut({
        callbackUrl: callbackUrl || '/',
      });
    },
    []
  );

  /**
   * Check if user has a specific permission
   */
  const checkPermission = useCallback(
    (permission: string): boolean => {
      if (!user?.role) return false;
      return hasPermission(user.role as UserRole, permission);
    },
    [user?.role]
  );

  /**
   * Check if user has at least the specified role
   */
  const checkRole = useCallback(
    (requiredRole: UserRole): boolean => {
      if (!user?.role) return false;
      return isAtLeastRole(user.role as UserRole, requiredRole);
    },
    [user?.role]
  );

  /**
   * Check if user is admin
   */
  const isAdmin = useMemo(() => {
    return user?.role === 'ADMIN';
  }, [user?.role]);

  /**
   * Check if user's email is verified
   */
  const isEmailVerified = useMemo(() => {
    return !!user?.emailVerified;
  }, [user?.emailVerified]);

  /**
   * Refresh the session
   */
  const refreshSession = useCallback(async () => {
    return update();
  }, [update]);

  return {
    // State
    session,
    user,
    status,
    isLoading,
    isAuthenticated,
    isAdmin,
    isEmailVerified,

    // Methods
    signInWithCredentials,
    signInWithOAuth,
    signOut: handleSignOut,
    checkPermission,
    checkRole,
    refreshSession,
  };
}

/**
 * Hook for requiring authentication
 * Redirects to sign-in if not authenticated
 */
export function useRequireAuth(options?: { redirectTo?: string }) {
  const auth = useAuth();
  const { isLoading, isAuthenticated } = auth;

  // Effect to handle redirect is handled in middleware
  // This hook just provides the auth state

  return {
    ...auth,
    isReady: !isLoading,
    isAuthorized: isAuthenticated,
  };
}

/**
 * Hook for requiring a specific role
 */
export function useRequireRole(requiredRole: UserRole, options?: { redirectTo?: string }) {
  const auth = useAuth();
  const { isLoading, isAuthenticated, checkRole } = auth;

  const hasRequiredRole = checkRole(requiredRole);
  const isAuthorized = isAuthenticated && hasRequiredRole;

  return {
    ...auth,
    isReady: !isLoading,
    isAuthorized,
    hasRequiredRole,
  };
}

/**
 * Hook for requiring email verification
 */
export function useRequireVerifiedEmail() {
  const auth = useAuth();
  const { isLoading, isAuthenticated, isEmailVerified } = auth;

  const isAuthorized = isAuthenticated && isEmailVerified;

  return {
    ...auth,
    isReady: !isLoading,
    isAuthorized,
    needsVerification: isAuthenticated && !isEmailVerified,
  };
}
