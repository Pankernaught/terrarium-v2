/**
 * Consensus compatibility engine (ADR 0017). The build derives a dominant level per
 * stat; each plant is scored against it on the v1 penalty ladder; the build score is
 * the weakest plant minus build-level penalties. The headline guarantee: one off
 * plant no longer drags down the plants that fit.
 */
import { describe, expect, it } from 'vitest';

import { checkGroup, deriveConsensus, scorePlantVsConsensus } from '../compatibility';
import { makeContainerSpec, makePlant } from './factories';
import type { ConsensusProfile, Conflict } from '../../types';

const byFactor = (conflicts: Conflict[], factor: string) => conflicts.filter((c) => c.factor === factor);
const bySlug = (report: ReturnType<typeof checkGroup>) =>
  Object.fromEntries(report.plantScores.map((p) => [p.slug, p]));

// A roomy container so crowding never interferes with a scoring assertion.
const roomy = () => makeContainerSpec({ shape: 'rectangular', dimensionsCm: '40x25x25', volumeL: 20, opening: 'sealed' });

/** A fully-specified consensus profile, overridable per stat. */
const consensus = (over: Partial<ConsensusProfile> = {}): ConsensusProfile => ({
  light: 'medium',
  soilMoisture: 'moist',
  phPreference: null,
  humidity: [60, 90],
  temperature: [18, 28],
  ...over,
});

// ===========================================================================
// deriveConsensus
// ===========================================================================
describe('deriveConsensus', () => {
  it('picks the plurality of categorical primaries (one plant, one vote)', () => {
    const c = deriveConsensus([
      makePlant({ slug: 'a', light: 'low' }),
      makePlant({ slug: 'b', light: 'low' }),
      makePlant({ slug: 'c', light: 'direct' }),
    ]);
    expect(c.light).toBe('low');
  });

  it('returns "split" when categorical primaries tie (a 1-v-1 build)', () => {
    const c = deriveConsensus([makePlant({ slug: 'a', light: 'low' }), makePlant({ slug: 'b', light: 'medium' })]);
    expect(c.light).toBe('split');
  });

  it('counts only primaries — secondaries do not vote', () => {
    const c = deriveConsensus([
      makePlant({ slug: 'a', light: { primary: 'low', secondary: 'medium' } }),
      makePlant({ slug: 'b', light: { primary: 'low', secondary: 'bright-indirect' } }),
    ]);
    expect(c.light).toBe('low');
  });

  it('pH is null with no declarers, plurality when some declare', () => {
    expect(deriveConsensus([makePlant({ slug: 'a' })]).phPreference).toBeNull();
    expect(
      deriveConsensus([
        makePlant({ slug: 'a', phPreference: 'acidic' }),
        makePlant({ slug: 'b', phPreference: 'acidic' }),
        makePlant({ slug: 'c', phPreference: 'neutral' }),
      ]).phPreference,
    ).toBe('acidic');
  });

  it('numeric consensus is the max-overlap zone', () => {
    const c = deriveConsensus([
      makePlant({ slug: 'a', humidityPctRange: [50, 80] }),
      makePlant({ slug: 'b', humidityPctRange: [60, 90] }),
    ]);
    expect(c.humidity).toEqual([60, 80]);
  });

  it('numeric consensus splits on disjoint equal-coverage zones', () => {
    const c = deriveConsensus([
      makePlant({ slug: 'a', humidityPctRange: [10, 30] }),
      makePlant({ slug: 'b', humidityPctRange: [60, 90] }),
    ]);
    expect(c.humidity).toBe('split');
  });

  it('the majority band wins over a lone outlier (no split)', () => {
    const c = deriveConsensus([
      makePlant({ slug: 'a', humidityPctRange: [60, 90] }),
      makePlant({ slug: 'b', humidityPctRange: [60, 85] }),
      makePlant({ slug: 'c', humidityPctRange: [10, 30] }),
    ]);
    expect(c.humidity).toEqual([60, 85]);
  });

  it('an empty selection has no votes (all null)', () => {
    const c = deriveConsensus([]);
    expect(c.light).toBeNull();
    expect(c.soilMoisture).toBeNull();
    expect(c.humidity).toBeNull();
  });
});

// ===========================================================================
// scorePlantVsConsensus — the shared penalty ladder, plant vs consensus
// ===========================================================================
describe('scorePlantVsConsensus', () => {
  it('a plant matching the consensus on every stat scores 100', () => {
    const ps = scorePlantVsConsensus(makePlant({ slug: 'p' }), consensus());
    expect(ps.score).toBe(100);
    expect(ps.conflicts).toEqual([]);
    expect(ps.survivalCritical).toBe(false);
  });

  it('a one-step light deviation is a -15 caution', () => {
    const ps = scorePlantVsConsensus(makePlant({ slug: 'p', light: 'bright-indirect' }), consensus({ light: 'medium' }));
    expect(ps.score).toBe(85);
    expect(byFactor(ps.conflicts, 'light')[0].severity).toBe('caution');
  });

  it('a secondary that covers the consensus pays only the caution, flagged via-secondary', () => {
    const ps = scorePlantVsConsensus(
      makePlant({ slug: 'p', light: { primary: 'low', secondary: 'medium' } }),
      consensus({ light: 'medium' }),
    );
    expect(ps.score).toBe(85);
    const light = byFactor(ps.conflicts, 'light')[0];
    expect(light.severity).toBe('caution');
    expect(light.viaSecondary).toBe(true);
  });

  it('a lethal light gap (direct vs shade consensus) clamps the plant to <= 20', () => {
    const ps = scorePlantVsConsensus(makePlant({ slug: 'p', light: 'direct' }), consensus({ light: 'low' }));
    expect(ps.survivalCritical).toBe(true);
    expect(ps.score).toBeLessThanOrEqual(20);
    expect(byFactor(ps.conflicts, 'light')[0].severity).toBe('incompatible');
  });

  it('a numeric range disjoint from the consensus zone is survival-critical', () => {
    const ps = scorePlantVsConsensus(makePlant({ slug: 'p', humidityPctRange: [10, 30] }), consensus({ humidity: [60, 90] }));
    expect(ps.survivalCritical).toBe(true);
    expect(ps.score).toBeLessThanOrEqual(20);
  });

  it('container-fit and gas-exchange are per-plant', () => {
    const closed = scorePlantVsConsensus(makePlant({ slug: 'c', closedTerrariumOk: false }), consensus(), makeContainerSpec());
    expect(closed.survivalCritical).toBe(true);
    expect(closed.score).toBeLessThanOrEqual(20);

    const gassy = scorePlantVsConsensus(
      makePlant({ slug: 'g', growthRate: 'fast' }),
      consensus(),
      makeContainerSpec({ volumeL: 0.5, opening: 'sealed' }),
    );
    expect(gassy.score).toBe(95);
    expect(byFactor(gassy.conflicts, 'gas_exchange')).toHaveLength(1);
  });

  it('skips stats with no consensus (split or null) — a tie penalises no plant', () => {
    const ps = scorePlantVsConsensus(makePlant({ slug: 'p', light: 'direct' }), consensus({ light: 'split' }));
    expect(byFactor(ps.conflicts, 'light')).toHaveLength(0);
    expect(ps.score).toBe(100);
  });
});

// ===========================================================================
// checkGroup — weakest link, not an average
// ===========================================================================
describe('checkGroup', () => {
  it('throws on an empty plant list', () => {
    expect(() => checkGroup([], makeContainerSpec())).toThrow(/empty/);
  });

  it('scores a single compatible plant 100', () => {
    const report = checkGroup([makePlant({ slug: 'f' })], makeContainerSpec());
    expect(report.overallScore).toBe(100);
    expect(report.plantScores[0].score).toBe(100);
  });

  it('THE FIX: one lethal plant clamps the build but leaves the matching plants at 100', () => {
    const report = checkGroup(
      [
        makePlant({ slug: 'low1', light: 'low' }),
        makePlant({ slug: 'low2', light: 'low' }),
        makePlant({ slug: 'direct', light: 'direct' }),
      ],
      roomy(),
    );
    expect(report.consensus.light).toBe('low');
    const s = bySlug(report);
    expect(s['low1'].score).toBe(100);
    expect(s['low2'].score).toBe(100);
    expect(s['direct'].survivalCritical).toBe(true);
    expect(report.overallScore).toBeLessThanOrEqual(20);
  });

  it('THE FIX: a non-lethal outlier drags only the build score (min), not the majority', () => {
    const low = [0, 1, 2, 3, 4, 5].map((i) => makePlant({ slug: `low${i}`, light: 'low' }));
    const odd = makePlant({ slug: 'odd', light: 'bright-indirect' });
    const report = checkGroup([...low, odd], roomy());
    const s = bySlug(report);
    expect(s['low0'].score).toBe(100);
    expect(s['odd'].score).toBe(70); // -30 two-step gap, non-survival
    expect(s['odd'].survivalCritical).toBe(false);
    expect(report.overallScore).toBe(70); // weakest link — never averaged up
  });

  it('bounds the overall score to [0, 100] and carries the env envelope', () => {
    const report = checkGroup([makePlant({ slug: 'f' }), makePlant({ slug: 'p', humidityPctRange: [60, 85] })], makeContainerSpec());
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
    expect(report.envEnvelope.humidityMin).toBe(60);
    expect(report.envEnvelope.humidityMax).toBe(85);
  });
});

// ===========================================================================
// checkGroup — ties become a build-level "split" warning, scaled by distance
// ===========================================================================
describe('checkGroup — split warnings', () => {
  it('a 1-step categorical tie is a -5 caution and penalises no plant', () => {
    const report = checkGroup(
      [makePlant({ slug: 'a', soilMoisture: 'moderate' }), makePlant({ slug: 'b', soilMoisture: 'moist' })],
      roomy(),
    );
    expect(report.consensus.soilMoisture).toBe('split');
    const split = byFactor(report.buildWarnings, 'soil_moisture')[0];
    expect(split.severity).toBe('caution');
    expect(report.plantScores.every((p) => p.conflicts.length === 0)).toBe(true);
    expect(report.overallScore).toBe(95); // min(100, 100) − 5
  });

  it('a 2-step categorical tie is a -20 incompatible split', () => {
    const report = checkGroup(
      [makePlant({ slug: 'a', light: 'low' }), makePlant({ slug: 'b', light: 'bright-indirect' })],
      roomy(),
    );
    expect(report.consensus.light).toBe('split');
    const split = byFactor(report.buildWarnings, 'light')[0];
    expect(split.severity).toBe('incompatible');
    expect(report.overallScore).toBe(80); // min(100, 100) − 20
  });

  it('a survival-gap tie (dry vs wet) clamps the build to <= 20, still no per-plant penalty', () => {
    const report = checkGroup(
      [makePlant({ slug: 'a', soilMoisture: 'dry' }), makePlant({ slug: 'b', soilMoisture: 'wet' })],
      roomy(),
    );
    expect(report.consensus.soilMoisture).toBe('split');
    expect(report.overallScore).toBeLessThanOrEqual(20);
    expect(report.plantScores.every((p) => byFactor(p.conflicts, 'soil_moisture').length === 0)).toBe(true);
  });

  it('disjoint numeric bands with no majority are a survival split', () => {
    const report = checkGroup(
      [makePlant({ slug: 'a', humidityPctRange: [10, 30] }), makePlant({ slug: 'b', humidityPctRange: [60, 90] })],
      roomy(),
    );
    expect(report.consensus.humidity).toBe('split');
    expect(byFactor(report.buildWarnings, 'humidity')).toHaveLength(1);
    expect(report.overallScore).toBeLessThanOrEqual(20);
  });
});

// ===========================================================================
// checkGroup — build-level container concerns
// ===========================================================================
describe('checkGroup — container concerns', () => {
  it('flags a closed-incompatible plant per-plant and clamps the build', () => {
    const report = checkGroup([makePlant({ slug: 'cactus', closedTerrariumOk: false })], makeContainerSpec());
    expect(report.plantScores[0].survivalCritical).toBe(true);
    expect(report.overallScore).toBeLessThanOrEqual(20);
  });

  it('cautions a humidity-loving plant in an open container (per-plant)', () => {
    const report = checkGroup(
      [makePlant({ slug: 'f', openTerrariumOk: false })],
      makeContainerSpec({ slug: 'bowl', opening: 'open', suitableFor: 'open' }),
    );
    expect(byFactor(report.plantScores[0].conflicts, 'container_type')[0].severity).toBe('caution');
  });

  it('marks 5 plants on a tiny floor overcrowded (build-level)', () => {
    const plants = [0, 1, 2, 3, 4].map((i) => makePlant({ slug: `p${i}` }));
    const report = checkGroup(plants, makeContainerSpec({ shape: 'cylindrical', dimensionsCm: '10x10x12', volumeL: 1, opening: 'sealed' }));
    expect(byFactor(report.buildWarnings, 'crowding')[0].severity).toBe('incompatible');
    expect(report.overallScore).toBeLessThanOrEqual(20);
  });

  it('never crowds a single plant', () => {
    const report = checkGroup([makePlant({ slug: 'solo' })], makeContainerSpec({ shape: 'cylindrical', dimensionsCm: '10x10x12', volumeL: 1, opening: 'sealed' }));
    expect(byFactor(report.buildWarnings, 'crowding')).toHaveLength(0);
  });
});
