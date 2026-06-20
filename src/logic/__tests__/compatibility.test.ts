/**
 * Port of `tests/test_compatibility.py` (the 36 v1 cases) plus two net-new
 * case families for the primary/secondary field shape:
 *   A) the distance-0 secondary cap (a secondary-only match is caution, not 100);
 *   B) primaries-only survival (a secondary never rescues — or manufactures — a
 *      lethal pairing).
 */
import { describe, expect, it } from 'vitest';

import { checkGroup, checkPair } from '../compatibility';
import { makeContainerSpec, makePlant } from './factories';
import type { Conflict } from '../../types';

// --- Fixtures (mirror the pytest fixtures) ---------------------------------
const fittonia = () => makePlant();
const peperomia = () =>
  makePlant({
    slug: 'peperomia',
    commonName: 'Peperomia',
    scientificName: 'Peperomia caperata',
    light: 'medium',
    humidityPctRange: [60, 85],
    soilMoisture: 'moderate',
    tempCRange: [18, 26],
    growthRate: 'slow',
    closedTerrariumOk: true,
    openTerrariumOk: true,
  });
const cactus = () =>
  makePlant({
    slug: 'cactus',
    commonName: 'Cactus',
    scientificName: 'Echinopsis pachanoi',
    light: 'direct',
    humidityPctRange: [10, 30],
    soilMoisture: 'dry',
    tempCRange: [10, 40],
    growthRate: 'slow',
    closedTerrariumOk: false,
    openTerrariumOk: true,
  });
const sealedContainer = () => makeContainerSpec();
const openContainer = () =>
  makeContainerSpec({
    slug: 'open-bowl',
    name: 'Open Glass Bowl',
    opening: 'open',
    suitableFor: 'open',
  });

const byFactor = (conflicts: Conflict[], factor: string) =>
  conflicts.filter((c) => c.factor === factor);

// --- check_pair: perfect match ---------------------------------------------
describe('checkPair — perfect match', () => {
  it('scores two identical plants 100 with no conflicts', () => {
    const twin = makePlant({ slug: 'fittonia-2', commonName: 'Nerve Plant 2' });
    const result = checkPair(fittonia(), twin);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('compatible');
    expect(result.conflicts).toEqual([]);
  });

  it('scores similar compatible plants in the compatible range', () => {
    const result = checkPair(fittonia(), peperomia());
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(['compatible', 'caution']).toContain(result.verdict);
  });
});

// --- check_pair: light ------------------------------------------------------
describe('checkPair — light', () => {
  it('deducts 15 for a one-step gap (caution)', () => {
    const bright = makePlant({
      slug: 'bright-plant',
      commonName: 'Bright Plant',
      light: 'bright-indirect',
    });
    const result = checkPair(fittonia(), bright); // medium vs bright-indirect
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('caution');
    expect(result.score).toBe(100 - 15);
  });

  it('deducts >= 30 for a two-step gap (incompatible)', () => {
    const direct = makePlant({ slug: 'sun-plant', commonName: 'Sun Plant', light: 'direct' });
    const result = checkPair(fittonia(), direct); // medium vs direct
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(100 - 30);
  });
});

// --- check_pair: humidity ---------------------------------------------------
describe('checkPair — humidity', () => {
  it('flags non-overlapping humidity as incompatible', () => {
    const result = checkPair(fittonia(), cactus());
    const humidity = byFactor(result.conflicts, 'humidity');
    expect(humidity).toHaveLength(1);
    expect(humidity[0].severity).toBe('incompatible');
  });

  it('produces no humidity conflict when ranges overlap', () => {
    const result = checkPair(fittonia(), peperomia());
    expect(byFactor(result.conflicts, 'humidity')).toEqual([]);
  });
});

// --- check_pair: moisture ---------------------------------------------------
describe('checkPair — soil moisture', () => {
  it('deducts a caution for a one-step gap (moist vs moderate)', () => {
    const result = checkPair(fittonia(), peperomia());
    const moisture = byFactor(result.conflicts, 'soil_moisture');
    expect(moisture).toHaveLength(1);
    expect(moisture[0].severity).toBe('caution');
  });

  it('treats a three-step gap (dry vs wet) as incompatible', () => {
    const dry = makePlant({ slug: 'bog-plant', commonName: 'Bog Plant', soilMoisture: 'dry' });
    const wet = makePlant({ slug: 'wet-plant', commonName: 'Wet Plant', soilMoisture: 'wet' });
    const result = checkPair(wet, dry);
    const moisture = byFactor(result.conflicts, 'soil_moisture');
    expect(moisture).toHaveLength(1);
    expect(moisture[0].severity).toBe('incompatible');
  });
});

// --- check_pair: temperature ------------------------------------------------
describe('checkPair — temperature', () => {
  it('flags non-overlapping temperature ranges as incompatible', () => {
    const cold = makePlant({ slug: 'cold-plant', commonName: 'Cold Plant', tempCRange: [5, 15] });
    const hot = makePlant({ slug: 'hot-plant', commonName: 'Hot Plant', tempCRange: [20, 35] });
    const result = checkPair(cold, hot);
    const temp = byFactor(result.conflicts, 'temperature');
    expect(temp).toHaveLength(1);
    expect(temp[0].severity).toBe('incompatible');
  });
});

// --- check_pair: growth rate is NOT scored ----------------------------------
describe('checkPair — growth rate', () => {
  it('does not score growth-rate differences', () => {
    const slow = makePlant({ slug: 'slow', commonName: 'Slow Plant', growthRate: 'slow' });
    const fast = makePlant({ slug: 'fast', commonName: 'Fast Plant', growthRate: 'fast' });
    const result = checkPair(slow, fast);
    expect(byFactor(result.conflicts, 'growth_rate')).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.verdict).toBe('compatible');
  });
});

// --- check_pair: verdict thresholds -----------------------------------------
describe('checkPair — verdict', () => {
  it('is incompatible when the score drops below 50', () => {
    const result = checkPair(fittonia(), cactus());
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThan(50);
  });

  it('stays consistent with the numeric score', () => {
    const result = checkPair(fittonia(), peperomia());
    if (result.score >= 80) expect(result.verdict).toBe('compatible');
    else if (result.score >= 50) expect(result.verdict).toBe('caution');
    else expect(result.verdict).toBe('incompatible');
  });
});

// --- check_group ------------------------------------------------------------
describe('checkGroup', () => {
  it('throws on an empty plant list', () => {
    expect(() => checkGroup([], makeContainerSpec())).toThrow(/empty/);
  });

  it('scores a single compatible plant in the right container 100', () => {
    const f = fittonia();
    const report = checkGroup([f], sealedContainer());
    expect(report.overallScore).toBe(100);
    expect(report.containerFitIssues).toEqual([]);
    expect(report.pairMatrix[f.slug][f.slug].score).toBe(100);
  });

  it('keeps the pair matrix symmetric (A→B == B→A)', () => {
    const f = fittonia();
    const p = peperomia();
    const report = checkGroup([f, p], sealedContainer());
    expect(report.pairMatrix[f.slug][p.slug].score).toBe(
      report.pairMatrix[p.slug][f.slug].score,
    );
  });

  it('flags a closed-incompatible plant as a container fit issue', () => {
    const report = checkGroup([cactus()], sealedContainer());
    expect(
      report.containerFitIssues.some(
        (c) => c.factor === 'container_type' && c.severity === 'incompatible',
      ),
    ).toBe(true);
    expect(report.overallScore).toBeLessThan(100);
  });

  it('cautions a humidity-loving plant placed in an open container', () => {
    const report = checkGroup([fittonia()], openContainer());
    expect(
      report.containerFitIssues.some(
        (c) => c.factor === 'container_type' && c.severity === 'caution',
      ),
    ).toBe(true);
  });

  it('bounds the overall score to [0, 100]', () => {
    const report = checkGroup([fittonia(), cactus()], sealedContainer());
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('includes a plausible env envelope', () => {
    const report = checkGroup([fittonia(), peperomia()], sealedContainer());
    expect(report.envEnvelope.humidityMin).toBe(60);
    expect(report.envEnvelope.humidityMax).toBe(85);
  });
});

// --- crowding ---------------------------------------------------------------
describe('checkGroup — crowding', () => {
  it('cautions 3 plants in a 1.0 L container', () => {
    const plants = [0, 1, 2].map((i) => makePlant({ slug: `plant-${i}` }));
    const report = checkGroup(plants, makeContainerSpec({ volumeL: 1.0, opening: 'sealed' }));
    const crowding = byFactor(report.containerFitIssues, 'crowding');
    expect(crowding).toHaveLength(1);
    expect(crowding[0].severity).toBe('caution');
    expect(crowding[0].affectedPlants).toHaveLength(3);
  });

  it('marks 5 plants in a 1.0 L container incompatible', () => {
    const plants = [0, 1, 2, 3, 4].map((i) => makePlant({ slug: `plant-${i}` }));
    const report = checkGroup(plants, makeContainerSpec({ volumeL: 1.0, opening: 'sealed' }));
    const crowding = byFactor(report.containerFitIssues, 'crowding');
    expect(crowding).toHaveLength(1);
    expect(crowding[0].severity).toBe('incompatible');
  });

  it('does not flag crowding in a larger 5.0 L container', () => {
    const plants = [0, 1, 2, 3, 4].map((i) => makePlant({ slug: `plant-${i}` }));
    const report = checkGroup(plants, makeContainerSpec({ volumeL: 5.0, opening: 'sealed' }));
    expect(byFactor(report.containerFitIssues, 'crowding')).toHaveLength(0);
  });
});

// --- gas exchange -----------------------------------------------------------
describe('checkGroup — gas exchange', () => {
  it('cautions a fast grower in a <1.0 L sealed container', () => {
    const plants = [makePlant({ slug: 'fast-grower', growthRate: 'fast' })];
    const report = checkGroup(plants, makeContainerSpec({ volumeL: 0.5, opening: 'sealed' }));
    const gas = byFactor(report.containerFitIssues, 'gas_exchange');
    expect(gas).toHaveLength(1);
    expect(gas[0].severity).toBe('caution');
    expect(gas[0].affectedPlants).toContain('fast-grower');
  });

  it('does not trigger gas-exchange at exactly 1.0 L', () => {
    const plants = [makePlant({ slug: 'fast-grower', growthRate: 'fast' })];
    const report = checkGroup(plants, makeContainerSpec({ volumeL: 1.0, opening: 'sealed' }));
    expect(byFactor(report.containerFitIssues, 'gas_exchange')).toHaveLength(0);
  });
});

// --- survival tier ----------------------------------------------------------
describe('checkPair — survival tier', () => {
  it('treats low + direct light as survival-critical', () => {
    const result = checkPair(
      makePlant({ slug: 'low-light-plant', light: 'low' }),
      makePlant({ slug: 'direct-light-plant', light: 'direct' }),
    );
    expect(result.survivalCritical).toBe(true);
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it('treats medium + direct light as survival-critical', () => {
    const result = checkPair(
      makePlant({ slug: 'medium-light-plant', light: 'medium' }),
      makePlant({ slug: 'direct-light-plant', light: 'direct' }),
    );
    expect(result.survivalCritical).toBe(true);
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it('treats bright-indirect + direct as a -30, not survival-critical', () => {
    const result = checkPair(
      makePlant({ slug: 'bright-plant', light: 'bright-indirect' }),
      makePlant({ slug: 'direct-plant', light: 'direct' }),
    );
    expect(result.survivalCritical).toBe(false);
    expect(result.score).toBe(70);
    expect(result.verdict).toBe('caution');
  });

  it('does not call the bright-indirect + direct gap "lethal" (issue #4)', () => {
    // "Lethal" is reserved for the survival branch (direct + low/medium primaries).
    const graduated = checkPair(
      makePlant({ slug: 'bright-plant', light: 'bright-indirect' }),
      makePlant({ slug: 'direct-plant', light: 'direct' }),
    );
    const gLight = byFactor(graduated.conflicts, 'light');
    expect(gLight[0].message).not.toMatch(/lethal/i);

    // The genuine survival gap still reads as lethal.
    const survival = checkPair(
      makePlant({ slug: 'low-plant', light: 'low' }),
      makePlant({ slug: 'direct-plant', light: 'direct' }),
    );
    const sLight = byFactor(survival.conflicts, 'light');
    expect(sLight[0].message).toMatch(/lethal/i);
  });

  it('treats dry + wet moisture as survival-critical', () => {
    const result = checkPair(
      makePlant({ slug: 'dry-plant', soilMoisture: 'dry' }),
      makePlant({ slug: 'wet-plant', soilMoisture: 'wet' }),
    );
    expect(result.survivalCritical).toBe(true);
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it('treats dry + moist moisture (diff 2) as a caution, not survival', () => {
    const result = checkPair(
      makePlant({ slug: 'dry-plant', soilMoisture: 'dry' }),
      makePlant({ slug: 'moist-plant', soilMoisture: 'moist' }),
    );
    expect(result.survivalCritical).toBe(false);
    expect(
      result.conflicts.some((c) => c.factor === 'soil_moisture' && c.severity === 'caution'),
    ).toBe(true);
  });
});

describe('checkGroup — survival clamp', () => {
  it('clamps when a plant is container-type incompatible', () => {
    const report = checkGroup(
      [makePlant({ slug: 'cactus-plant', closedTerrariumOk: false })],
      sealedContainer(),
    );
    expect(report.overallScore).toBeLessThanOrEqual(40);
  });

  it('clamps the whole group when a single pair is survival-critical', () => {
    const report = checkGroup(
      [
        makePlant({ slug: 'low-plant', light: 'low' }),
        makePlant({ slug: 'direct-plant', light: 'direct' }),
        makePlant({ slug: 'perfect-plant', light: 'low' }),
      ],
      makeContainerSpec({ volumeL: 10.0 }),
    );
    expect(report.overallScore).toBeLessThanOrEqual(40);
  });

  it('regression: a fully compatible pair still scores 100', () => {
    const result = checkPair(makePlant({ slug: 'plant-a' }), makePlant({ slug: 'plant-b' }));
    expect(result.score).toBe(100);
    expect(result.survivalCritical).toBe(false);
    expect(result.verdict).toBe('compatible');
  });
});

// --- global environmental collapse (issue #2) -------------------------------
describe('checkGroup — global envelope collapse', () => {
  it('clamps and names the two extreme plants when no shared temperature exists', () => {
    // A–B overlap and B–C overlap (each pair fine), but there is no single
    // temperature all three survive at. Pairwise averaging alone scored this ~95
    // ("Healthy"); the envelope clamp now drops it to "At risk".
    const a = makePlant({ slug: 'cool', commonName: 'Cool Fern', tempCRange: [10, 20] });
    const b = makePlant({ slug: 'mid', commonName: 'Mid Pothos', tempCRange: [18, 25] });
    const c = makePlant({ slug: 'warm', commonName: 'Warm Cactus', tempCRange: [23, 35] });
    const report = checkGroup([a, b, c], makeContainerSpec({ volumeL: 10 }));

    const temp = byFactor(report.containerFitIssues, 'temperature');
    expect(temp).toHaveLength(1);
    expect(temp[0].severity).toBe('incompatible');
    expect(temp[0].message).toContain('Warm Cactus'); // sets the floor (highest min)
    expect(temp[0].message).toContain('Cool Fern'); // sets the ceiling (lowest max)
    expect(temp[0].affectedPlants).toEqual(expect.arrayContaining(['warm', 'cool']));
    expect(report.overallScore).toBeLessThanOrEqual(40);
  });

  it('clamps and names the two extreme plants when no shared humidity exists', () => {
    const a = makePlant({ slug: 'dryish', commonName: 'Dry Plant', humidityPctRange: [10, 30] });
    const b = makePlant({ slug: 'midh', commonName: 'Mid Plant', humidityPctRange: [25, 50] });
    const c = makePlant({ slug: 'humid', commonName: 'Humid Plant', humidityPctRange: [45, 80] });
    const report = checkGroup([a, b, c], makeContainerSpec({ volumeL: 10 }));

    const hum = byFactor(report.containerFitIssues, 'humidity');
    expect(hum).toHaveLength(1);
    expect(hum[0].severity).toBe('incompatible');
    expect(hum[0].message).toContain('Humid Plant'); // floor (highest min)
    expect(hum[0].message).toContain('Dry Plant'); // ceiling (lowest max)
    expect(report.overallScore).toBeLessThanOrEqual(40);
  });

  it('does not flag collapse when a shared range exists', () => {
    const a = makePlant({ slug: 'a', tempCRange: [15, 25] });
    const b = makePlant({ slug: 'b', tempCRange: [18, 28] });
    const report = checkGroup([a, b], makeContainerSpec({ volumeL: 10 }));
    expect(byFactor(report.containerFitIssues, 'temperature')).toHaveLength(0);
    expect(byFactor(report.containerFitIssues, 'humidity')).toHaveLength(0);
  });
});

// --- worst-pair floor (issue #3) --------------------------------------------
describe('checkGroup — worst-pair floor', () => {
  it('caps the group score at the weakest pair + 20 so one bad pair cannot average away', () => {
    // Six identical low-light plants (mutually 100) plus one bright-indirect plant
    // that scores 70 against each (a -30 two-step gap, non-survival). Plain average
    // is ~91; the worst-pair floor caps it at worst(70) + 20 = 90.
    const low = [0, 1, 2, 3, 4, 5].map((i) =>
      makePlant({ slug: `low-${i}`, light: 'low' }),
    );
    const odd = makePlant({ slug: 'odd', light: 'bright-indirect' });
    const report = checkGroup([...low, odd], makeContainerSpec({ volumeL: 10 }));
    expect(report.overallScore).toBe(90);
  });
});

// --- substrate pH -----------------------------------------------------------
describe('checkPair — substrate pH', () => {
  it('produces no conflict for the same band', () => {
    const result = checkPair(
      makePlant({ slug: 'a', phPreference: 'acidic' }),
      makePlant({ slug: 'b', phPreference: 'acidic' }),
    );
    expect(result.conflicts.some((c) => c.factor === 'soil_ph')).toBe(false);
    expect(result.score).toBe(100);
  });

  it('treats one band apart (acidic vs neutral) as a -7 caution', () => {
    const result = checkPair(
      makePlant({ slug: 'a', phPreference: 'acidic' }),
      makePlant({ slug: 'b', phPreference: 'neutral' }),
    );
    const ph = byFactor(result.conflicts, 'soil_ph');
    expect(ph).toHaveLength(1);
    expect(ph[0].severity).toBe('caution');
    expect(result.survivalCritical).toBe(false);
    expect(result.score).toBe(93);
  });

  it('treats the extremes (acidic vs alkaline) as survival-critical', () => {
    const result = checkPair(
      makePlant({ slug: 'a', phPreference: 'acidic' }),
      makePlant({ slug: 'b', phPreference: 'alkaline' }),
    );
    const ph = byFactor(result.conflicts, 'soil_ph');
    expect(ph).toHaveLength(1);
    expect(ph[0].severity).toBe('incompatible');
    expect(result.survivalCritical).toBe(true);
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it('skips pH when either plant lacks a preference', () => {
    const result = checkPair(
      makePlant({ slug: 'a', phPreference: 'acidic' }),
      makePlant({ slug: 'b' }),
    );
    expect(result.conflicts.some((c) => c.factor === 'soil_ph')).toBe(false);
    expect(result.score).toBe(100);
  });
});

// ===========================================================================
// NET-NEW family A — the distance-0 secondary cap
// ===========================================================================
describe('checkPair — secondary cap (net-new, 15a)', () => {
  it('a secondary-only exact light match is a -15 caution, never a free 100', () => {
    const a = makePlant({ slug: 'a', light: { primary: 'low', secondary: 'medium' } });
    const b = makePlant({ slug: 'b', light: 'medium' });
    const result = checkPair(a, b);
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('caution');
    expect(light[0].viaSecondary).toBe(true);
    expect(result.score).toBe(85);
    // Mechanically 85 sits in the >= 80 band, exactly like any single v1 one-step
    // caution (test_check_pair_light_one_step also scores 85). The cap's guarantee
    // is "never a free 100" + a caution-severity conflict, not a forced verdict —
    // the frozen -15 penalty and >= 80 band own the banding. A
    // verdict hard-cap is a noted v2.1 question (see MIGRATION session log).
    expect(result.verdict).toBe('compatible');
  });

  it('a secondary-only exact moisture match is a -7 caution', () => {
    const a = makePlant({ slug: 'a', soilMoisture: { primary: 'dry', secondary: 'moderate' } });
    const b = makePlant({ slug: 'b', soilMoisture: 'moderate' });
    const result = checkPair(a, b);
    const moisture = byFactor(result.conflicts, 'soil_moisture');
    expect(moisture).toHaveLength(1);
    expect(moisture[0].severity).toBe('caution');
    expect(moisture[0].viaSecondary).toBe(true);
    expect(result.score).toBe(93);
  });

  it('via-secondary on both factors composes to 78 (100 − 15 − 7)', () => {
    const a = makePlant({
      slug: 'a',
      light: { primary: 'low', secondary: 'medium' },
      soilMoisture: { primary: 'dry', secondary: 'moderate' },
    });
    const b = makePlant({ slug: 'b', light: 'medium', soilMoisture: 'moderate' });
    const result = checkPair(a, b);
    expect(result.score).toBe(78);
    expect(result.verdict).toBe('caution');
  });

  it('both-secondary (a shared value neither plant calls primary) takes one -15 deduction', () => {
    const a = makePlant({ slug: 'a', light: { primary: 'low', secondary: 'medium' } });
    const b = makePlant({ slug: 'b', light: { primary: 'bright-indirect', secondary: 'medium' } });
    const result = checkPair(a, b);
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('caution');
    expect(light[0].viaSecondary).toBe(true);
    expect(result.score).toBe(85);
  });

  it('a secondary that narrows a two-step gap to one step softens -30 to a -15 caution', () => {
    const withSecondary = checkPair(
      makePlant({ slug: 'a', light: { primary: 'low', secondary: 'medium' } }),
      makePlant({ slug: 'b', light: 'bright-indirect' }),
    );
    const sLight = byFactor(withSecondary.conflicts, 'light');
    expect(sLight[0].severity).toBe('caution');
    expect(sLight[0].viaSecondary).toBe(true);
    expect(withSecondary.score).toBe(85);

    // Same primaries without the rescuing secondary: a -30 incompatible conflict.
    const withoutSecondary = checkPair(
      makePlant({ slug: 'a', light: 'low' }),
      makePlant({ slug: 'b', light: 'bright-indirect' }),
    );
    const pLight = byFactor(withoutSecondary.conflicts, 'light');
    expect(pLight[0].severity).toBe('incompatible');
    expect(pLight[0].viaSecondary).toBeUndefined();
    expect(withoutSecondary.score).toBe(70);
  });
});

// ===========================================================================
// NET-NEW family B — primaries-only survival
// ===========================================================================
describe('checkPair — primaries-only survival (net-new, 15b)', () => {
  it('a secondary does NOT rescue a lethal light pairing (direct + low primaries)', () => {
    const a = makePlant({ slug: 'a', light: { primary: 'direct', secondary: 'medium' } });
    const b = makePlant({ slug: 'b', light: { primary: 'low', secondary: 'medium' } });
    const result = checkPair(a, b);
    expect(result.survivalCritical).toBe(true);
    expect(result.verdict).toBe('incompatible');
    expect(result.score).toBeLessThanOrEqual(40);
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('incompatible');
    // 15b: the "via secondary" annotation is suppressed when survival-critical.
    expect(light[0].viaSecondary).toBeUndefined();
  });

  it('a secondary does NOT rescue a lethal moisture pairing (dry + wet primaries)', () => {
    const a = makePlant({ slug: 'a', soilMoisture: { primary: 'dry', secondary: 'moist' } });
    const b = makePlant({ slug: 'b', soilMoisture: { primary: 'wet', secondary: 'moist' } });
    const result = checkPair(a, b);
    expect(result.survivalCritical).toBe(true);
    expect(result.score).toBeLessThanOrEqual(40);
    const moisture = byFactor(result.conflicts, 'soil_moisture');
    expect(moisture).toHaveLength(1);
    expect(moisture[0].viaSecondary).toBeUndefined();
  });

  it('a secondary does NOT manufacture lethality either (direct only in a secondary)', () => {
    const a = makePlant({ slug: 'a', light: { primary: 'medium', secondary: 'direct' } });
    const b = makePlant({ slug: 'b', light: 'low' });
    const result = checkPair(a, b); // primaries medium + low → graduated, not survival
    expect(result.survivalCritical).toBe(false);
    const light = byFactor(result.conflicts, 'light');
    expect(light).toHaveLength(1);
    expect(light[0].severity).toBe('caution');
    expect(result.score).toBe(85);
  });
});
