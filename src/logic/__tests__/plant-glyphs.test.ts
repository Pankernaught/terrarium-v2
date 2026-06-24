/**
 * Locks the load-bearing invariants of the stylized plant render (ADR 0012). The
 * renderer derives the overflow badge and root band from the stem cap and trusts the
 * footprint bound, so these are the contract — break one and the planner desyncs.
 */
import { describe, expect, it } from 'vitest';

import { GLYPH_UNIT, composePlant, glyphFor, postureFor, type PlantLayout } from '../plant-glyphs';
import type { GrowthHabit, PlantType } from '@/types';

const layout = (over: Partial<PlantLayout> = {}): PlantLayout => ({
  widthPx: 40,
  typicalPx: 60,
  maxPx: 90,
  seed: 12345,
  ...over,
});

const HABITS: Record<string, GrowthHabit> = { erect: 'upright', low: 'mounding', trailing: 'trailing' };

describe('posture + glyph mapping', () => {
  it('folds 6 habits into 3 families and defaults null to erect', () => {
    expect(postureFor('upright')).toBe('erect');
    expect(postureFor('climbing')).toBe('erect');
    expect(postureFor('mounding')).toBe('low');
    expect(postureFor('creeping')).toBe('low');
    expect(postureFor('rosette')).toBe('low');
    expect(postureFor('trailing')).toBe('trailing');
    expect(postureFor(null)).toBe('erect');
  });

  it('keys all 12 types onto 9 glyphs; the 3 shared point at ovate', () => {
    expect(glyphFor('vine')).toBe('ovate');
    expect(glyphFor('ground-cover')).toBe('ovate');
    expect(glyphFor('foliage')).toBe('ovate');
    expect(glyphFor('fern-ally')).toBe(glyphFor('fern'));
    expect(glyphFor('carnivorous')).toBe('pitcher');
    expect(glyphFor(null)).toBe('ovate');
  });
});

describe.each(Object.entries(HABITS))('composePlant — %s posture', (_family, habit) => {
  const plant = { plantType: 'foliage' as PlantType, growthHabit: habit };

  it('is base-anchored and height-true (contract #1, #2)', () => {
    const { stem } = composePlant(plant, layout());
    expect(stem.path.startsWith('M')).toBe(true);
    expect(stem.capY).toBe(-60); // -typicalPx
    expect(stem.ghostCapY).toBe(-90); // -maxPx
  });

  it('drops the ghost when max ≈ typical', () => {
    const { stem } = composePlant(plant, layout({ maxPx: 60 }));
    expect(stem.ghostPath).toBeNull();
    expect(stem.ghostCapY).toBeNull();
  });

  it('keeps every glyph inside the footprint (contract #3)', () => {
    const { foliage } = composePlant(plant, layout({ widthPx: 8 })); // tight footprint
    const half = 8 / 2;
    for (const g of foliage) {
      expect(Math.abs(g.x) + g.scale * GLYPH_UNIT).toBeLessThanOrEqual(half + 1e-9);
    }
  });

  it('is deterministic for the same inputs (contract #4)', () => {
    expect(composePlant(plant, layout())).toEqual(composePlant(plant, layout()));
  });

  it('scales foliage by spread, never by height (contract #5)', () => {
    const short = composePlant(plant, layout({ typicalPx: 30, maxPx: 40 }));
    const tall = composePlant(plant, layout({ typicalPx: 120, maxPx: 160 }));
    // Same width → identical glyph sizes regardless of height.
    expect(tall.foliage.map((g) => g.scale)).toEqual(short.foliage.map((g) => g.scale));
    // Wider footprint → the kit responds (more glyphs and/or larger).
    const wide = composePlant(plant, layout({ widthPx: 120 }));
    const narrow = composePlant(plant, layout({ widthPx: 40 }));
    expect(wide.foliage.length).toBeGreaterThan(narrow.foliage.length);
  });
});
