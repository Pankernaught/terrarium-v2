/**
 * The Phase-8 additive-column upgrade path (decision 12 / decision 17).
 *
 * `CREATE TABLE IF NOT EXISTS` can't add a column to a store that predates the
 * substrate mixer, so `ensureSubstrateMixColumn` runs a guarded `ALTER TABLE … ADD
 * COLUMN` on open. This proves the branch that actually adds the column (the live
 * `makeTestDb`/device path hits the no-op branch on a fresh DB), and that a v1
 * backup (no `substrateMix` key) restores cleanly with the field defaulting to null.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { restoreBackup } from '../backup';
import { createBuildRepository } from '../builds-repo';
import { createNodeDb } from '../client.node';
import { STORE_SCHEMA_VERSION } from '../migrate';
import { ensureSubstrateMixColumn, SUBSTRATE_MIX_COLUMN } from '../schema';
import { makeTestDb } from './helpers';

/** A `builds` table as it existed BEFORE Phase 8 — no `substrate_mix` column. */
const OLD_BUILDS_DDL = `
CREATE TABLE builds (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  container_slug TEXT,
  container_shape TEXT,
  container_dimensions TEXT,
  container_volume_l REAL,
  container_opening TEXT,
  plant_slugs TEXT NOT NULL,
  tags TEXT NOT NULL,
  description TEXT,
  placements TEXT,
  substrate_depth REAL,
  drainage_depth REAL,
  primary_photo_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

function buildsColumns(sqlite: DatabaseSync): string[] {
  return (sqlite.prepare('PRAGMA table_info(builds)').all() as { name: string }[]).map(
    (c) => c.name,
  );
}

describe('substrate_mix additive ALTER (pre-Phase-8 store upgrade)', () => {
  it('adds the missing column on open, then round-trips a mix through the repo', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(OLD_BUILDS_DDL);
    expect(buildsColumns(sqlite)).not.toContain(SUBSTRATE_MIX_COLUMN);

    // The guarded ALTER — the exact call both drivers make on open.
    ensureSubstrateMixColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));
    expect(buildsColumns(sqlite)).toContain(SUBSTRATE_MIX_COLUMN);

    // Running it again is a no-op (idempotent).
    ensureSubstrateMixColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));

    const repo = createBuildRepository(createNodeDb(sqlite));
    const saved = await repo.save({
      name: 'Upgraded',
      plantSlugs: [],
      tags: [],
      substrateMix: { perlite: 1, peat: 2 },
    });
    const reloaded = await repo.load(saved.id);
    expect(reloaded.substrateMix).toEqual({ perlite: 1, peat: 2 });
  });

  it('restores a v1 backup (no substrateMix) with the field defaulting to null', async () => {
    // A properly-opened current store (full schema incl. the upgraded column).
    const { db } = makeTestDb();

    // A schema-v1 envelope: builds carry no `substrateMix` key at all.
    const v1Envelope = {
      schemaVersion: 1,
      data: {
        builds: [
          {
            id: 'legacy-1',
            name: 'Legacy Build',
            plantSlugs: ['fittonia'],
            tags: [],
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          },
        ],
        careMarks: [],
      },
    };

    // Migrates v1 → current (identity step) then validates + inserts.
    const result = await restoreBackup(db, v1Envelope, STORE_SCHEMA_VERSION);
    expect(result.builds).toBe(1);

    const repo = createBuildRepository(db);
    const reloaded = await repo.load('legacy-1');
    expect(reloaded.substrateMix).toBeNull();
  });
});
