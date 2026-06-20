import { describe, expect, it } from 'vitest';

import { filterPlants } from '../browse-filter';
import { makePlant } from './factories';

const fern = makePlant({
  slug: 'maidenhair',
  commonName: 'Maidenhair Fern',
  scientificName: 'Adiantum raddianum',
  plantType: 'fern',
  nativeBiome: 'tropical',
  light: { primary: 'medium', secondary: 'low' },
  difficulty: 4,
  maxHeightCm: 30,
});
const succulent = makePlant({
  slug: 'jade',
  commonName: 'Jade Plant',
  scientificName: 'Crassula ovata',
  plantType: 'succulent',
  nativeBiome: 'arid',
  light: { primary: 'direct' },
  difficulty: 1,
  maxHeightCm: 90,
});
const moss = makePlant({
  slug: 'cushion-moss',
  commonName: 'Cushion Moss',
  scientificName: 'Leucobryum glaucum',
  plantType: 'moss',
  nativeBiome: 'temperate',
  light: { primary: 'low' },
  difficulty: 2,
  maxHeightCm: 3,
});
const all = [fern, succulent, moss];

describe('filterPlants', () => {
  it('returns everything (name-sorted) with no criteria', () => {
    const out = filterPlants(all);
    expect(out.map((p) => p.slug)).toEqual(['cushion-moss', 'jade', 'maidenhair']);
  });

  it('searches common + scientific name, case-insensitively', () => {
    expect(filterPlants(all, { search: 'JADE' }).map((p) => p.slug)).toEqual(['jade']);
    expect(filterPlants(all, { search: 'adiantum' }).map((p) => p.slug)).toEqual(['maidenhair']);
  });

  it('filters by type (multi-select OR)', () => {
    expect(filterPlants(all, { types: ['fern', 'moss'] }).map((p) => p.slug)).toEqual([
      'cushion-moss',
      'maidenhair',
    ]);
  });

  it('filters by biome', () => {
    expect(filterPlants(all, { biomes: ['arid'] }).map((p) => p.slug)).toEqual(['jade']);
  });

  it('matches a light filter on primary OR secondary', () => {
    // 'low' is the fern's *secondary* and the moss's primary — both match.
    expect(filterPlants(all, { lights: ['low'] }).map((p) => p.slug)).toEqual([
      'cushion-moss',
      'maidenhair',
    ]);
  });

  it('filters by difficulty', () => {
    expect(filterPlants(all, { difficulties: [1, 2] }).map((p) => p.slug)).toEqual([
      'cushion-moss',
      'jade',
    ]);
  });

  it('combines criteria (AND across facets)', () => {
    expect(filterPlants(all, { types: ['fern'], lights: ['low'] }).map((p) => p.slug)).toEqual([
      'maidenhair',
    ]);
    expect(filterPlants(all, { types: ['succulent'], lights: ['low'] })).toEqual([]);
  });

  it('sorts by difficulty then height, breaking ties by name', () => {
    expect(filterPlants(all, { sort: 'difficulty' }).map((p) => p.slug)).toEqual([
      'jade',
      'cushion-moss',
      'maidenhair',
    ]);
    expect(filterPlants(all, { sort: 'height' }).map((p) => p.slug)).toEqual([
      'cushion-moss',
      'maidenhair',
      'jade',
    ]);
  });

  it('has no toxicity facet — toxicity is display-only, never a filter', () => {
    // A regression guard: blank ≠ safe, so there is no way to filter by it.
    // @ts-expect-error toxicity is intentionally absent from BrowseCriteria.
    const crit: import('../browse-filter').BrowseCriteria = { toxicity: 'non-toxic' };
    void crit;
  });
});
