import { describe, expect, it } from 'vitest';

import type { Conflict, GroupReport } from '@/types/results';

import { summarizeVerdict } from '../verdict';

const ENV: GroupReport['envEnvelope'] = {
  humidityMin: 0,
  humidityMax: 100,
  tempMin: 0,
  tempMax: 40,
  compatibleLights: [],
  compatibleMoisture: [],
};

function report(overallScore: number, opts: {
  /** Conflicts pinned on plant `b` (the deviant); `a` stays a clean 100. */
  plant?: Conflict[];
  /** Build-level warnings (splits, crowding). */
  build?: Conflict[];
} = {}): GroupReport {
  const plantConflicts = opts.plant ?? [];
  return {
    overallScore,
    plantScores: [
      { slug: 'a', score: 100, conflicts: [], survivalCritical: false },
      {
        slug: 'b',
        score: overallScore,
        conflicts: plantConflicts,
        survivalCritical: plantConflicts.some((c) => c.severity === 'incompatible'),
      },
    ],
    consensus: {
      light: 'medium',
      soilMoisture: 'moist',
      phPreference: null,
      humidity: [40, 80],
      temperature: [15, 28],
    },
    buildWarnings: opts.build ?? [],
    envEnvelope: ENV,
  };
}

const caution = (msg: string): Conflict => ({ factor: 'light', severity: 'caution', message: msg, affectedPlants: ['a', 'b'] });
const critical = (msg: string): Conflict => ({ factor: 'container_type', severity: 'incompatible', message: msg, affectedPlants: ['a'] });

describe('summarizeVerdict', () => {
  it('empty build → neutral nudge, no false "Healthy"', () => {
    const v = summarizeVerdict(report(100), 0);
    expect(v.sentence).toMatch(/no plants yet/i);
    expect(v.issueCount).toBe(0);
  });

  it('no conflicts → thriving', () => {
    const v = summarizeVerdict(report(100), 2);
    expect(v.band).toBe('healthy');
    expect(v.sentence).toMatch(/thriving/i);
  });

  it('a single caution is named in the sentence', () => {
    const v = summarizeVerdict(report(78, { plant: [caution('wants more light')] }), 2);
    expect(v.sentence).toBe('Mostly healthy — wants more light');
    expect(v.issueCount).toBe(1);
  });

  it('multiple cautions roll up with a "+N more"', () => {
    const v = summarizeVerdict(report(60, { plant: [caution('first issue'), caution('second issue')] }), 2);
    expect(v.sentence).toMatch(/first issue \(\+1 more to review\)/);
    expect(v.issueCount).toBe(2);
  });

  it('a survival-critical conflict leads, even over cautions', () => {
    const v = summarizeVerdict(
      report(35, { plant: [critical('not suitable for sealed terrariums'), caution('also this')] }),
      2,
    );
    expect(v.sentence).toMatch(/^Needs attention — not suitable/);
    expect(v.band).toBe('critical');
  });
});
