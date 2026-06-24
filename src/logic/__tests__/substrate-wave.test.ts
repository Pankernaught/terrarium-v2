/**
 * Organic-seam wave invariants. The substrate layers undulate via a seeded
 * sum-of-sines; these lock the two properties the renderer relies on: the offset
 * is bounded by its amplitude (so a thin charcoal/drainage band can never be
 * pinched past the cap) and it's deterministic (so the contour doesn't jitter
 * every time a stepper re-renders the scene).
 */
import { describe, expect, it } from 'vitest';

import { ampFor, waveOffset } from '../substrate-wave';

describe('substrate seam wave', () => {
  it('never exceeds its amplitude (no layer pinch past the bound)', () => {
    for (const seed of [1, 2, 3]) {
      for (let x = 0; x < 400; x += 3) {
        expect(Math.abs(waveOffset(x, 5, seed))).toBeLessThanOrEqual(5 + 1e-9);
      }
    }
  });

  it('is deterministic for the same x/amp/seed', () => {
    expect(waveOffset(123.4, 5, 1)).toBe(waveOffset(123.4, 5, 1));
    expect(waveOffset(50, 4, 2)).toBe(waveOffset(50, 4, 2));
  });

  it('differs by seed so independent seams do not ripple in unison', () => {
    expect(waveOffset(50, 5, 1)).not.toBe(waveOffset(50, 5, 2));
  });

  it('flattens at zero amplitude', () => {
    expect(waveOffset(77, 0, 1)).toBe(0);
  });

  it('caps amplitude at a share of the thinner band', () => {
    expect(ampFor(8)).toBeCloseTo(2); // 0.25 * 8
    expect(ampFor(100)).toBe(5); // capped
    expect(ampFor(0)).toBe(0);
    expect(ampFor(-3)).toBe(0);
  });
});
