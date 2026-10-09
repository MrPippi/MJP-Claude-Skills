/** Pure particle physics for the XP-orb burst; DOM wiring lives in MotionLayer.tsx. */

export const XP_COLORS: readonly string[] = ['#c6f74a', '#7fdc2a', '#f2e14b', '#e6ff8a'];
export const PARTICLE_SIZES: readonly number[] = [4, 6];
export const MAX_PARTICLES = 24;
/** Downward acceleration in px/s². */
export const GRAVITY = 2200;

export interface Particle {
  /** Launch velocity in px/s (vy < 0 is upward). */
  vx: number;
  vy: number;
  /** Distance in px from the launch point down to where the particle touches the floor. */
  floor: number;
  size: number;
  color: string;
  /** Flight time until the floor, in ms. */
  duration: number;
}

export interface Frame {
  x: number;
  y: number;
  offset: number;
}

const between = (random: () => number, min: number, max: number) => min + random() * (max - min);
const pick = <T,>(random: () => number, list: readonly T[]): T => list[Math.floor(random() * list.length) % list.length];

/** Seconds until y(t) = vy·t + ½·g·t² reaches `distance` (positive = below the origin). */
export function timeToFloor(vy: number, distance: number): number {
  const d = Math.max(0, distance);
  return (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * d)) / GRAVITY;
}

/**
 * Throws particles up and outward, then lets them fall freely to the floor.
 * `floorDistance` is how far below the click the floor is (e.g. viewport bottom − clientY).
 */
export function createBurst(count: number, floorDistance: number, random: () => number = Math.random): Particle[] {
  const n = Math.max(0, Math.min(MAX_PARTICLES, Math.floor(count)));
  return Array.from({ length: n }, () => {
    const size = pick(random, PARTICLE_SIZES);
    const vx = Math.round(between(random, -260, 260));
    const vy = -Math.round(between(random, 420, 720));
    const floor = Math.max(0, Math.round(floorDistance - size));
    return { vx, vy, floor, size, color: pick(random, XP_COLORS), duration: Math.round(timeToFloor(vy, floor) * 1000) };
  });
}

/** Samples the parabola as linear keyframes (Web Animations can't ease x and y separately). */
export function trajectory(particle: Particle, steps = 18): Frame[] {
  const total = particle.duration / 1000;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (total * i) / steps;
    const last = i === steps;
    return {
      x: Math.round(particle.vx * t),
      y: last ? particle.floor : Math.round(particle.vy * t + 0.5 * GRAVITY * t * t),
      offset: i / steps,
    };
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
