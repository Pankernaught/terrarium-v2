/**
 * Phase-4 DoD: a build round-trips **save → reload with placements intact**.
 *
 * Exercises the forward-looking columns that no screen reads until Phases 6–7 —
 * `placements` (the front-plane plant/hardscape layout) and the persisted
 * Substrate-step overrides `substrateDepth` / `drainageDepth` (decision 10) —
 * through the repository (not just the driver), proving they survive a real
 * save/reload via JSON storage with their structure preserved.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { type BuildRepository, createBuildRepository } from '../builds-repo';
import { type Placement } from '../../data/presets';
import { type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

let db: TerrariumDb;
let repo: BuildRepository;

beforeEach(() => {
  ({ db } = makeTestDb());
  repo = createBuildRepository(db);
});

describe('build save → reload round-trip', () => {
  it('preserves placements + substrate/drainage depths + container snapshot', async () => {
    const placements: Placement[] = [
      { slug: 'fittonia-albivenis', x: 0.55, y: 0.68, scale: 0.95 },
      { slug: 'leucobryum-glaucum', x: 0.3, y: 0.82, scale: 0.7 },
    ];

    const saved = await repo.save({
      name: 'Round Trip',
      containerSlug: 'mason-jar-medium',
      containerShape: 'cylindrical',
      containerDimensions: { diameter: 12, height: 18 },
      containerVolumeL: 2.04,
      containerOpening: 'sealed',
      plantSlugs: ['fittonia-albivenis', 'leucobryum-glaucum'],
      tags: ['demo'],
      placements,
      substrateDepth: 5,
      drainageDepth: 2.5,
    });

    const reloaded = await repo.load(saved.id);
    expect(reloaded.placements).toEqual(placements);
    expect(reloaded.substrateDepth).toBe(5);
    expect(reloaded.drainageDepth).toBe(2.5);
    expect(reloaded.containerShape).toBe('cylindrical');
    expect(reloaded.containerDimensions).toEqual({ diameter: 12, height: 18 });
    expect(reloaded.containerOpening).toBe('sealed');
    expect(reloaded.plantSlugs).toEqual(['fittonia-albivenis', 'leucobryum-glaucum']);
  });

  it('defaults the forward-looking columns to null when omitted', async () => {
    const saved = await repo.save({ name: 'Bare', plantSlugs: [], tags: [] });
    const reloaded = await repo.load(saved.id);
    expect(reloaded.placements).toBeNull();
    expect(reloaded.substrateDepth).toBeNull();
    expect(reloaded.drainageDepth).toBeNull();
    expect(reloaded.primaryPhotoId).toBeNull();
  });
});
