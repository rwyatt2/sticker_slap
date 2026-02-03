import type { Session as NextAuthSession } from 'next-auth';
import type { UserRole } from '@prisma/client';

/**
 * Extended session type with role and email verification
 */
export interface Session extends NextAuthSession {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
    emailVerified: Date | null;
  };
}

/**
 * User profile data
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  emailVerified: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: Session['user'] | null;
  session: Session | null;
}

/**
 * Registration form data
 */
export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Login form data
 */
export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Password reset request data
 */
export interface PasswordResetRequestData {
  email: string;
}

/**
 * Password reset data
 */
export interface PasswordResetData {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * Auth API response
 */
export interface AuthApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

/**
 * Token verification result
 */
export interface TokenVerificationResult {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * Role permissions mapping
 */
export const RolePermissions: Record<UserRole, string[]> = {
  USER: [
    'project:create',
    'project:read:own',
    'project:update:own',
    'project:delete:own',
    'sticker:create',
    'sticker:read',
    'sticker:update:own',
    'sticker:delete:own',
  ],
  MODERATOR: [
    'project:create',
    'project:read',
    'project:update:own',
    'project:delete:own',
    'sticker:create',
    'sticker:read',
    'sticker:update',
    'sticker:delete',
    'user:read',
  ],
  ADMIN: [
    'project:create',
    'project:read',
    'project:update',
    'project:delete',
    'sticker:create',
    'sticker:read',
    'sticker:update',
    'sticker:delete',
    'user:create',
    'user:read',
    'user:update',
    'user:delete',
    'admin:access',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  return RolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role is at least the specified level
 */
export function isAtLeastRole(currentRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: UserRole[] = ['USER', 'MODERATOR', 'ADMIN'];
  const currentIndex = roleHierarchy.indexOf(currentRole);
  const requiredIndex = roleHierarchy.indexOf(requiredRole);
  return currentIndex >= requiredIndex;
}

/**
 * OAuth provider types
 */
export type OAuthProvider = 'google' | 'github';

/**
 * Auth error codes
 */
export type AuthErrorCode =
  | 'CredentialsSignin'
  | 'OAuthSignin'
  | 'OAuthCallback'
  | 'OAuthCreateAccount'
  | 'EmailCreateAccount'
  | 'Callback'
  | 'OAuthAccountNotLinked'
  | 'SessionRequired'
  | 'AccessDenied'
  | 'Configuration'
  | 'Verification'
  | 'Default';
