'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useIntersectionObserver } from './use-intersection-observer';
import { MousePointer2, Move, Hand, RotateCcw } from 'lucide-react';

interface DemoSticker {
  id: number;
  emoji: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

const initialStickers: DemoSticker[] = [
  { id: 1, emoji: '🌈', x: 120, y: 80, rotation: -10, scale: 1.2 },
  { id: 2, emoji: '🦋', x: 280, y: 60, rotation: 15, scale: 1 },
  { id: 3, emoji: '🌸', x: 200, y: 180, rotation: 0, scale: 1.4 },
  { id: 4, emoji: '✨', x: 80, y: 160, rotation: -5, scale: 0.9 },
  { id: 5, emoji: '🎀', x: 320, y: 140, rotation: 20, scale: 1.1 },
];

const stickerPalette = ['🌟', '❤️', '🎨', '🚀', '🌺', '💎', '🎵', '🌙'];

export function DemoSection() {
  const [sectionRef, isIntersecting] = useIntersectionObserver<HTMLElement>({
    threshold: 0.2,
    triggerOnce: true,
  });

  const [stickers, setStickers] = useState<DemoSticker[]>(initialStickers);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);

  // Auto-play animation
  useEffect(() => {
    if (!isIntersecting || !autoPlay) return;

    const interval = setInterval(() => {
      setStickers((prev) =>
        prev.map((sticker) => ({
          ...sticker,
          x: sticker.x + (Math.random() - 0.5) * 20,
          y: sticker.y + (Math.random() - 0.5) * 15,
          rotation: sticker.rotation + (Math.random() - 0.5) * 10,
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isIntersecting, autoPlay]);

  const handleDragEnd = useCallback(
    (id: number, info: { point: { x: number; y: number }; offset: { x: number; y: number } }) => {
      setStickers((prev) =>
        prev.map((sticker) =>
          sticker.id === id
            ? {
                ...sticker,
                x: sticker.x + info.offset.x,
                y: sticker.y + info.offset.y,
              }
            : sticker
        )
      );
      setIsDragging(false);
      setSelectedId(null);
    },
    []
  );

  const addSticker = useCallback((emoji: string) => {
    const newSticker: DemoSticker = {
      id: Date.now(),
      emoji,
      x: 150 + Math.random() * 150,
      y: 100 + Math.random() * 100,
      rotation: (Math.random() - 0.5) * 30,
      scale: 0.9 + Math.random() * 0.4,
    };
    setStickers((prev) => [...prev, newSticker]);
    setAutoPlay(false);
  }, []);

  const resetCanvas = useCallback(() => {
    setStickers(initialStickers);
    setAutoPlay(true);
    setSelectedId(null);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-24 md:py-32 relative overflow-hidden bg-muted/30"
    >
      <div className="container">
        {/* Section header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full glass-card text-sm font-medium text-primary mb-4">
            Try It Out
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            See the <span className="gradient-text">magic</span> in action
          </h2>
          <p className="text-lg text-muted-foreground">
            Drag stickers around, add new ones, and experience the smooth canvas yourself.
          </p>
        </motion.div>

        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {/* Demo container */}
          <div className="relative rounded-3xl overflow-hidden glass-card p-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div className="flex items-center gap-4">
                {/* Sticker palette */}
                <div className="flex items-center gap-1">
                  {stickerPalette.map((emoji) => (
                    <motion.button
                      key={emoji}
                      onClick={() => addSticker(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 transition-colors text-lg"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      title="Click to add"
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  onClick={resetCanvas}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </motion.button>
              </div>
            </div>

            {/* Canvas area */}
            <div
              className="relative h-[400px] bg-gradient-to-br from-background to-muted/50 overflow-hidden cursor-grab active:cursor-grabbing"
              style={{
                backgroundImage: `
                  linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px),
                  linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            >
              {/* Stickers */}
              {stickers.map((sticker) => (
                <motion.div
                  key={sticker.id}
                  className={`absolute cursor-grab active:cursor-grabbing select-none ${
                    selectedId === sticker.id ? 'z-50' : 'z-10'
                  }`}
                  style={{
                    fontSize: `${sticker.scale * 2.5}rem`,
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
                  }}
                  initial={{
                    x: sticker.x,
                    y: sticker.y,
                    rotate: sticker.rotation,
                    scale: 0,
                  }}
                  animate={{
                    x: sticker.x,
                    y: sticker.y,
                    rotate: sticker.rotation,
                    scale: 1,
                  }}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 1.1 }}
                  drag
                  dragMomentum={false}
                  onDragStart={() => {
                    setIsDragging(true);
                    setSelectedId(sticker.id);
                    setAutoPlay(false);
                  }}
                  onDragEnd={(_, info) => handleDragEnd(sticker.id, info)}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 25,
                  }}
                >
                  {sticker.emoji}
                  
                  {/* Selection ring */}
                  {selectedId === sticker.id && (
                    <motion.div
                      className="absolute -inset-2 border-2 border-primary rounded-lg pointer-events-none"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    />
                  )}
                </motion.div>
              ))}

              {/* Instructions overlay */}
              <motion.div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 px-4 py-2 rounded-full glass-strong text-sm text-muted-foreground"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <span className="flex items-center gap-1.5">
                  <MousePointer2 className="h-4 w-4" />
                  Click to select
                </span>
                <span className="flex items-center gap-1.5">
                  <Move className="h-4 w-4" />
                  Drag to move
                </span>
                <span className="flex items-center gap-1.5">
                  <Hand className="h-4 w-4" />
                  Add from toolbar
                </span>
              </motion.div>
            </div>
          </div>

          {/* Call to action */}
          <motion.p
            className="text-center mt-8 text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={isIntersecting ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.6 }}
          >
            This is just a taste.{' '}
            <a href="/editor" className="text-primary hover:underline font-medium">
              Open the full editor
            </a>{' '}
            for the complete experience.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
