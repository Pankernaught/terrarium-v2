/**
 * The additive-column upgrade path for `charcoal_depth`.
 *
 * Same guard pattern as `substrate_mix`: `CREATE TABLE IF NOT EXISTS` can't add a
 * column to a store that predates the charcoal layer, so `ensureCharcoalDepthColumn`
 * runs a guarded `ALTER TABLE … ADD COLUMN` on open. This proves the branch that
 * actually adds the column and that a charcoal depth round-trips through the repo.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { restoreBackup } from '../backup';
import { createBuildRepository } from '../builds-repo';
import { createNodeDb } from '../client.node';
import { STORE_SCHEMA_VERSION } from '../migrate';
import { CHARCOAL_DEPTH_COLUMN, ensureCharcoalDepthColumn } from '../schema';
import { makeTestDb } from './helpers';

/** A `builds` table from before the charcoal layer shipped — no `charcoal_depth`. */
const PRE_CHARCOAL_BUILDS_DDL = `
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
  substrate_mix TEXT,
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

describe('charcoal_depth additive ALTER (pre-charcoal-layer store upgrade)', () => {
  it('adds the missing column on open, then round-trips a depth through the repo', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(PRE_CHARCOAL_BUILDS_DDL);
    expect(buildsColumns(sqlite)).not.toContain(CHARCOAL_DEPTH_COLUMN);

    ensureCharcoalDepthColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));
    expect(buildsColumns(sqlite)).toContain(CHARCOAL_DEPTH_COLUMN);

    // Idempotent — a second open is a no-op.
    ensureCharcoalDepthColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));

    const repo = createBuildRepository(createNodeDb(sqlite));
    const saved = await repo.save({ name: 'Charcoal build', plantSlugs: [], tags: [], charcoalDepth: 1.5 });
    const reloaded = await repo.load(saved.id);
    expect(reloaded.charcoalDepth).toBe(1.5);
  });

  it('restores a backup with no charcoalDepth key, defaulting the field to null', async () => {
    const { db } = makeTestDb();
    const envelope = {
      schemaVersion: 1,
      data: {
        builds: [
          {
            id: 'legacy-charcoal',
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

    const result = await restoreBackup(db, envelope, STORE_SCHEMA_VERSION);
    expect(result.builds).toBe(1);

    const repo = createBuildRepository(db);
    const reloaded = await repo.load('legacy-charcoal');
    expect(reloaded.charcoalDepth).toBeNull();
  });
});
