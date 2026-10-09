import type { PixelIconName } from '@/shared/ui/pixel-icons';

/**
 * Optional in-game artwork. Until these are filled in the site uses its own SVG
 * pixel art, so nothing breaks while images are missing.
 *
 * 1. Put files under web/public/mc/ (WebP for screenshots, transparent PNG for items).
 * 2. Reference them here with a leading slash, e.g. '/mc/hero-day.webp'.
 */
export interface HeroArtwork {
  day: string;
  night: string;
  alt: string;
}

export const HERO_ARTWORK = null as HeroArtwork | null;

/** Replaces individual pixel icons, e.g. { chest: '/mc/items/chest.png' }. */
export const ITEM_ARTWORK: Partial<Record<PixelIconName, string>> = {};
