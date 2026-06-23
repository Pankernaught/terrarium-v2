import { describe, expect, it } from 'vitest';

import { scoreBuild } from '../score-build';
import { makePlant } from './factories';

const fittonia = makePlant({ slug: 'fittonia', commonName: 'Nerve Plant' });
const moss = makePlant({ slug: 'moss', commonName: 'Cushion Moss', closedTerrariumOk: true, openTerrariumOk: true });
const cactus = makePlant({
  slug: 'cactus',
  commonName: 'Barrel Cactus',
  light: 'direct',
  soilMoisture: 'dry',
  closedTerrariumOk: false,
  openTerrariumOk: true,
});
const PLANTS = [fittonia, moss, cactus];

// A sealed container as a geometry snapshot — the only resolution path now that the
// named-container slug lookup is gone.
const SEALED = {
  containerShape: 'cylindrical' as const,
  containerDimensions: { diameter: 12, height: 15 },
  containerOpening: 'sealed' as const,
};

describe('scoreBuild — honest scoring (no swallowed errors)', () => {
  it('scores a healthy build via the container snapshot', () => {
    const result = scoreBuild(
      { plantSlugs: ['fittonia', 'moss'], containerShape: 'rectangular', containerDimensions: { length: 15, width: 15, height: 20 }, containerOpening: 'sealed' },
      PLANTS,
    );
    expect(result.diagnostic).toBeNull();
    expect(result.score).not.toBeNull();
    expect(result.band).not.toBeNull();
    expect(result.verdict?.sentence).toBeTruthy();
  });

  it('empty build scores 100 with a neutral verdict (v1 parity)', () => {
    const result = scoreBuild({ plantSlugs: [] }, PLANTS);
    expect(result.score).toBe(100);
    expect(result.band).toBe('healthy');
    expect(result.diagnostic).toBeNull();
    expect(result.empty).toBe(true);
    expect(result.verdict?.sentence).toMatch(/no plants yet/i);
  });

  it('surfaces a diagnostic when the container is missing — not a silent grey badge', () => {
    const result = scoreBuild({ plantSlugs: ['fittonia'] }, PLANTS);
    expect(result.score).toBeNull();
    expect(result.diagnostic).toMatch(/no container/i);
  });

  it('surfaces a diagnostic naming a missing plant record', () => {
    const result = scoreBuild({ plantSlugs: ['ghost-plant'], ...SEALED }, PLANTS);
    expect(result.score).toBeNull();
    expect(result.diagnostic).toMatch(/missing plant data for: ghost-plant/i);
  });

  it('flags a survival-critical mismatch via the verdict, never throwing past the caller', () => {
    // Cactus in a sealed jar is container-incompatible → low score, real verdict.
    const result = scoreBuild({ plantSlugs: ['cactus'], ...SEALED }, PLANTS);
    expect(result.diagnostic).toBeNull();
    expect(result.band).toBe('critical');
    expect(result.verdict?.sentence).toMatch(/needs attention/i);
  });
});
