import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Economia Domestica',
    template: '%s · Economia Domestica',
  },
  description: 'Scontrini, spesa e utenze di casa, in un posto solo.',
  applicationName: 'Economia Domestica',
  appleWebApp: {
    capable: true,
    title: 'Economia',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  // L'app è mobile-first e si comporta come un'app: niente zoom accidentale
  // mentre si scorre una lista di righe scontrino.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1f' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
