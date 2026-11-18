import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/bricolage-grotesque/700.css';
import '@fontsource/bricolage-grotesque/800.css';
import './globals.css';
import { getLocale } from '@/lib/i18n-server';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: 'Tostão',
  description: 'Grana explicada, de tostão em tostão.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FDFBF6' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1714' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, cookieStore] = await Promise.all([getLocale(), cookies()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  return (
    <html lang={locale} data-theme={theme === 'system' ? undefined : theme}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
