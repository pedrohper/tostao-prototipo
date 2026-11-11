import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tostão',
  description: 'Grana explicada, de tostão em tostão.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#FDFBF6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
