/** Pure particle maths for the XP-orb burst; DOM wiring lives in ParticleBurst.tsx. */

export const XP_COLORS: readonly string[] = ['#c6f74a', '#7fdc2a', '#f2e14b', '#e6ff8a'];
export const PARTICLE_SIZES: readonly number[] = [4, 6];
export const MAX_PARTICLES = 24;

export interface Particle {
  /** Offset (px) from the click point at the top of the arc. */
  peakX: number;
  peakY: number;
  /** Offset (px) where the particle fades out after falling. */
  endX: number;
  endY: number;
  size: number;
  color: string;
  duration: number;
}

const between = (random: () => number, min: number, max: number) => min + random() * (max - min);
const pick = <T,>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];

/** Throws particles up and outward in a fan (±70° from vertical), then lets them fall. */
export function createBurst(count: number, random: () => number = Math.random): Particle[] {
  const n = Math.max(0, Math.min(MAX_PARTICLES, Math.floor(count)));
  return Array.from({ length: n }, () => {
    const angle = between(random, -70, 70) * (Math.PI / 180);
    const distance = between(random, 28, 56);
    const peakX = Math.round(Math.sin(angle) * distance);
    const peakY = -Math.round(Math.cos(angle) * distance) - 6;
    const drift = between(random, 1.2, 1.6);
    return {
      peakX,
      peakY,
      endX: Math.round(peakX * drift),
      endY: Math.round(peakY + between(random, 30, 60)),
      size: pick(random, PARTICLE_SIZES),
      color: pick(random, XP_COLORS),
      duration: Math.round(between(random, 520, 820)),
    };
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
