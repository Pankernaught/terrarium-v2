import { describe, expect, it } from 'vitest';

import {
  clamp01,
  clampPlacement,
  clampScale,
  defaultPlacement,
  hardscapeAssetId,
  hardscapeSlug,
  hasHardscape,
  HARDSCAPE_PREFIX,
  isHardscapeSlug,
  isInsidePlane,
  movePlacement,
  type Placement,
  PLACEMENT_SCALE_MAX,
  PLACEMENT_SCALE_MIN,
  removePlacement,
  scalePlacement,
  splitPlacements,
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

describe('removePlacement', () => {
  const a: Placement = { slug: 'a', x: 0.1, y: 0.1, scale: 1 };
  const b: Placement = { slug: 'b', x: 0.2, y: 0.2, scale: 1 };

  it('drops the matching slug, keeping the rest in order', () => {
    expect(removePlacement([a, b], 'a')).toEqual([b]);
  });
  it('is a no-op for an absent slug', () => {
    expect(removePlacement([a, b], 'zzz')).toEqual([a, b]);
  });
});

describe('hardscape namespacing', () => {
  it('prefixes and round-trips an asset id', () => {
    const slug = hardscapeSlug('rock');
    expect(slug).toBe(`${HARDSCAPE_PREFIX}rock`);
    expect(isHardscapeSlug(slug)).toBe(true);
    expect(hardscapeAssetId(slug)).toBe('rock');
  });
  it('treats a bare plant slug as a plant', () => {
    expect(isHardscapeSlug('fittonia')).toBe(false);
    // a non-namespaced slug is returned unchanged
    expect(hardscapeAssetId('fittonia')).toBe('fittonia');
  });
  it('hasHardscape is true only when a hardscape placement exists', () => {
    const plant: Placement = { slug: 'moss', x: 0.5, y: 0.5, scale: 1 };
    const rock: Placement = { slug: hardscapeSlug('rock'), x: 0.3, y: 0.7, scale: 1 };
    expect(hasHardscape([plant])).toBe(false);
    expect(hasHardscape([plant, rock])).toBe(true);
  });
  it('splitPlacements partitions plants from hardscape, order preserved', () => {
    const moss: Placement = { slug: 'moss', x: 0.5, y: 0.5, scale: 1 };
    const fern: Placement = { slug: 'fern', x: 0.6, y: 0.4, scale: 1 };
    const rock: Placement = { slug: hardscapeSlug('rock'), x: 0.3, y: 0.7, scale: 1 };
    const { plants, hardscape } = splitPlacements([moss, rock, fern]);
    expect(plants).toEqual([moss, fern]);
    expect(hardscape).toEqual([rock]);
  });
});

describe('defaultPlacement', () => {
  it('returns an in-plane placement at the requested scale', () => {
    const p = defaultPlacement('fern', 0);
    expect(isInsidePlane(p)).toBe(true);
    expect(p.slug).toBe('fern');
    expect(p.scale).toBe(1);
  });
  it('sits clear of the edges (8% inset)', () => {
    for (let i = 0; i < 12; i++) {
      const p = defaultPlacement(`s${i}`, i);
      expect(p.x).toBeGreaterThanOrEqual(0.08 - 1e-9);
      expect(p.x).toBeLessThanOrEqual(0.92 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(0.08 - 1e-9);
      expect(p.y).toBeLessThanOrEqual(0.92 + 1e-9);
    }
  });
  it('spreads successive adds (no two identical positions in the first handful)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const p = defaultPlacement('x', i);
      seen.add(`${p.x.toFixed(4)},${p.y.toFixed(4)}`);
    }
    expect(seen.size).toBe(6);
  });
  it('is deterministic for a given index', () => {
    expect(defaultPlacement('a', 3)).toEqual(defaultPlacement('a', 3));
  });
});
