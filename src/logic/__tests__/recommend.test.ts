/**
 * Net-new coverage for the decoupled recommender. v1 had no `test_recommend.py`
 * (it reached into the DB), so these guard the Phase 2 refactor: candidates are
 * passed in, selected plants are excluded, ranking/threshold hold, and nothing
 * here touches a store.
 */
import { describe, expect, it } from 'vitest';

import { recommend } from '../recommend';
import { makeContainerSpec, makePlant } from './factories';

const sealed = () => makeContainerSpec();

describe('recommend', () => {
  it('excludes already-selected plants from the candidate pool', () => {
    const selected = [makePlant({ slug: 'fittonia' })];
    const candidates = [makePlant({ slug: 'fittonia' }), makePlant({ slug: 'peperomia' })];
    const recs = recommend(selected, sealed(), candidates);
    expect(recs.map((r) => r.plant.slug)).toEqual(['peperomia']);
  });

  it('scores every candidate 100 when nothing is selected yet', () => {
    const candidates = [makePlant({ slug: 'a' }), makePlant({ slug: 'b' })];
    const recs = recommend([], sealed(), candidates);
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.fitScore === 100)).toBe(true);
  });

  it('ranks a compatible candidate above an incompatible one and drops fit < 50', () => {
    const selected = [makePlant({ slug: 'low-light', light: 'low' })];
    const compatible = makePlant({ slug: 'good', light: 'low' });
    // direct vs low primaries → survival-critical → clamped to 40 → below the 50 cutoff.
    const lethal = makePlant({ slug: 'bad', light: 'direct' });
    const recs = recommend(selected, makeContainerSpec({ volumeL: 10 }), [compatible, lethal]);
    expect(recs.map((r) => r.plant.slug)).toEqual(['good']);
    expect(recs[0].fitScore).toBe(100);
  });

  it('honours the result limit', () => {
    const candidates = Array.from({ length: 12 }, (_, i) => makePlant({ slug: `p-${i}` }));
    const recs = recommend([], sealed(), candidates, 5);
    expect(recs).toHaveLength(5);
  });

  it('adds a primary/secondary-aware light reason from the primary value', () => {
    const selected = [makePlant({ slug: 'sel', light: { primary: 'medium', secondary: 'low' } })];
    const candidate = makePlant({ slug: 'cand', light: 'medium' });
    const recs = recommend(selected, sealed(), [candidate]);
    expect(recs[0].reasons).toContain('Matches light requirement (medium)');
  });
});
