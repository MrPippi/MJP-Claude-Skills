import type { PixelIconName } from '@/shared/ui/pixel-icons';

export type DocSection = 'platforms' | 'concepts' | 'reference';

export interface BilingualText {
  en: string;
  zh: string;
}

/** Serializable docs entry passed from server layouts to client navigation. */
export interface DocLink {
  section: DocSection;
  slug: string;
  href: string;
  title: BilingualText;
  icon: PixelIconName;
}

export type DocLang = 'en' | 'zh';

export interface DocSource {
  section: DocSection;
  slug: string;
  /** Path relative to the repository root (one level above web/). */
  file: string;
  /** Language the source file is written in; the other language comes from web/data/docs/<lang>/. */
  sourceLang: DocLang;
  icon: PixelIconName;
}

/**
 * Markdown files outside web/ rendered as docs pages. The repo files stay the single
 * source of truth; nothing is copied into web/data.
 */
export const DOC_SOURCES: readonly DocSource[] = [
  { section: 'platforms', slug: 'paper-nms', file: 'Skills/paper-nms/PLATFORM.md', sourceLang: 'en', icon: 'redstone' },
  { section: 'platforms', slug: 'paper-api', file: 'Skills/paper-api/PLATFORM.md', sourceLang: 'en', icon: 'emerald' },
  { section: 'concepts', slug: 'nms-threading', file: 'Skills/_shared/nms-threading.md', sourceLang: 'en', icon: 'redstone' },
  { section: 'concepts', slug: 'nms-obfuscation', file: 'Skills/_shared/nms-obfuscation.md', sourceLang: 'en', icon: 'book' },
  { section: 'concepts', slug: 'paper-threading', file: 'Skills/_shared/paper-threading.md', sourceLang: 'en', icon: 'emerald' },
  { section: 'reference', slug: 'packets', file: 'docs/paper-nms/packets.md', sourceLang: 'zh', icon: 'pearl' },
  { section: 'reference', slug: 'entities', file: 'docs/paper-nms/entities.md', sourceLang: 'zh', icon: 'egg' },
  { section: 'reference', slug: 'network', file: 'docs/paper-nms/network.md', sourceLang: 'zh', icon: 'redstone' },
  { section: 'reference', slug: 'bukkit-nms-bridge', file: 'docs/paper-nms/bukkit-nms-bridge.md', sourceLang: 'zh', icon: 'pickaxe' },
];

export const DOC_SECTIONS: readonly DocSection[] = ['platforms', 'concepts', 'reference'];

export function docHref(section: DocSection, slug: string): string {
  return `/docs/${section}/${slug}`;
}
