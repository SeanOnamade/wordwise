import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://wordwise.app'),
  title: 'WordWise - AI-Powered Writing Assistant',
  description: 'Improve your academic writing with intelligent grammar suggestions, style recommendations, and real-time feedback.',
  keywords: 'writing assistant, grammar checker, academic writing, AI writing, proofreading',
  authors: [{ name: 'WordWise Team' }],
  robots: 'index, follow',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: 'WordWise - AI-Powered Writing Assistant',
    description: 'Improve your academic writing with intelligent grammar suggestions and real-time feedback.',
    type: 'website',
    locale: 'en_US',
    images: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <meta name="color-scheme" content="dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body 
        className={`${inter.className} font-sans bg-slate-900 text-slate-100 antialiased`}
        suppressHydrationWarning={true}
      >
        {/* Skip to main content link for screen readers */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Skip to main content"
        >
          Skip to main content
        </a>
        
        {/* Accessibility announcements region */}
        <div 
          id="announcements" 
          aria-live="polite" 
          aria-atomic="true" 
          className="sr-only"
          role="status"
        ></div>
        
        <main id="main-content" role="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
} 