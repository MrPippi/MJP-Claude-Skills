import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Silkscreen, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/layout';
import { THEME_INIT_SCRIPT } from '@/layout/theme-script';
import { getSearchIndex } from '@/features/skills';
import { getDocLinks } from '@/features/docs';
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from '@/config/site';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const serif = Source_Serif_4({ variable: '--font-serif-src', subsets: ['latin'], weight: ['600'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap' });
const pixel = Silkscreen({ variable: '--font-silkscreen', subsets: ['latin'], weight: ['400'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | MJP-Claude-Skills`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1f1e1d' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${inter.variable} ${serif.variable} ${mono.variable} ${pixel.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppShell searchData={getSearchIndex()} docLinks={getDocLinks()}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
