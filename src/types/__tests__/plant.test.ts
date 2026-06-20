/**
 * Types port of `tests/test_models.py`.
 *
 * Only the 2 plant cases port directly; the other 5 cases in test_models.py
 * validated the social schemas, which are scrapped (social sharing is cut).
 * They are replaced here by zod-validation cases that exercise the v2 controlled
 * vocabularies — the direct analog of the v1 Pydantic field_validators — plus the
 * primary/secondary reshape. The ORM-coercion case (flat columns -> tuple) is a
 * v1 SQLAlchemy concern with no v2 equivalent: the Plant arrives pre-shaped from
 * JSON / Drizzle; we instead assert the range fields parse as tuples.
 */
import { describe, expect, it } from 'vitest';

import { containerSchema, plantSchema } from '../index';
import { makePlant } from '../../logic/__tests__/factories';

const validPlant = {
  slug: 'fittonia-albivenis',
  commonName: 'Nerve Plant',
  scientificName: 'Fittonia albivenis',
  light: { primary: 'medium' as const },
  humidityPctRange: [60, 90] as [number, number],
  soilMoisture: { primary: 'moist' as const },
  tempCRange: [18, 28] as [number, number],
  maxHeightCm: 15,
  growthRate: 'slow' as const,
  substrateTags: ['peat', 'perlite'],
  closedTerrariumOk: true,
  openTerrariumOk: false,
  difficulty: 2,
};

describe('plantSchema', () => {
  it('parses a valid plant', () => {
    const plant = plantSchema.parse(validPlant);
    expect(plant.slug).toBe('fittonia-albivenis');
  });

  it('keeps humidity/temp as numeric tuples', () => {
    const plant = plantSchema.parse(validPlant);
    expect(plant.humidityPctRange).toEqual([60, 90]);
    expect(plant.tempCRange).toEqual([18, 28]);
  });

  it('defaults substrateTags to an empty array', () => {
    const { substrateTags: _omit, ...withoutTags } = validPlant;
    const plant = plantSchema.parse(withoutTags);
    expect(plant.substrateTags).toEqual([]);
  });

  it('accepts a light/moisture secondary condition', () => {
    const plant = makePlant({
      light: { primary: 'low', secondary: 'medium' },
      soilMoisture: { primary: 'moist', secondary: 'wet' },
    });
    expect(plant.light.secondary).toBe('medium');
    expect(plant.soilMoisture.secondary).toBe('wet');
  });

  it('leaves pH as a scalar preference with no secondary', () => {
    const plant = makePlant({ phPreference: 'acidic' });
    expect(plant.phPreference).toBe('acidic');
    expect('secondary' in (plant as Record<string, unknown>)).toBe(false);
  });

  it('rejects an out-of-vocabulary light primary', () => {
    expect(() =>
      plantSchema.parse({ ...validPlant, light: { primary: 'sunny' } }),
    ).toThrow();
  });

  it('rejects an out-of-vocabulary soil-moisture primary', () => {
    expect(() =>
      plantSchema.parse({ ...validPlant, soilMoisture: { primary: 'damp' } }),
    ).toThrow();
  });

  it('rejects an invalid growth rate', () => {
    expect(() =>
      plantSchema.parse({ ...validPlant, growthRate: 'explosive' }),
    ).toThrow();
  });

  it('rejects an out-of-band pH preference', () => {
    expect(() =>
      plantSchema.parse({ ...validPlant, phPreference: 'caustic' }),
    ).toThrow();
  });

  it('rejects a difficulty outside 1..5', () => {
    expect(() => plantSchema.parse({ ...validPlant, difficulty: 6 })).toThrow();
    expect(() => plantSchema.parse({ ...validPlant, difficulty: 0 })).toThrow();
  });
});

describe('containerSchema', () => {
  it('defaults shape to rectangular', () => {
    const c = containerSchema.parse({
      slug: 'jar',
      name: 'Jar',
      volumeL: 5,
      opening: 'sealed',
      dimensionsCm: '15x15x20',
      suitableFor: 'closed',
    });
    expect(c.shape).toBe('rectangular');
  });

  it('rejects an invalid opening', () => {
    expect(() =>
      containerSchema.parse({
        slug: 'jar',
        name: 'Jar',
        volumeL: 5,
        opening: 'corked',
        dimensionsCm: '15x15x20',
        suitableFor: 'closed',
      }),
    ).toThrow();
  });
});
