import type { Metadata, Viewport } from 'next';
import { Chiron_GoRound_TC, Inter, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import { AppShell } from '@/layout';
import { THEME_INIT_SCRIPT } from '@/layout/theme-script';
import { getSearchIndex } from '@/features/skills';
import { getDocLinks } from '@/features/docs';
import { SITE_NAME, SITE_SHORT_NAME, SITE_DESCRIPTION, SITE_URL } from '@/config/site';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
/** Heading CJK glyphs; Google slices it by unicode-range, so only characters on the page download. */
const goround = Chiron_GoRound_TC({ variable: '--font-goround', weight: ['700'], display: 'swap', preload: false });
const mono = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap' });
/** Cubic 11 (OFL), subset to UI characters by scripts/pixel-font.py. */
const pixel = localFont({ src: '../shared/fonts/cubic-11-subset.woff2', variable: '--font-cubic', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_SHORT_NAME}`,
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
      className={`${inter.variable} ${goround.variable} ${mono.variable} ${pixel.variable}`}
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
