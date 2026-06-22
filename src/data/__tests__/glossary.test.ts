/**
 * Glossary gate (ADR 0006). Mirrors the seed gate's "unknown tag fails CI rather
 * than silently shipping" idiom for the technical-term dictionary:
 *
 *   1. **Enum coverage** — every value of every enum-backed vocabulary
 *      (light/moisture/ph/growthRate/growthHabit/plantType/biome/substrate) resolves
 *      to a glossary entry in the matching category. A new chip with no definition
 *      fails CI here, keeping the glossary from drifting out of sync with the UI.
 *   2. **Referential integrity** — slugs are globally unique and every `seeAlso`
 *      cross-link resolves, so a typo'd link fails the build instead of dead-linking
 *      on the device.
 *
 * `concept` and `anatomy` are free-form (no coverage check) — they are the
 * open-ended dictionary the curator grows by hand.
 */
import { describe, expect, it } from 'vitest';

import {
  ENUM_BACKED_CATEGORIES,
  GROWTH_HABITS,
  GROWTH_RATES,
  LIGHT_LEVELS,
  MOISTURE_LEVELS,
  NATIVE_BIOMES,
  PH_PREFERENCES,
  PLANT_TYPES,
  vocabSlug,
  type EnumBackedCategory,
} from '../../types';
import { glossaryMarkupSlugs } from '../../logic/glossary-markup';
import { loadGlossary, loadPlants, lookupTerm, SUBSTRATE_COMPONENT_IDS } from '..';

const glossary = loadGlossary();

/** The eight controlled vocabularies the coverage check walks. */
const ENUM_VOCAB: Record<EnumBackedCategory, readonly string[]> = {
  light: LIGHT_LEVELS,
  moisture: MOISTURE_LEVELS,
  ph: PH_PREFERENCES,
  growthRate: GROWTH_RATES,
  growthHabit: GROWTH_HABITS,
  plantType: PLANT_TYPES,
  biome: NATIVE_BIOMES,
  substrate: SUBSTRATE_COMPONENT_IDS,
};

describe('enum-backed coverage — every controlled-vocab value has an entry', () => {
  for (const category of ENUM_BACKED_CATEGORIES) {
    for (const value of ENUM_VOCAB[category]) {
      const slug = vocabSlug(category, value);
      it(`${category} "${value}" → "${slug}"`, () => {
        const entry = lookupTerm(slug);
        expect(entry, `missing glossary entry for ${category} "${value}" (slug "${slug}")`).toBeTruthy();
        expect(entry?.category).toBe(category);
      });
    }
  }
});

describe('referential integrity', () => {
  it('ships a non-trivial corpus that loads without throwing', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(70);
  });

  it('has globally-unique slugs', () => {
    expect(new Set(glossary.map((e) => e.slug)).size).toBe(glossary.length);
  });

  it('resolves every seeAlso cross-link', () => {
    for (const e of glossary) {
      for (const ref of e.seeAlso) {
        expect(lookupTerm(ref), `${e.slug} → unknown seeAlso "${ref}"`).toBeTruthy();
      }
    }
  });

  it('disambiguates the moisture/growthRate "moderate" clash (no bare slug claims it)', () => {
    expect(lookupTerm('moderate')).toBeUndefined();
    expect(lookupTerm('moderate-moisture')?.category).toBe('moisture');
    expect(lookupTerm('moderate-growth')?.category).toBe('growthRate');
  });

  it('includes the free-form concept + anatomy groups', () => {
    expect(glossary.some((e) => e.category === 'concept')).toBe(true);
    expect(glossary.some((e) => e.category === 'anatomy')).toBe(true);
  });
});

describe('inline prose links resolve (seed-time integrity)', () => {
  it('every [[slug]] in plant notes / nativeContext resolves to an entry', () => {
    for (const p of loadPlants()) {
      for (const field of [p.notes, p.nativeContext]) {
        if (!field) continue;
        for (const slug of glossaryMarkupSlugs(field)) {
          expect(lookupTerm(slug), `${p.slug}: unresolved [[${slug}]]`).toBeTruthy();
        }
      }
    }
  });
});

describe('definitions are curator-quality prose', () => {
  it('are substantial and end with terminal punctuation', () => {
    for (const e of glossary) {
      expect(e.definition.trim().length, `${e.slug} definition too short`).toBeGreaterThan(20);
      expect(e.definition.trim(), `${e.slug} definition lacks terminal punctuation`).toMatch(/[.!?]$/);
    }
  });
});
