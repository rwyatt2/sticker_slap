'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  hue: number;
}

export function ParticlesBackground() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const generateParticles = (): Particle[] => {
      const particleCount = Math.min(50, Math.floor((dimensions.width * dimensions.height) / 20000));
      return Array.from({ length: particleCount }, (_, i) => ({
        id: i,
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        size: Math.random() * 4 + 2,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2,
        hue: Math.random() * 60 + 250, // Purple to pink range
      }));
    };

    setParticles(generateParticles());
  }, [dimensions]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            background: `hsla(${particle.hue}, 80%, 60%, ${particle.opacity})`,
            boxShadow: `0 0 ${particle.size * 2}px hsla(${particle.hue}, 80%, 60%, ${particle.opacity * 0.5})`,
          }}
          initial={{
            x: particle.x,
            y: particle.y,
          }}
          animate={{
            x: [
              particle.x,
              particle.x + Math.random() * 100 - 50,
              particle.x + Math.random() * 100 - 50,
              particle.x,
            ],
            y: [
              particle.y,
              particle.y + Math.random() * 100 - 50,
              particle.y + Math.random() * 100 - 50,
              particle.y,
            ],
            opacity: [
              particle.opacity,
              particle.opacity * 1.5,
              particle.opacity * 0.5,
              particle.opacity,
            ],
            scale: [1, 1.2, 0.8, 1],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
      
      {/* Gradient orbs */}
      <motion.div
        className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: 'radial-gradient(circle, hsl(262, 83%, 58%) 0%, transparent 70%)',
          top: '10%',
          left: '20%',
        }}
        animate={{
          x: [0, 50, -30, 0],
          y: [0, -30, 50, 0],
          scale: [1, 1.1, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-80 h-80 rounded-full opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle, hsl(280, 87%, 55%) 0%, transparent 70%)',
          top: '40%',
          right: '10%',
        }}
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 40, -20, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, hsl(199, 89%, 48%) 0%, transparent 70%)',
          bottom: '20%',
          left: '40%',
        }}
        animate={{
          x: [0, 30, -50, 0],
          y: [0, -50, 30, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
