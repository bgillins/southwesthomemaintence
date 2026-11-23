import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SHM Portal', template: '%s | SHM Portal' },
  description: 'Visit checklists, photo reports and home profiles for Southwest Home Maintenance.',
  // Staff tool and private customer reports: keep all of it out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'SHM Portal', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#06243a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
