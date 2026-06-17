import { describe, expect, it } from 'vitest';

import {
  clamp01,
  clampPlacement,
  clampScale,
  isInsidePlane,
  movePlacement,
  type Placement,
  PLACEMENT_SCALE_MAX,
  PLACEMENT_SCALE_MIN,
  scalePlacement,
  upsertPlacement,
} from '../placement';

const at = (x: number, y: number, scale = 1): Placement => ({ slug: 'p', x, y, scale });

describe('clamp01', () => {
  it('clamps into [0,1]', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });
  it('treats any non-finite value as 0 (defensive guard)', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-Infinity)).toBe(0);
  });
});

describe('clampScale', () => {
  it('clamps into the sane band', () => {
    expect(clampScale(0.1)).toBe(PLACEMENT_SCALE_MIN);
    expect(clampScale(1.0)).toBe(1.0);
    expect(clampScale(9)).toBe(PLACEMENT_SCALE_MAX);
  });
  it('non-finite falls back to the minimum', () => {
    expect(clampScale(NaN)).toBe(PLACEMENT_SCALE_MIN);
  });
});

describe('clampPlacement', () => {
  it('keeps an in-bounds placement intact', () => {
    expect(clampPlacement(at(0.3, 0.7, 1.1))).toEqual(at(0.3, 0.7, 1.1));
  });
  it('pulls an off-vessel placement back onto the plane and into the band', () => {
    expect(clampPlacement(at(-0.2, 1.4, 5))).toEqual(at(0, 1, PLACEMENT_SCALE_MAX));
  });
  it('margin insets the valid box so the whole sprite stays inside', () => {
    const m = 0.1;
    expect(clampPlacement(at(0, 1, 1), m)).toEqual(at(m, 1 - m, 1));
  });
  it('preserves the slug', () => {
    expect(clampPlacement({ slug: 'fern', x: 2, y: 2, scale: 1 }).slug).toBe('fern');
  });
});

describe('isInsidePlane', () => {
  it('true inside the unit square (inclusive)', () => {
    expect(isInsidePlane(at(0, 0))).toBe(true);
    expect(isInsidePlane(at(1, 1))).toBe(true);
    expect(isInsidePlane(at(0.5, 0.5))).toBe(true);
  });
  it('false outside it (an invalid drop zone)', () => {
    expect(isInsidePlane(at(-0.01, 0.5))).toBe(false);
    expect(isInsidePlane(at(0.5, 1.01))).toBe(false);
  });
});

describe('movePlacement', () => {
  it('applies a normalized delta then clamps', () => {
    expect(movePlacement(at(0.5, 0.5), 0.2, -0.1)).toEqual(at(0.7, 0.4));
  });
  it('clamps a delta that would leave the plane', () => {
    expect(movePlacement(at(0.9, 0.1), 0.5, -0.5)).toEqual(at(1, 0));
  });
});

describe('scalePlacement', () => {
  it('multiplies then clamps to the band', () => {
    expect(scalePlacement(at(0.5, 0.5, 1), 1.2).scale).toBeCloseTo(1.2);
    expect(scalePlacement(at(0.5, 0.5, 1), 10).scale).toBe(PLACEMENT_SCALE_MAX);
  });
});

describe('upsertPlacement', () => {
  const a: Placement = { slug: 'a', x: 0.1, y: 0.1, scale: 1 };
  const b: Placement = { slug: 'b', x: 0.2, y: 0.2, scale: 1 };

  it('appends a new slug, clamped', () => {
    const out = upsertPlacement([a], { slug: 'b', x: 2, y: 0.2, scale: 1 });
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ slug: 'b', x: 1, y: 0.2, scale: 1 });
  });
  it('replaces an existing slug in place, order stable', () => {
    const out = upsertPlacement([a, b], { slug: 'a', x: 0.9, y: 0.9, scale: 0.8 });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ slug: 'a', x: 0.9, y: 0.9, scale: 0.8 });
    expect(out[1]).toBe(b);
  });
});
