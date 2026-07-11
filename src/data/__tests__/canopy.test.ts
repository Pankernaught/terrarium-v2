/**
 * Canopy slot-fill invariants (ADR 0007 revised). The arrangement is random in prod
 * (per cold launch) but the *shape* must hold every time: every slot filled from the
 * pool, no same sprite in two adjacent slots, focal chosen at most once. A scripted
 * rng pins the randomness so these are deterministic.
 *
 * Lives under src/data (like vibe-art.test.ts) so the pure-logic vitest include picks
 * it up — `src/components/vibes/canopy.ts` is pure TS with no RN imports, so it loads
 * fine in node; only its directory is outside the runner's include globs.
 */
import { describe, expect, it } from 'vitest';

import { buildCanopy } from '../../components/vibes/canopy';

/** Deterministic rng cycling through a fixed sequence — covers low/mid/high draws. */
function scriptedRng(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length];
}

describe('buildCanopy', () => {
  it('fills every slot with a valid pool index', () => {
    const c = buildCanopy({ bottom: 6, focal: 2 }, scriptedRng([0.1, 0.4, 0.7, 0.9, 0.2, 0.6]));
    for (const slot of [...c.back, ...c.front]) {
      expect(slot.poolIndex).toBeGreaterThanOrEqual(0);
      expect(slot.poolIndex).toBeLessThan(6);
    }
    expect(c.front.length).toBeGreaterThan(0);
    expect(c.back.length).toBeGreaterThan(0);
  });

  it('never repeats a sprite in two adjacent slots', () => {
    // All draws collide on index 0 → exercises the no-adjacent-duplicate bump.
    const c = buildCanopy({ bottom: 4, focal: 0 }, scriptedRng([0]));
    for (const row of [c.back, c.front]) {
      for (let i = 1; i < row.length; i++) {
        expect(row[i].poolIndex).not.toBe(row[i - 1].poolIndex);
      }
    }
  });

  it('returns no slots when the pool is empty (nothing to render)', () => {
    const c = buildCanopy({ bottom: 0, focal: 0 });
    expect(c.back).toEqual([]);
    expect(c.front).toEqual([]);
    expect(c.focal).toBeNull();
  });

  it('omits the focal plant when the roll is above the chance threshold', () => {
    // Last draw (focal roll) = 0.99 ≥ FOCAL_CHANCE → no focal.
    const c = buildCanopy({ bottom: 3, focal: 2 }, scriptedRng([0.99]));
    expect(c.focal).toBeNull();
  });

  it('includes a focal plant (valid index) when the roll passes', () => {
    const c = buildCanopy({ bottom: 3, focal: 2 }, scriptedRng([0.1]));
    expect(c.focal).not.toBeNull();
    expect(c.focal!.poolIndex).toBeGreaterThanOrEqual(0);
    expect(c.focal!.poolIndex).toBeLessThan(2);
  });
});
