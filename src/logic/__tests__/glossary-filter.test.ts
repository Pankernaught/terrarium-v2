import { describe, expect, it } from 'vitest';

import { filterGlossary } from '../glossary-filter';
import type { GlossaryCategory, GlossaryEntry } from '../../types';

function entry(
  slug: string,
  term: string,
  category: GlossaryCategory,
  definition: string,
): GlossaryEntry {
  return { slug, term, category, definition, seeAlso: [] };
}

const brightIndirect = entry(
  'bright-indirect',
  'Bright indirect light',
  'light',
  'Strong even light without direct rays on the leaves.',
);
const epiphyte = entry(
  'epiphyte',
  'Epiphyte',
  'concept',
  'A plant that grows on another surface rather than in soil.',
);
const rhizome = entry(
  'rhizome',
  'Rhizome',
  'anatomy',
  'A horizontal creeping stem that sends up leaves and down roots.',
);
const moss = entry('moss', 'Moss', 'plantType', 'A rootless non-vascular plant forming soft carpets.');
const all = [brightIndirect, epiphyte, rhizome, moss];

describe('filterGlossary', () => {
  it('returns everything term-sorted with no criteria', () => {
    expect(filterGlossary(all).map((e) => e.slug)).toEqual([
      'bright-indirect',
      'epiphyte',
      'moss',
      'rhizome',
    ]);
  });

  it('searches the display term, case-insensitively', () => {
    expect(filterGlossary(all, { search: 'EPIPHYTE' }).map((e) => e.slug)).toEqual(['epiphyte']);
  });

  it('searches the slug', () => {
    expect(filterGlossary(all, { search: 'bright-indirect' }).map((e) => e.slug)).toEqual([
      'bright-indirect',
    ]);
  });

  it('searches the definition body', () => {
    // "creeping" appears only in the rhizome definition.
    expect(filterGlossary(all, { search: 'creeping' }).map((e) => e.slug)).toEqual(['rhizome']);
  });

  it('filters by category (multi-select OR)', () => {
    expect(filterGlossary(all, { categories: ['concept', 'anatomy'] }).map((e) => e.slug)).toEqual([
      'epiphyte',
      'rhizome',
    ]);
  });

  it('combines search AND category', () => {
    expect(filterGlossary(all, { search: 'plant', categories: ['concept'] }).map((e) => e.slug)).toEqual([
      'epiphyte',
    ]);
    expect(filterGlossary(all, { search: 'plant', categories: ['light'] })).toEqual([]);
  });

  it('treats empty search / empty category list as no filter', () => {
    expect(filterGlossary(all, { search: '   ', categories: [] })).toHaveLength(all.length);
  });
});
