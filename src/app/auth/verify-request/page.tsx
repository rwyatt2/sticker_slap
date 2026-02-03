'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Mail, CheckCircle, AlertCircle } from 'lucide-react';

function VerifyRequestContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleResend = async () => {
    if (!email) return;

    setIsResending(true);
    setResendStatus('idle');

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setResendStatus('success');
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-lg text-center"
    >
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Mail className="h-10 w-10 text-primary" />
        </div>
      </div>

      <Link href="/" className="mb-4 inline-flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-8 w-8 text-primary" />
        Sticker Slap
      </Link>

      <h1 className="text-xl font-semibold mt-4 mb-2">Check your email</h1>

      <p className="text-muted-foreground mb-4">
        We&apos;ve sent a verification link to{' '}
        {email ? <strong>{email}</strong> : 'your email address'}.
      </p>

      <p className="text-sm text-muted-foreground mb-6">
        Click the link in the email to verify your account. The link will expire in 24 hours.
      </p>

      {resendStatus === 'success' && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-green-100 dark:bg-green-900/20 p-3 text-sm text-green-600 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          Verification email sent!
        </div>
      )}

      {resendStatus === 'error' && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Failed to resend email. Please try again.
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={isResending || !email}
        >
          {isResending ? (
            <span className="flex items-center">
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </span>
          ) : (
            'Resend verification email'
          )}
        </Button>

        <Link href="/auth/signin" className="block">
          <Button variant="ghost" className="w-full">
            Back to Sign In
          </Button>
        </Link>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Didn&apos;t receive the email? Check your spam folder or{' '}
        <button
          onClick={handleResend}
          className="text-primary hover:underline disabled:opacity-50"
          disabled={isResending || !email}
        >
          click here to resend
        </button>
        .
      </p>
    </motion.div>
  );
}

export default function VerifyRequestPage() {
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
        <VerifyRequestContent />
      </Suspense>
    </div>
  );
}
