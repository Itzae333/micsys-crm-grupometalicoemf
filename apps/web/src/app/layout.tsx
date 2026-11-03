import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Schibsted_Grotesk } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/pwa';
import { Providers } from '@/lib/providers';
import './globals.css';

const display = Schibsted_Grotesk({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-display' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: 'Cauce', template: '%s · Cauce' },
  description: 'Cada peso, en su cauce.',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Cauce', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#155457',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
