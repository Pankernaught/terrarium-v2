import { describe, expect, it } from 'vitest';

import { scoreBuild } from '../score-build';
import { makeContainerSpec, makePlant } from './factories';

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
const sealedJar = makeContainerSpec({ slug: 'nano-sealed', opening: 'sealed' });
const CONTAINERS = [sealedJar];

describe('scoreBuild — honest scoring (no swallowed errors)', () => {
  it('scores a healthy build via the container snapshot', () => {
    const result = scoreBuild(
      { plantSlugs: ['fittonia', 'moss'], containerShape: 'rectangular', containerDimensions: { length: 15, width: 15, height: 20 }, containerOpening: 'sealed' },
      PLANTS,
      CONTAINERS,
    );
    expect(result.diagnostic).toBeNull();
    expect(result.score).not.toBeNull();
    expect(result.band).not.toBeNull();
    expect(result.verdict?.sentence).toBeTruthy();
  });

  it('resolves a container by slug when there is no snapshot', () => {
    const result = scoreBuild({ plantSlugs: ['fittonia'], containerSlug: 'nano-sealed' }, PLANTS, CONTAINERS);
    expect(result.diagnostic).toBeNull();
    expect(result.score).not.toBeNull();
  });

  it('empty build scores 100 with a neutral verdict (v1 parity)', () => {
    const result = scoreBuild({ plantSlugs: [] }, PLANTS, CONTAINERS);
    expect(result.score).toBe(100);
    expect(result.band).toBe('healthy');
    expect(result.diagnostic).toBeNull();
    expect(result.empty).toBe(true);
    expect(result.verdict?.sentence).toMatch(/no plants yet/i);
  });

  it('surfaces a diagnostic when the container is missing — not a silent grey badge', () => {
    const result = scoreBuild({ plantSlugs: ['fittonia'] }, PLANTS, CONTAINERS);
    expect(result.score).toBeNull();
    expect(result.diagnostic).toMatch(/no container/i);
  });

  it('surfaces a diagnostic naming a missing plant record', () => {
    const result = scoreBuild({ plantSlugs: ['ghost-plant'], containerSlug: 'nano-sealed' }, PLANTS, CONTAINERS);
    expect(result.score).toBeNull();
    expect(result.diagnostic).toMatch(/missing plant data for: ghost-plant/i);
  });

  it('flags a survival-critical mismatch via the verdict, never throwing past the caller', () => {
    // Cactus in a sealed jar is container-incompatible → low score, real verdict.
    const result = scoreBuild({ plantSlugs: ['cactus'], containerSlug: 'nano-sealed' }, PLANTS, CONTAINERS);
    expect(result.diagnostic).toBeNull();
    expect(result.band).toBe('critical');
    expect(result.verdict?.sentence).toMatch(/at risk/i);
  });
});
