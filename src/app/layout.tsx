import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Sticker Slap - Create Amazing Sticker Art',
    template: '%s | Sticker Slap',
  },
  description:
    'Create, customize, and share amazing sticker art with our powerful canvas editor. Add stickers, text, and shapes to create unique designs.',
  keywords: ['sticker', 'art', 'canvas', 'editor', 'design', 'creative'],
  authors: [{ name: 'Sticker Slap Team' }],
  creator: 'Sticker Slap',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://stickerslap.app',
    siteName: 'Sticker Slap',
    title: 'Sticker Slap - Create Amazing Sticker Art',
    description: 'Create, customize, and share amazing sticker art with our powerful canvas editor.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Sticker Slap',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sticker Slap - Create Amazing Sticker Art',
    description: 'Create, customize, and share amazing sticker art with our powerful canvas editor.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <head>
        {/* Prefetch critical resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
