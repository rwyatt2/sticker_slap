'use client';

import { motion } from 'framer-motion';
import {
  Infinity,
  Users,
  Upload,
  LayoutDashboard,
  Layers,
  Wand2,
  Share2,
  Zap,
} from 'lucide-react';
import { useIntersectionObserver } from './use-intersection-observer';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}

const features: Feature[] = [
  {
    icon: <Infinity className="h-6 w-6" />,
    title: 'Infinite Canvas',
    description:
      'No boundaries. Pan, zoom, and create on an endless canvas that grows with your imagination.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Real-time Collaboration',
    description:
      'Work together with friends and teammates. See changes instantly as everyone creates.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: <Upload className="h-6 w-6" />,
    title: 'Easy Uploads',
    description:
      'Drag and drop your images, stickers, and assets. Supports all major formats.',
    gradient: 'from-emerald-500 to-green-500',
  },
  {
    icon: <LayoutDashboard className="h-6 w-6" />,
    title: 'Personal Dashboard',
    description:
      'Organize all your projects in one place. Quick access to your creations anytime.',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: <Layers className="h-6 w-6" />,
    title: 'Layer Management',
    description:
      'Professional layer controls. Reorder, group, lock, and organize your elements.',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    icon: <Wand2 className="h-6 w-6" />,
    title: 'Smart Effects',
    description:
      'Apply filters, shadows, and transformations. Make your stickers pop with effects.',
    gradient: 'from-indigo-500 to-blue-500',
  },
  {
    icon: <Share2 className="h-6 w-6" />,
    title: 'One-Click Export',
    description:
      'Export in PNG, JPG, or SVG. Share directly to social media or download.',
    gradient: 'from-teal-500 to-emerald-500',
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Lightning Fast',
    description:
      'Optimized performance. Smooth animations and instant response, even with hundreds of stickers.',
    gradient: 'from-yellow-500 to-orange-500',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const [ref, isIntersecting] = useIntersectionObserver<HTMLDivElement>({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
    >
      <motion.div
        className="group relative h-full p-6 rounded-2xl glass-card overflow-hidden"
        whileHover={{ y: -5, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Background gradient on hover */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity duration-300`}
          style={{ opacity: 0 }}
          whileHover={{ opacity: 0.05 }}
        />

        {/* Icon container */}
        <motion.div
          className={`relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} text-white mb-4`}
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          {feature.icon}
          
          {/* Glow effect */}
          <motion.div
            className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.gradient} blur-lg opacity-0 group-hover:opacity-50 transition-opacity duration-300`}
          />
        </motion.div>

        {/* Content */}
        <h3 className="text-lg font-semibold mb-2 group-hover:gradient-text transition-all duration-300">
          {feature.title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {feature.description}
        </p>

        {/* Corner decoration */}
        <motion.div
          className={`absolute -bottom-2 -right-2 w-24 h-24 rounded-full bg-gradient-to-br ${feature.gradient} opacity-0 blur-2xl transition-opacity duration-300`}
          whileHover={{ opacity: 0.3 }}
        />
      </motion.div>
    </motion.div>
  );
}

export function FeaturesSection() {
  const [titleRef, titleIntersecting] = useIntersectionObserver<HTMLDivElement>({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      
      <div className="container relative z-10">
        {/* Section header */}
        <motion.div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={titleIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <motion.span
            className="inline-block px-4 py-1.5 rounded-full glass-card text-sm font-medium text-primary mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={titleIntersecting ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.1 }}
          >
            Features
          </motion.span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Everything you need to{' '}
            <span className="gradient-text">create magic</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Powerful tools designed for creators of all skill levels. From simple stickers to 
            complex compositions, we&apos;ve got you covered.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
