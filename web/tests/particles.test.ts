import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBurst,
  GRAVITY,
  MAX_PARTICLES,
  PARTICLE_SIZES,
  timeToFloor,
  trajectory,
  XP_COLORS,
} from '../shared/motion/particles';

/** Deterministic PRNG (mulberry32) so assertions don't depend on Math.random. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('createBurst', () => {
  it('creates the requested number of particles, clamped to [0, MAX_PARTICLES]', () => {
    assert.equal(createBurst(10, 500, seeded(1)).length, 10);
    assert.equal(createBurst(-3, 500, seeded(1)).length, 0);
    assert.equal(createBurst(999, 500, seeded(1)).length, MAX_PARTICLES);
  });

  it('launches every particle upward and uses whole-pixel sizes from the XP palette', () => {
    for (const p of createBurst(30, 500, seeded(3))) {
      assert.ok(p.vy < 0, `vy ${p.vy}`);
      assert.ok(PARTICLE_SIZES.includes(p.size), `size ${p.size}`);
      assert.ok(XP_COLORS.includes(p.color), p.color);
    }
  });

  it('lasts exactly until the particle reaches the floor', () => {
    for (const p of createBurst(10, 640, seeded(5))) {
      assert.equal(p.duration, Math.round(timeToFloor(p.vy, 640 - p.size) * 1000));
    }
  });

  it('falls longer from higher up', () => {
    const [near] = createBurst(1, 100, seeded(9));
    const [far] = createBurst(1, 900, seeded(9));
    assert.ok(far.duration > near.duration);
  });

  it('is deterministic for a given random source', () => {
    assert.deepEqual(createBurst(5, 500, seeded(42)), createBurst(5, 500, seeded(42)));
  });
});

describe('timeToFloor', () => {
  it('solves the free-fall equation', () => {
    const vy = -400;
    const distance = 600;
    const t = timeToFloor(vy, distance);
    assert.ok(Math.abs(vy * t + 0.5 * GRAVITY * t * t - distance) < 1e-6);
  });

  it('treats a floor at or above the origin as an immediate landing after the arc', () => {
    assert.ok(timeToFloor(-400, 0) > 0);
    assert.equal(timeToFloor(0, 0), 0);
  });
});

describe('trajectory', () => {
  const [p] = createBurst(1, 700, seeded(11));
  const frames = trajectory(p, 16);

  it('starts at the origin and ends on the floor', () => {
    assert.deepEqual([frames[0].x, frames[0].y, frames[0].offset], [0, 0, 0]);
    const last = frames[frames.length - 1];
    assert.equal(last.offset, 1);
    assert.ok(Math.abs(last.y - (700 - p.size)) <= 1, `last y ${last.y}`);
  });

  it('rises above the origin before falling, with monotonic offsets', () => {
    assert.ok(Math.min(...frames.map((f) => f.y)) < 0);
    for (let i = 1; i < frames.length; i += 1) assert.ok(frames[i].offset > frames[i - 1].offset);
  });

  it('moves horizontally at constant speed', () => {
    const last = frames[frames.length - 1];
    assert.ok(Math.abs(last.x - Math.round(p.vx * (p.duration / 1000))) <= 1);
  });
});
