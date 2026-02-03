import { Navbar } from '@/components/landing/navbar';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { DemoSection } from '@/components/landing/demo-section';
import { TestimonialsSection } from '@/components/landing/testimonials-section';
import { CTASection } from '@/components/landing/cta-section';
import { Footer } from '@/components/landing/footer';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col smooth-scroll">
      {/* Fixed Navigation */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection />

        {/* Features Section */}
        <section id="features">
          <FeaturesSection />
        </section>

        {/* Interactive Demo Section */}
        <section id="demo">
          <DemoSection />
        </section>

        {/* Testimonials & Social Proof */}
        <section id="testimonials">
          <TestimonialsSection />
        </section>

        {/* CTA Section */}
        <section id="pricing">
          <CTASection />
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
