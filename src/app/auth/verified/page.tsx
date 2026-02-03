'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle, XCircle } from 'lucide-react';

function VerifiedContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';

  if (!success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-lg text-center"
      >
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>

        <h1 className="text-xl font-semibold mb-2">Verification Failed</h1>
        <p className="text-muted-foreground mb-6">
          We couldn&apos;t verify your email. The link may have expired or already been used.
        </p>

        <div className="space-y-3">
          <Link href="/auth/signup" className="block">
            <Button className="w-full">Sign Up Again</Button>
          </Link>
          <Link href="/auth/signin" className="block">
            <Button variant="outline" className="w-full">
              Sign In
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md rounded-2xl border bg-background p-8 shadow-lg text-center"
    >
      <div className="mb-6 flex justify-center">
        <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-4">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <Link href="/" className="mb-4 inline-flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-8 w-8 text-primary" />
        Sticker Slap
      </Link>

      <h1 className="text-xl font-semibold mt-4 mb-2">Email Verified!</h1>

      <p className="text-muted-foreground mb-6">
        Your email has been successfully verified. You can now sign in to your account and start
        creating amazing sticker compositions.
      </p>

      <Link href="/auth/signin" className="block">
        <Button className="w-full">Sign In to Your Account</Button>
      </Link>
    </motion.div>
  );
}

export default function VerifiedPage() {
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
        <VerifiedContent />
      </Suspense>
    </div>
  );
}
