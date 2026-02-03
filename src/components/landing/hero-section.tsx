'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Typewriter } from './typewriter';
import { CanvasPreview } from './canvas-preview';
import { ParticlesBackground } from './particles-background';

const heroWords = ['Sticker Art', 'Collages', 'Mood Boards', 'Designs', 'Memories'];

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden mesh-gradient">
      <ParticlesBackground />
      
      <div className="container relative z-10 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Column - Text Content */}
          <motion.div
            className="flex flex-col items-center lg:items-start text-center lg:text-left"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-sm font-medium">Now with real-time collaboration</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              Create Amazing{' '}
              <span className="block mt-2">
                <Typewriter words={heroWords} />
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Design stunning compositions on an infinite canvas. Add stickers, text, and shapes 
              to bring your creative vision to life. Share your creations with the world.
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <Link href="/editor">
                <Button size="lg" className="group relative overflow-hidden px-8 glow-primary-sm">
                  <span className="relative z-10 flex items-center gap-2">
                    Start Creating
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-primary"
                    style={{ backgroundSize: '200% 100%' }}
                    animate={{ backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                </Button>
              </Link>
              <Link href="/gallery">
                <Button size="lg" variant="outline" className="group gap-2">
                  <Play className="h-4 w-4 transition-transform group-hover:scale-110" />
                  View Public Canvas
                </Button>
              </Link>
            </motion.div>

            {/* Social proof mini */}
            <motion.div
              className="flex items-center gap-4 mt-10 pt-8 border-t border-border/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              {/* Avatar stack */}
              <div className="flex -space-x-3">
                {[
                  'from-pink-400 to-rose-400',
                  'from-purple-400 to-indigo-400',
                  'from-blue-400 to-cyan-400',
                  'from-green-400 to-emerald-400',
                ].map((gradient, i) => (
                  <motion.div
                    key={i}
                    className={`w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-bold`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    {String.fromCharCode(65 + i)}
                  </motion.div>
                ))}
              </div>
              <div className="text-sm">
                <p className="font-semibold">Loved by 10,000+ creators</p>
                <p className="text-muted-foreground">Join our creative community</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Column - Canvas Preview */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          >
            <CanvasPreview />
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}
