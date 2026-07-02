import { describe, expect, it } from 'vitest';

import catalog from '../copy.json';
import { copy } from '../../lib/copy';
import { CARE_TASK_TYPES } from '../../logic/careSchedule';

describe('copy()', () => {
  it('returns a static entry verbatim', () => {
    expect(copy('verdict.thriving')).toBe('A thriving ecosystem — every plant suits this setup.');
  });

  it('substitutes {slot} placeholders', () => {
    expect(copy('guide.drainage', { depth: '2 cm', material: 'pebbles' })).toBe(
      'Add 2 cm of pebbles to the bottom of your container. ',
    );
  });

  it('coerces numbers and fills every occurrence', () => {
    expect(copy('compat.crowding.caution', { count: 3, area: 120 })).toBe(
      '3 plants share 120 cm² of floor. They may compete for space, monitor for overcrowding.',
    );
  });

  it('leaves no unfilled placeholder once a template is given its slots', () => {
    expect(copy('compat.temp.lethal', { plant: 'Fern', min: 10, max: 20, bmin: 25, bmax: 35 }))
      .not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('every care task type has a short notification body key', () => {
    for (const type of CARE_TASK_TYPES) {
      const key = `care.notif.body.${type}` as keyof typeof catalog;
      expect(catalog[key], key).toBeTypeOf('string');
      expect(copy(key, { build: 'My terrarium' }), key).toContain('My terrarium');
    }
  });

  it('every catalog value is a string', () => {
    for (const [key, value] of Object.entries(catalog)) {
      expect(typeof value, key).toBe('string');
    }
  });
});
