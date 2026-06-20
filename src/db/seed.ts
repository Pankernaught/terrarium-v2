/**
 * First-launch seed load — mirrors v1 `db/loader.py::load_seed_data`.
 *
 * The bundle (`src/data`) is the source of truth; this syncs it
 * into the store's **reference tables** (`plants` / `containers` / `presets`) so
 * the rows are queryable alongside user data. On every call each record is
 * **upserted by slug** and any reference row whose slug no longer ships is
 * **pruned** — so the function is idempotent and safe to run on every launch
 * (re-running with the same bundle is a no-op), exactly like v1.
 *
 * User data (`builds` / `build_photos` / `care_marks`) is never touched here; a
 * build that references a removed slug simply points at a missing plant/container.
 * Reference data is regenerable from the bundle and never enters a backup, which
 * is why it is not modelled as the engine's read path — the
 * engine reads the bundle directly (`loadPlants()` etc.).
 */
import { notInArray, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { loadSeed } from '../data';
import { containers, plants, presets, type TerrariumDb } from './schema';

interface Slugged {
  slug: string;
}

/** Upsert every `{ slug, data }` row, then prune slugs that are no longer shipped. */
async function syncBySlug<T extends Slugged>(
  db: TerrariumDb,
  // The reference tables share the `{ slug, data }` shape; typed loosely so one
  // helper serves all three.
  table: SQLiteTable & { slug: any },
  records: readonly T[],
): Promise<void> {
  if (records.length > 0) {
    const rows = records.map((r) => ({ slug: r.slug, data: r }));
    await db
      .insert(table)
      .values(rows)
      .onConflictDoUpdate({ target: table.slug, set: { data: sql`excluded.data` } });
  }
  const keep = records.map((r) => r.slug);
  // Prune removed slugs. With an empty bundle every reference row is dropped.
  await db.delete(table).where(keep.length > 0 ? notInArray(table.slug, keep) : sql`1 = 1`);
}

export interface SeedCounts {
  plants: number;
  containers: number;
  presets: number;
}

/**
 * Load (or refresh) the bundled seed into the store's reference tables. Idempotent
 * — call it once on first launch and harmlessly on every launch thereafter.
 * Returns the row counts actually shipped (the validated bundle), so the caller /
 * tests can assert the 92 / 16 / presets gate.
 */
export async function seedStore(db: TerrariumDb, seed = loadSeed()): Promise<SeedCounts> {
  await syncBySlug(db, plants, seed.plants);
  await syncBySlug(db, containers, seed.containers);
  await syncBySlug(db, presets, seed.presets);
  return {
    plants: seed.plants.length,
    containers: seed.containers.length,
    presets: seed.presets.length,
  };
}
