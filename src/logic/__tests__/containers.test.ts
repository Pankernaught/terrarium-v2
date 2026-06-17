/**
 * Tests for `src/logic/containers.ts` — geometry, construction, layer depths,
 * cross-section profile, and recommendations (port of v1's
 * `tests/test_containers.py`).
 *
 * The 3 v1 `test_resolve_*` cases are intentionally **omitted**: they exercise
 * `resolve_build_container`, which is DB-coupled and deferred to a later phase.
 */
import { describe, expect, it } from 'vitest';

import {
  computeVolumeL,
  containerProfile,
  defaultLayerDepths,
  dimensionsToStr,
  makeContainer,
  parseDimensionsStr,
  recommendContainerDimensions,
} from '../containers';
import { makePlant } from './factories';

// --- computeVolumeL --------------------------------------------------------

describe('computeVolumeL', () => {
  it('computes rectangular volume (20×20×25 cm = 10 L)', () => {
    expect(computeVolumeL('rectangular', { length: 20, width: 20, height: 25 })).toBe(10.0);
  });

  it('computes cylindrical volume (⌀12×40)', () => {
    const expected = Number(((Math.PI * 6 ** 2 * 40) / 1000).toFixed(2));
    expect(computeVolumeL('cylindrical', { diameter: 12, height: 40 })).toBe(expected);
  });

  it('rejects an invalid shape', () => {
    expect(() => computeVolumeL('triangle', { length: 1, width: 1, height: 1 })).toThrow(
      /Shape must be one of/,
    );
  });

  it('rejects a non-positive dimension', () => {
    expect(() => computeVolumeL('rectangular', { length: 0, width: 10, height: 10 })).toThrow(
      /positive/,
    );
  });
});

// --- string helpers --------------------------------------------------------

describe('dimensionsToStr', () => {
  it('formats rectangular dimensions', () => {
    expect(dimensionsToStr('rectangular', { length: 30, width: 20, height: 25 })).toBe(
      '30×20×25 cm',
    );
  });

  it('formats cylindrical dimensions', () => {
    expect(dimensionsToStr('cylindrical', { diameter: 12, height: 40 })).toBe('⌀12×40 cm');
  });
});

describe('parseDimensionsStr', () => {
  it('parses rectangular LxWxH', () => {
    expect(parseDimensionsStr('rectangular', '40x25x25')).toEqual({
      length: 40.0,
      width: 25.0,
      height: 25.0,
    });
  });

  it('parses cylindrical, ignoring the duplicate-diameter middle value', () => {
    expect(parseDimensionsStr('cylindrical', '12x12x40')).toEqual({
      diameter: 12.0,
      height: 40.0,
    });
  });
});

// --- makeContainer ---------------------------------------------------------

describe('makeContainer', () => {
  it('marks an open container as open-suitable', () => {
    const c = makeContainer('rectangular', { length: 20, width: 20, height: 20 }, 'open');
    expect(c.shape).toBe('rectangular');
    expect(c.suitableFor).toBe('open');
    expect(c.volumeL).toBe(8.0);
  });

  it('marks a sealed container as closed-suitable', () => {
    const c = makeContainer('cylindrical', { diameter: 10, height: 12 }, 'sealed');
    expect(c.opening).toBe('sealed');
    expect(c.suitableFor).toBe('closed');
  });

  it('rejects an invalid opening', () => {
    expect(() =>
      makeContainer('rectangular', { length: 1, width: 1, height: 1 }, 'screwtop'),
    ).toThrow(/Opening must be one of/);
  });
});

// --- defaultLayerDepths ----------------------------------------------------

describe('defaultLayerDepths', () => {
  it('uses deep substrate + extra drainage for tall, wet plants', () => {
    const plants = [makePlant({ maxHeightCm: 20, soilMoisture: 'wet' })];
    const [substrate, drainage] = defaultLayerDepths(plants, 5.0);
    expect(substrate).toBe(7.0);
    expect(drainage).toBe(2.5);
  });

  it('skips drainage in a micro (<1 L) container', () => {
    const plants = [makePlant({ maxHeightCm: 5, soilMoisture: 'dry' })];
    const [substrate, drainage] = defaultLayerDepths(plants, 0.5);
    expect(substrate).toBe(4.0);
    expect(drainage).toBe(0.0);
  });
});

// --- containerProfile ------------------------------------------------------

describe('containerProfile', () => {
  it('computes band boundaries and headroom', () => {
    const prof = containerProfile(
      'rectangular',
      { length: 20, width: 20, height: 30 },
      5,
      2,
      10,
    );
    expect(prof.drainageTopCm).toBe(2);
    expect(prof.substrateTopCm).toBe(7);
    expect(prof.headroomCm).toBe(23); // 30 - 7
    expect(prof.overflowCm).toBe(0); // 7 + 10 = 17 < 30
  });

  it('detects plant overflow above the rim', () => {
    const prof = containerProfile('cylindrical', { diameter: 12, height: 15 }, 5, 2, 12);
    // planting surface at 7; plant top 19 > 15 => overflow of 4
    expect(prof.overflowCm).toBe(4);
  });
});

// --- recommendContainerDimensions ------------------------------------------

describe('recommendContainerDimensions', () => {
  it('recommends a cylindrical container for a single plant', () => {
    const rec = recommendContainerDimensions([makePlant({ maxHeightCm: 10 })]);
    expect(rec.shape).toBe('cylindrical');
    expect(rec.dimensions.height as number).toBeGreaterThan(10);
    expect(rec.rationale).toBeTruthy();
    expect(rec.rationale.length).toBeGreaterThan(0);
  });

  it('recommends an open container when a plant needs open airflow', () => {
    const plants = [
      makePlant({ slug: 'a', closedTerrariumOk: false, openTerrariumOk: true }),
      makePlant({ slug: 'b' }),
    ];
    const rec = recommendContainerDimensions(plants);
    expect(rec.shape).toBe('rectangular'); // multi-plant
    expect(rec.opening).toBe('open');
  });

  it('recommends a lidded container when all plants tolerate closed', () => {
    const plants = [makePlant({ slug: 'a' }), makePlant({ slug: 'b' })];
    const rec = recommendContainerDimensions(plants);
    expect(rec.opening).toBe('lidded');
  });

  it('rejects an empty plant list', () => {
    expect(() => recommendContainerDimensions([])).toThrow(/no plants/);
  });
});
