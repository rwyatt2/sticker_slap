'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorInfo = (
    errorCode: string | null
  ): { title: string; message: string; action: string; actionUrl: string } => {
    const errors: Record<
      string,
      { title: string; message: string; action: string; actionUrl: string }
    > = {
      Configuration: {
        title: 'Server Configuration Error',
        message:
          'There is a problem with the server configuration. Please contact support if this issue persists.',
        action: 'Go Home',
        actionUrl: '/',
      },
      AccessDenied: {
        title: 'Access Denied',
        message:
          'You do not have permission to access this resource. Please sign in with an authorized account.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      Verification: {
        title: 'Verification Error',
        message:
          'The verification link is invalid or has expired. Please request a new verification email.',
        action: 'Sign Up',
        actionUrl: '/auth/signup',
      },
      OAuthSignin: {
        title: 'OAuth Sign In Error',
        message:
          'There was a problem starting the sign in process. Please try again or use a different method.',
        action: 'Try Again',
        actionUrl: '/auth/signin',
      },
      OAuthCallback: {
        title: 'OAuth Callback Error',
        message:
          'There was a problem completing the sign in process. Please try again or use a different method.',
        action: 'Try Again',
        actionUrl: '/auth/signin',
      },
      OAuthCreateAccount: {
        title: 'Account Creation Error',
        message:
          'There was a problem creating your account. This email may already be registered with a different sign in method.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      EmailCreateAccount: {
        title: 'Account Creation Error',
        message: 'There was a problem creating your account. Please try again.',
        action: 'Sign Up',
        actionUrl: '/auth/signup',
      },
      Callback: {
        title: 'Callback Error',
        message: 'There was a problem during authentication. Please try again.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      OAuthAccountNotLinked: {
        title: 'Account Already Exists',
        message:
          'An account with this email already exists using a different sign in method. Please sign in using your original method.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      SessionRequired: {
        title: 'Session Required',
        message: 'You need to be signed in to access this page.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      MissingToken: {
        title: 'Missing Token',
        message: 'The verification link is missing required information. Please request a new link.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      InvalidToken: {
        title: 'Invalid Token',
        message: 'The verification link is invalid. It may have been corrupted or modified.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      'Token has expired': {
        title: 'Token Expired',
        message:
          'The verification link has expired. Please request a new verification email.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      VerificationFailed: {
        title: 'Verification Failed',
        message: 'We could not verify your email. Please try again or contact support.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
      Default: {
        title: 'Authentication Error',
        message: 'An unexpected error occurred during authentication. Please try again.',
        action: 'Sign In',
        actionUrl: '/auth/signin',
      },
    };

    return errors[error || ''] || errors.Default;
  };

  const errorInfo = getErrorInfo(error);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-lg text-center"
    >
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
      </div>

      <Link href="/" className="mb-4 inline-flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-8 w-8 text-primary" />
        Sticker Slap
      </Link>

      <h1 className="text-xl font-semibold mt-4 mb-2">{errorInfo.title}</h1>

      <p className="text-muted-foreground mb-6">{errorInfo.message}</p>

      {error && (
        <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted p-2 rounded">
          Error code: {error}
        </p>
      )}

      <div className="space-y-3">
        <Link href={errorInfo.actionUrl} className="block">
          <Button className="w-full">{errorInfo.action}</Button>
        </Link>
        <Link href="/" className="block">
          <Button variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-lg animate-pulse text-center">
            <div className="h-20 w-20 bg-muted rounded-full mx-auto mb-6" />
            <div className="h-6 bg-muted rounded mb-4" />
            <div className="h-4 bg-muted rounded" />
          </div>
        }
      >
        <ErrorContent />
      </Suspense>
    </div>
  );
}
