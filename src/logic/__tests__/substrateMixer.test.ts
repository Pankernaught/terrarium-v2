/**
 * Substrate mixer — the pure roll-up math + the soft character/recipe text, plus a
 * drift guard tying the authored matrix to the frozen component vocabulary. This is
 * the CI half of Phase 8 (the live Substrate-step render is device-verified).
 */
import { describe, expect, it } from 'vitest';

import { SUBSTRATE_COMPONENT_IDS, componentLabel } from '../../data/substrate-components';
import {
  activeComponents,
  describeMix,
  formatMixRecipe,
  mixSubstrate,
  totalParts,
} from '../substrateMixer';
import {
  MATRIX_COMPONENT_IDS,
  PROPERTY_MAX,
  SUBSTRATE_MATRIX,
  SUBSTRATE_PROPERTIES,
} from '../substrate-matrix';

describe('property matrix (authored, provisional)', () => {
  it('covers exactly the 9 frozen substrate components — no drift', () => {
    expect([...MATRIX_COMPONENT_IDS].sort()).toEqual([...SUBSTRATE_COMPONENT_IDS].sort());
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

  it('rolls up a multi-component recipe as the parts-weighted mean', () => {
    // 2 coco-coir : 1 perlite : 1 sphagnum (total 4).
    const stats = mixSubstrate({ 'coco-coir': 2, perlite: 1, sphagnum: 1 })!;
    expect(stats.aeration).toBeCloseTo(0.75, 10);
    expect(stats.waterRetention).toBeCloseTo(0.6875, 10);
    expect(stats.nutrient).toBeCloseTo(0.3125, 10);
    expect(stats.buffering).toBeCloseTo(0.5, 10);
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
    // The documented example → an airy, moisture-retentive blend.
    expect(describeMix(mixSubstrate({ 'coco-coir': 2, perlite: 1, sphagnum: 1 }))).toBe(
      'airy, moisture-retentive',
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
