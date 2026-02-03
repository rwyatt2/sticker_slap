'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Sparkles, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIntersectionObserver } from './use-intersection-observer';

const benefits = [
  'Unlimited canvas space',
  'Real-time collaboration',
  'Export in multiple formats',
  'Cloud storage included',
  'No watermarks',
  'Priority support',
];

const trustIndicators = [
  { icon: Zap, text: 'Lightning fast' },
  { icon: Shield, text: 'Secure & private' },
  { icon: Sparkles, text: 'Free forever plan' },
];

export function CTASection() {
  const [sectionRef, isIntersecting] = useIntersectionObserver<HTMLElement>({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 relative overflow-hidden"
    >
      {/* Background decorations */}
      <div className="absolute inset-0 mesh-gradient" />
      
      {/* Animated shapes */}
      <motion.div
        className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-20"
        style={{ background: 'hsl(var(--primary))' }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl opacity-15"
        style={{ background: 'hsl(280, 87%, 55%)' }}
        animate={{
          scale: [1.2, 1, 1.2],
          x: [0, -20, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="container relative z-10">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          {/* Main CTA Card */}
          <motion.div
            className="relative p-8 md:p-12 lg:p-16 rounded-3xl glass-card overflow-hidden"
            whileHover={{ scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {/* Inner gradient border */}
            <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-br from-primary/50 via-purple-500/30 to-pink-500/50 pointer-events-none">
              <div className="absolute inset-[1px] rounded-3xl bg-background/90" />
            </div>

            <div className="relative z-10">
              {/* Badge */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={isIntersecting ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{ delay: 0.2 }}
              >
                <Sparkles className="h-4 w-4" />
                Start for free, upgrade anytime
              </motion.div>

              {/* Headline */}
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Ready to create something{' '}
                <span className="gradient-text">amazing</span>?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                Join thousands of creators who are already making stunning sticker art. 
                No credit card required to get started.
              </p>

              {/* Benefits grid */}
              <motion.div
                className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10 max-w-2xl mx-auto"
                initial={{ opacity: 0 }}
                animate={isIntersecting ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.3 }}
              >
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    className="flex items-center gap-2 text-sm"
                    initial={{ opacity: 0, x: -10 }}
                    animate={isIntersecting ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{benefit}</span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                className="flex flex-col sm:flex-row items-center justify-center gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.5 }}
              >
                <Link href="/auth/signup">
                  <Button
                    size="lg"
                    className="group relative overflow-hidden px-10 py-6 text-lg glow-primary"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Get Started Free
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary"
                      style={{ backgroundSize: '200% 100%' }}
                      animate={{ backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    />
                  </Button>
                </Link>
                <Link href="/editor">
                  <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                    Try Without Account
                  </Button>
                </Link>
              </motion.div>

              {/* Trust indicators */}
              <motion.div
                className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-8 border-t border-border/50"
                initial={{ opacity: 0 }}
                animate={isIntersecting ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.6 }}
              >
                {trustIndicators.map((indicator, index) => (
                  <motion.div
                    key={indicator.text}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    initial={{ opacity: 0, y: 10 }}
                    animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                  >
                    <indicator.icon className="h-4 w-4 text-primary" />
                    {indicator.text}
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
