import type { PixelIconName } from '@/shared/ui/pixel-icons';

export type DocSection = 'platforms' | 'concepts' | 'reference';

export interface DocSource {
  section: DocSection;
  slug: string;
  /** Path relative to the repository root (one level above web/). */
  file: string;
  icon: PixelIconName;
}

/**
 * Markdown files outside web/ rendered as docs pages. The repo files stay the single
 * source of truth; nothing is copied into web/data.
 */
export const DOC_SOURCES: readonly DocSource[] = [
  { section: 'platforms', slug: 'paper-nms', file: 'Skills/paper-nms/PLATFORM.md', icon: 'redstone' },
  { section: 'platforms', slug: 'paper-api', file: 'Skills/paper-api/PLATFORM.md', icon: 'emerald' },
  { section: 'concepts', slug: 'nms-threading', file: 'Skills/_shared/nms-threading.md', icon: 'redstone' },
  { section: 'concepts', slug: 'nms-obfuscation', file: 'Skills/_shared/nms-obfuscation.md', icon: 'book' },
  { section: 'concepts', slug: 'paper-threading', file: 'Skills/_shared/paper-threading.md', icon: 'emerald' },
  { section: 'reference', slug: 'packets', file: 'docs/paper-nms/packets.md', icon: 'pearl' },
  { section: 'reference', slug: 'entities', file: 'docs/paper-nms/entities.md', icon: 'egg' },
  { section: 'reference', slug: 'network', file: 'docs/paper-nms/network.md', icon: 'redstone' },
  { section: 'reference', slug: 'bukkit-nms-bridge', file: 'docs/paper-nms/bukkit-nms-bridge.md', icon: 'pickaxe' },
];

export const DOC_SECTIONS: readonly DocSection[] = ['platforms', 'concepts', 'reference'];

export function docHref(section: DocSection, slug: string): string {
  return `/docs/${section}/${slug}`;
}
