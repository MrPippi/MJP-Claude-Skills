import type { CSSProperties } from 'react';

const STEP_MS = 70;
const MAX_MS = 420;

/** Inline style that staggers a [data-reveal] element by its position in a list. */
export function revealDelay(index: number): CSSProperties {
  return { '--reveal-delay': `${Math.min(index * STEP_MS, MAX_MS)}ms` } as CSSProperties;
}
