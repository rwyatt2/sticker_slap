'use client';

import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useIntersectionObserver } from './use-intersection-observer';
import { AnimatedCounter } from './animated-counter';

interface Testimonial {
  id: number;
  name: string;
  role: string;
  avatar: string;
  content: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Sarah Chen',
    role: 'Content Creator',
    avatar: 'SC',
    content:
      "Sticker Slap transformed how I create social media content. The infinite canvas and real-time collaboration features are game-changers!",
    rating: 5,
  },
  {
    id: 2,
    name: 'Marcus Johnson',
    role: 'Graphic Designer',
    avatar: 'MJ',
    content:
      "As a professional designer, I appreciate the intuitive controls and powerful layer management. It's now my go-to for quick mockups.",
    rating: 5,
  },
  {
    id: 3,
    name: 'Emma Rodriguez',
    role: 'Art Teacher',
    avatar: 'ER',
    content:
      "My students love it! It's accessible enough for beginners but has enough depth for advanced projects. Highly recommended.",
    rating: 5,
  },
  {
    id: 4,
    name: 'Alex Kim',
    role: 'YouTuber',
    avatar: 'AK',
    content:
      "I use it for all my thumbnail designs now. The export quality is fantastic and the workflow is super smooth.",
    rating: 5,
  },
  {
    id: 5,
    name: 'Jordan Taylor',
    role: 'Brand Manager',
    avatar: 'JT',
    content:
      "Our team collaboration improved significantly. Being able to work together in real-time has saved us countless hours.",
    rating: 5,
  },
  {
    id: 6,
    name: 'Riley Parker',
    role: 'Hobbyist',
    avatar: 'RP',
    content:
      "Even as someone with no design background, I can create beautiful compositions. The drag-and-drop is so intuitive!",
    rating: 5,
  },
];

const stats = [
  { label: 'Active Creators', value: 10000, suffix: '+' },
  { label: 'Stickers Created', value: 500000, suffix: '+' },
  { label: 'Projects Saved', value: 75000, suffix: '+' },
  { label: 'Happy Reviews', value: 4.9, suffix: '/5' },
];

function TestimonialCard({
  testimonial,
  index,
}: {
  testimonial: Testimonial;
  index: number;
}) {
  return (
    <motion.div
      className="glass-card p-6 rounded-2xl h-full"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5 }}
    >
      {/* Quote icon */}
      <Quote className="h-8 w-8 text-primary/30 mb-4" />

      {/* Rating */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: testimonial.rating }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + i * 0.05 }}
          >
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <p className="text-foreground mb-6 leading-relaxed">{testimonial.content}</p>

      {/* Author */}
      <div className="flex items-center gap-3 mt-auto">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-sm font-bold">
          {testimonial.avatar}
        </div>
        <div>
          <p className="font-semibold text-sm">{testimonial.name}</p>
          <p className="text-muted-foreground text-xs">{testimonial.role}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function TestimonialsSection() {
  const [sectionRef, isIntersecting] = useIntersectionObserver<HTMLElement>({
    threshold: 0.1,
    triggerOnce: true,
  });

  return (
    <section ref={sectionRef} className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-gradient-intense opacity-30" />

      <div className="container relative z-10">
        {/* Stats bar */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20 p-8 rounded-3xl glass-card"
          initial={{ opacity: 0, y: 30 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: index * 0.1 + 0.2 }}
            >
              <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">
                <AnimatedCounter
                  value={stat.value}
                  suffix={stat.suffix}
                  duration={2.5}
                />
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Section header */}
        <motion.div
          className="text-center max-w-3xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isIntersecting ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full glass-card text-sm font-medium text-primary mb-4">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Loved by <span className="gradient-text">creators worldwide</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Join thousands of happy creators who have transformed their workflow with Sticker Slap.
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} index={index} />
          ))}
        </div>

        {/* Logo cloud */}
        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground mb-8">
            Trusted by creators from leading companies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {['Spotify', 'Adobe', 'Notion', 'Figma', 'Canva', 'Dribbble'].map(
              (company, i) => (
                <motion.div
                  key={company}
                  className="text-xl font-semibold text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  {company}
                </motion.div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
