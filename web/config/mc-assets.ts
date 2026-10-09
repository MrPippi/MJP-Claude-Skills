import type { PixelIconName } from '@/shared/ui/pixel-icons';

/**
 * In-game artwork. Files under web/public/art/ are extracted from the vanilla resource
 * dump (web/public/mc/, gitignored) by `python web/scripts/mc-art.py`.
 * Anything left out falls back to the SVG pixel art in shared/ui/pixel-icons.ts.
 */
export interface HeroArtwork {
  day: string;
  night: string;
  alt: string;
}

/** Optional hero screenshots (e.g. '/art/hero-day.webp'); null → textured pixel landscape. */
export const HERO_ARTWORK = null as HeroArtwork | null;

/** Replaces pixel icons. `sun` / `moon` stay SVG so they follow the text colour. */
export const ITEM_ARTWORK: Partial<Record<PixelIconName, string>> = {
  grass: '/art/items/grass.png',
  pickaxe: '/art/items/pickaxe.png',
  redstone: '/art/items/redstone.png',
  emerald: '/art/items/emerald.png',
  book: '/art/items/book.png',
  chest: '/art/items/chest.png',
  sword: '/art/items/sword.png',
  command: '/art/items/command.png',
  pearl: '/art/items/pearl.png',
  egg: '/art/items/egg.png',
  head: '/art/items/head.png',
  sign: '/art/items/sign.png',
  creeper: '/art/items/creeper.png',
};

/** 16x16 block faces tiled by the hero landscape. */
export const BLOCK_TEXTURES = {
  grass: '/art/blocks/grass_block_side.png',
  dirt: '/art/blocks/dirt.png',
  stone: '/art/blocks/stone.png',
  log: '/art/blocks/oak_log.png',
  leaves: '/art/blocks/oak_leaves.png',
} as const;
