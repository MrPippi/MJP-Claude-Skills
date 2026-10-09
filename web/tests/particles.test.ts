import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBurst, MAX_PARTICLES, PARTICLE_SIZES, XP_COLORS } from '../shared/motion/particles';

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
    assert.equal(createBurst(10, seeded(1)).length, 10);
    assert.equal(createBurst(-3, seeded(1)).length, 0);
    assert.equal(createBurst(999, seeded(1)).length, MAX_PARTICLES);
  });

  it('throws upward first: every peak is above the origin and the landing is below the peak', () => {
    for (const p of createBurst(30, seeded(7))) {
      assert.ok(p.peakY < 0, `peakY ${p.peakY}`);
      assert.ok(p.endY > p.peakY, `endY ${p.endY} vs peak ${p.peakY}`);
      assert.ok(Math.abs(p.endX) <= 90, `endX ${p.endX}`);
    }
  });

  it('uses whole-pixel sizes and the XP palette only', () => {
    for (const p of createBurst(30, seeded(3))) {
      assert.ok(PARTICLE_SIZES.includes(p.size), `size ${p.size}`);
      assert.ok(XP_COLORS.includes(p.color), p.color);
      assert.ok(p.duration >= 500 && p.duration <= 850, `duration ${p.duration}`);
    }
  });

  it('is deterministic for a given random source', () => {
    assert.deepEqual(createBurst(5, seeded(42)), createBurst(5, seeded(42)));
  });
});
