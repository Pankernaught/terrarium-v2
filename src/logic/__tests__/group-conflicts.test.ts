import { describe, expect, it } from 'vitest';

import { groupConflicts, type ConflictView } from '../group-conflicts';

const light = (other: string): ConflictView => ({
  withPlantName: other,
  // Same template against different plants — only the names differ.
  message: `Begonia prefers low light; ${other} prefers bright-indirect — secondary overlap, monitor.`,
  severity: 'caution',
});

describe('groupConflicts', () => {
  it('collapses identical-template cautions and moves the extras to alsoPlantNames', () => {
    const out = groupConflicts([light('Velvet'), light('Burle Marx'), light('Creeping Fig')]);
    expect(out).toHaveLength(1);
    expect(out[0].withPlantName).toBe('Velvet');
    expect(out[0].alsoPlantNames).toEqual(['Burle Marx', 'Creeping Fig']);
  });

  it('keeps genuinely different concerns on their own rows', () => {
    const moisture: ConflictView = {
      withPlantName: 'Creeping Fig',
      message: 'Begonia prefers moist; Creeping Fig prefers moderate — secondary overlap.',
      severity: 'caution',
    };
    const out = groupConflicts([light('Creeping Fig'), moisture]);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.alsoPlantNames === undefined)).toBe(true);
  });

  it('sorts incompatible above caution, stable within a severity', () => {
    const caution = light('A');
    const bad: ConflictView = { withPlantName: 'B', message: 'lethal', severity: 'incompatible' };
    const out = groupConflicts([caution, bad]);
    expect(out.map((c) => c.severity)).toEqual(['incompatible', 'caution']);
  });
});
