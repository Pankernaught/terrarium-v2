import { describe, expect, it } from 'vitest';

import catalog from '../copy.json';
import { copy } from '../../lib/copy';

describe('copy()', () => {
  it('returns a static entry verbatim', () => {
    expect(copy('verdict.thriving')).toBe('A thriving ecosystem — every plant suits this setup.');
  });

  it('substitutes {slot} placeholders', () => {
    expect(copy('guide.drainage', { depth: '2 cm', material: 'pebbles' })).toBe(
      'Add 2 cm of pebbles to the bottom.',
    );
  });

  it('coerces numbers and fills every occurrence', () => {
    expect(copy('compat.crowding.caution', { count: 3, area: 120 })).toBe(
      '3 plants share 120 cm² of floor — tight, monitor for overcrowding.',
    );
  });

  it('leaves no unfilled placeholder once a template is given its slots', () => {
    expect(copy('compat.temp.noOverlap', { a: 'Fern', b: 'Cactus', aMin: 10, aMax: 20, bMin: 25, bMax: 35 }))
      .not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('every catalog value is a string', () => {
    for (const [key, value] of Object.entries(catalog)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
