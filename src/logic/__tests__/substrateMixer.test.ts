/**
 * Substrate mixer — the pure roll-up math + the soft character/recipe text, plus a
 * drift guard tying the authored matrix to the frozen component vocabulary. The
 * live Substrate-step render is device-verified; this covers the pure logic.
 */
import { describe, expect, it } from 'vitest';

import { SUBSTRATE_COMPONENT_IDS, componentLabel } from '../../data/substrate-components';
import {
  activeComponents,
  describeMix,
  formatMixRecipe,
  mixSubstrate,
  perchedWaterTable,
  totalParts,
} from '../substrateMixer';
import {
  MATRIX_COMPONENT_IDS,
  PROPERTY_MAX,
  SIZE_CLASS,
  SIZE_CLASS_MAX,
  SUBSTRATE_MATRIX,
  SUBSTRATE_PROPERTIES,
} from '../substrate-matrix';

describe('property matrix (authored, provisional)', () => {
  it('covers exactly the frozen substrate components — no drift', () => {
    expect([...MATRIX_COMPONENT_IDS].sort()).toEqual([...SUBSTRATE_COMPONENT_IDS].sort());
  });

  it('assigns every component a 0–4 size class — no drift', () => {
    expect(Object.keys(SIZE_CLASS).sort()).toEqual([...MATRIX_COMPONENT_IDS].sort());
    for (const id of MATRIX_COMPONENT_IDS) {
      const v = SIZE_CLASS[id];
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(SIZE_CLASS_MAX);
    }
  });

  it('scores every property of every component on the 0–4 ordinal scale', () => {
    for (const id of MATRIX_COMPONENT_IDS) {
      for (const prop of SUBSTRATE_PROPERTIES) {
        const v = SUBSTRATE_MATRIX[id][prop];
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(PROPERTY_MAX);
      }
    }
  });
});

describe('mixSubstrate', () => {
  it('returns null for an empty recipe', () => {
    expect(mixSubstrate({})).toBeNull();
  });

  it('returns null for an all-zero recipe', () => {
    expect(mixSubstrate({ perlite: 0, peat: 0 })).toBeNull();
  });

  it('returns a single component as its matrix row, normalized 0–1', () => {
    // perlite row = { aeration:4, waterRetention:1, nutrient:0, buffering:0 } ÷4.
    expect(mixSubstrate({ perlite: 1 })).toEqual({
      aeration: 1,
      waterRetention: 0.25,
      nutrient: 0,
      buffering: 0,
    });
    // The number of parts is irrelevant for a lone component (weight === 1).
    expect(mixSubstrate({ perlite: 5 })).toEqual(mixSubstrate({ perlite: 1 }));
  });

  it('is the pure parts-weighted mean for a uniform-size blend (no packing)', () => {
    // coco-coir + akadama are both size class 2 → mismatch 0 → straight mean.
    // aer (3+2)/2=2.5, water (3+3)/2=3, nut (2+0)/2=1, buf (3+2)/2=2.5 — all ÷4.
    const stats = mixSubstrate({ 'coco-coir': 1, akadama: 1 })!;
    expect(stats.aeration).toBeCloseTo(0.625, 10);
    expect(stats.waterRetention).toBeCloseTo(0.75, 10);
    expect(stats.nutrient).toBeCloseTo(0.25, 10);
    expect(stats.buffering).toBeCloseTo(0.625, 10);
  });

  it('bends aeration below the linear mean when fines clog coarse voids', () => {
    // 2 perlite (size 3) : 1 peat (size 1) — wide spread, real fine fraction.
    // Linear aeration would be 9/4·¼ = 0.75; packing pulls it down, and the lost
    // macropore volume turns into held water (retention up from the linear 0.5).
    const stats = mixSubstrate({ perlite: 2, peat: 1 })!;
    expect(stats.aeration).toBeLessThan(0.75);
    expect(stats.aeration).toBeCloseTo(0.5833, 3);
    expect(stats.waterRetention).toBeGreaterThan(0.5);
    expect(stats.waterRetention).toBeCloseTo(0.6111, 3);
    // Nutrient still blends linearly: (2·0 + 1·2)/3 ÷ 4 = (2/3)/4.
    expect(stats.nutrient).toBeCloseTo(2 / 3 / PROPERTY_MAX, 10);
  });

  it('ignores unknown ids and non-positive parts', () => {
    const withNoise = mixSubstrate({ perlite: 1, bogus: 9, peat: -3 });
    expect(withNoise).toEqual(mixSubstrate({ perlite: 1 }));
  });

  it('keeps every stat within 0–1', () => {
    const stats = mixSubstrate({ mud: 3, peat: 2, 'coco-coir': 1 })!;
    for (const prop of SUBSTRATE_PROPERTIES) {
      expect(stats[prop]).toBeGreaterThanOrEqual(0);
      expect(stats[prop]).toBeLessThanOrEqual(1);
    }
  });
});

describe('activeComponents / totalParts', () => {
  it('lists positive-part components in canonical matrix order', () => {
    // Given out of order; returned in matrix order (perlite < sphagnum < coco-coir).
    expect(activeComponents({ 'coco-coir': 1, sphagnum: 2, perlite: 1, sand: 0 })).toEqual([
      'perlite',
      'sphagnum',
      'coco-coir',
    ]);
  });

  it('sums only positive, known parts', () => {
    expect(totalParts({ perlite: 2, peat: 3, bogus: 5, sand: -1 })).toBe(5);
    expect(totalParts({})).toBe(0);
  });
});

describe('describeMix', () => {
  it('reads a lone airy component as "airy"', () => {
    expect(describeMix(mixSubstrate({ perlite: 1 }))).toBe('airy');
  });

  it('names the 1–2 genuine standouts', () => {
    // Airy + moisture-retentive blend. The packing correction nudges retention
    // just past aeration, so moisture leads (strongest-first order).
    expect(describeMix(mixSubstrate({ 'coco-coir': 2, perlite: 1, sphagnum: 1 }))).toBe(
      'moisture-retentive, airy',
    );
  });

  it('caps at two words even when more than two properties are high', () => {
    const phrase = describeMix(mixSubstrate({ mud: 1 }));
    expect(phrase.split(', ')).toHaveLength(2);
    expect(phrase).toBe('moisture-retentive, pH-stable');
  });

  it('reads an even blend as "well-balanced"', () => {
    // coco-coir is the all-rounder — no property clears the mean by the margin.
    expect(describeMix(mixSubstrate({ 'coco-coir': 1 }))).toBe('well-balanced');
  });

  it('treats a null (empty) blend as "well-balanced"', () => {
    expect(describeMix(null)).toBe('well-balanced');
  });
});

describe('formatMixRecipe', () => {
  it('renders biggest share first, with pluralized parts and lowercased labels', () => {
    expect(formatMixRecipe({ 'coco-coir': 2, perlite: 1, sphagnum: 1 }, componentLabel)).toBe(
      '2 parts coco coir, 1 part perlite, 1 part sphagnum moss',
    );
  });

  it('renders a single ingredient', () => {
    expect(formatMixRecipe({ perlite: 3 }, componentLabel)).toBe('3 parts perlite');
  });

  it('is empty for an empty recipe', () => {
    expect(formatMixRecipe({}, componentLabel)).toBe('');
  });
});

describe('perchedWaterTable', () => {
  it('is null for an empty recipe or a non-positive depth', () => {
    expect(perchedWaterTable({}, 5)).toBeNull();
    expect(perchedWaterTable({ mud: 1 }, 0)).toBeNull();
    expect(perchedWaterTable({ mud: 1 }, -2)).toBeNull();
  });

  it('perches a taller saturated zone for a finer mix — depth-independent', () => {
    // Powder (mud, size 0) → 1 + 6·1 = 7 cm; chunky (leca, size 4) → 1 + 6·0 = 1 cm.
    const fine = perchedWaterTable({ mud: 1 }, 10)!;
    const coarse = perchedWaterTable({ leca: 1 }, 10)!;
    expect(fine.perchedHeightCm).toBeCloseTo(7, 10);
    expect(coarse.perchedHeightCm).toBeCloseTo(1, 10);
    expect(fine.perchedHeightCm).toBeGreaterThan(coarse.perchedHeightCm);
  });

  it('saturates a larger fraction of a shallower substrate', () => {
    // coco-coir size 2 → perched 1 + 6·0.5 = 4 cm.
    const shallow = perchedWaterTable({ 'coco-coir': 1 }, 5)!;
    const deep = perchedWaterTable({ 'coco-coir': 1 }, 10)!;
    expect(shallow.perchedHeightCm).toBeCloseTo(4, 10);
    expect(shallow.saturatedFraction).toBeCloseTo(0.8, 10);
    expect(deep.saturatedFraction).toBeCloseTo(0.4, 10);
    expect(shallow.saturatedFraction).toBeGreaterThan(deep.saturatedFraction);
  });

  it('clamps the saturated fraction at 1 when the perch exceeds the substrate', () => {
    // 7 cm perch in a 4 cm base → fully waterlogged, not 1.75.
    expect(perchedWaterTable({ mud: 1 }, 4)!.saturatedFraction).toBe(1);
  });
});
