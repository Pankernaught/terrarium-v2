/**
 * First-launch seed gate: `seedStore()` loads the validated bundle into the
 * store's reference tables (counts derived from the loaded seed), is idempotent
 * on re-run (mirrors v1 `load_seed_data`), round-trips a record through JSON, and
 * never touches user-data tables.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { loadSeed } from '../../data';
import { builds, containers, plants, presets, type TerrariumDb } from '../schema';
import { seedStore } from '../seed';
import { makeTestDb } from './helpers';

const seed = loadSeed();

let db: TerrariumDb;
beforeEach(() => {
  ({ db } = makeTestDb());
});

describe('seedStore', () => {
  it('loads all plants / containers / presets into the store', async () => {
    const counts = await seedStore(db, seed);
    expect(counts).toEqual({
      plants: seed.plants.length,
      containers: seed.containers.length,
      presets: seed.presets.length,
    });

    expect(await db.select().from(plants)).toHaveLength(seed.plants.length);
    expect(await db.select().from(containers)).toHaveLength(seed.containers.length);
    expect(await db.select().from(presets)).toHaveLength(seed.presets.length);
  });

  it('is idempotent — re-running keeps the same counts', async () => {
    await seedStore(db, seed);
    await seedStore(db, seed);
    expect(await db.select().from(plants)).toHaveLength(seed.plants.length);
    expect(await db.select().from(containers)).toHaveLength(seed.containers.length);
    expect(await db.select().from(presets)).toHaveLength(seed.presets.length);
  });

  it('round-trips a record through JSON storage', async () => {
    await seedStore(db, seed);
    const sample = seed.plants[0];
    const [row] = await db.select().from(plants).where(eq(plants.slug, sample.slug));
    expect(row).toBeDefined();
    expect((row.data as { slug: string; commonName: string }).commonName).toBe(sample.commonName);
  });

  it('prunes a reference row whose slug is no longer shipped', async () => {
    await seedStore(db, seed);
    // Re-seed with one fewer plant — the dropped slug must be pruned.
    const trimmed = { ...seed, plants: seed.plants.slice(0, -1) };
    await seedStore(db, trimmed);
    expect(await db.select().from(plants)).toHaveLength(seed.plants.length - 1);
  });

  it('does not touch user-data tables', async () => {
    await seedStore(db, seed);
    expect(await db.select().from(builds)).toHaveLength(0);
  });
});
