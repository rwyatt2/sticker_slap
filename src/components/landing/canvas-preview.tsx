'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface Sticker {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  delay: number;
}

const sampleStickers: Sticker[] = [
  { id: 1, emoji: '⭐', x: 15, y: 20, rotation: -15, scale: 1.2, delay: 0 },
  { id: 2, emoji: '🎨', x: 70, y: 15, rotation: 10, scale: 1.4, delay: 0.1 },
  { id: 3, emoji: '✨', x: 45, y: 45, rotation: 0, scale: 1.6, delay: 0.2 },
  { id: 4, emoji: '🚀', x: 25, y: 65, rotation: 20, scale: 1.3, delay: 0.3 },
  { id: 5, emoji: '💜', x: 75, y: 55, rotation: -10, scale: 1.5, delay: 0.4 },
  { id: 6, emoji: '🎯', x: 55, y: 75, rotation: 5, scale: 1.1, delay: 0.5 },
  { id: 7, emoji: '🌟', x: 85, y: 35, rotation: -20, scale: 1.2, delay: 0.6 },
  { id: 8, emoji: '🎉', x: 10, y: 45, rotation: 15, scale: 1.3, delay: 0.7 },
];

export function CanvasPreview() {
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-2xl bg-muted/30 border border-border/50" />
    );
  }

  return (
    <motion.div
      className="relative w-full aspect-[4/3] perspective-1000"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* 3D Card Container */}
      <motion.div
        className="relative w-full h-full rounded-2xl overflow-hidden glass-card"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{
          rotateX: isHovered ? 5 : 0,
          rotateY: isHovered ? -5 : 0,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Canvas background with grid */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted/50">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
            }}
          />
        </div>

        {/* Floating stickers */}
        {sampleStickers.map((sticker) => (
          <motion.div
            key={sticker.id}
            className="absolute select-none cursor-grab active:cursor-grabbing"
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              fontSize: `${sticker.scale * 2}rem`,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
            }}
            initial={{ opacity: 0, scale: 0, rotate: sticker.rotation - 180 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: sticker.rotation,
              y: isHovered ? [0, -8, 0] : 0,
            }}
            transition={{
              opacity: { duration: 0.5, delay: sticker.delay },
              scale: { duration: 0.5, delay: sticker.delay, type: 'spring' },
              rotate: { duration: 0.5, delay: sticker.delay },
              y: {
                duration: 2,
                repeat: isHovered ? Infinity : 0,
                ease: 'easeInOut',
                delay: sticker.delay * 0.5,
              },
            }}
            whileHover={{
              scale: 1.3,
              rotate: sticker.rotation + 10,
              transition: { type: 'spring', stiffness: 400 },
            }}
          >
            {sticker.emoji}
          </motion.div>
        ))}

        {/* Toolbar mockup */}
        <motion.div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full glass-strong"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          {['🖼️', '✏️', '🔤', '🎨', '↩️'].map((icon, i) => (
            <motion.button
              key={i}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {icon}
            </motion.button>
          ))}
        </motion.div>

        {/* Decorative selection box */}
        <motion.div
          className="absolute border-2 border-primary border-dashed rounded-lg pointer-events-none"
          style={{
            width: '25%',
            height: '20%',
            left: '40%',
            top: '40%',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Corner handles */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
            <div
              key={corner}
              className={`absolute w-3 h-3 bg-primary rounded-sm ${
                corner.includes('top') ? '-top-1.5' : '-bottom-1.5'
              } ${corner.includes('left') ? '-left-1.5' : '-right-1.5'}`}
            />
          ))}
        </motion.div>

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
          }}
          animate={{ opacity: isHovered ? 1 : 0.5 }}
        />
      </motion.div>

      {/* Shadow */}
      <motion.div
        className="absolute -inset-4 -z-10 rounded-3xl blur-2xl"
        style={{
          background: 'linear-gradient(to bottom right, hsl(var(--primary) / 0.2), hsl(280 87% 55% / 0.1))',
        }}
        animate={{
          opacity: isHovered ? 0.8 : 0.4,
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}
