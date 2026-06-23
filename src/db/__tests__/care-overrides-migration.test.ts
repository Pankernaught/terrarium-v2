/**
 * The additive-column upgrade path for `care_overrides`.
 *
 * `CREATE TABLE IF NOT EXISTS` can't add a column to a store that predates the
 * customizable care cycle, so `ensureCareOverridesColumn` runs a guarded `ALTER
 * TABLE … ADD COLUMN` on open. This proves the branch that actually adds the column
 * (the live `makeTestDb`/device path hits the no-op branch on a fresh DB), and that a
 * backup with no `careOverrides` key restores cleanly with the field defaulting to null.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { restoreBackup } from '../backup';
import { createBuildRepository } from '../builds-repo';
import { createNodeDb } from '../client.node';
import { STORE_SCHEMA_VERSION } from '../migrate';
import { CARE_OVERRIDES_COLUMN, ensureCareOverridesColumn } from '../schema';
import { makeTestDb } from './helpers';

/** A `builds` table as it existed before the care-cycle editor — no `care_overrides`. */
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
  charcoal_depth REAL,
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

describe('care_overrides additive ALTER (pre-care-editor store upgrade)', () => {
  it('adds the missing column on open, then round-trips overrides through the repo', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(OLD_BUILDS_DDL);
    expect(buildsColumns(sqlite)).not.toContain(CARE_OVERRIDES_COLUMN);

    // The guarded ALTER — the exact call both drivers make on open.
    ensureCareOverridesColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));
    expect(buildsColumns(sqlite)).toContain(CARE_OVERRIDES_COLUMN);

    // Running it again is a no-op (idempotent).
    ensureCareOverridesColumn(buildsColumns(sqlite), (sql) => sqlite.exec(sql));

    const repo = createBuildRepository(createNodeDb(sqlite));
    const saved = await repo.save({
      name: 'Upgraded',
      plantSlugs: [],
      tags: [],
      careOverrides: { 'watering-inspection': { intervalDays: 4 }, trimming: { muted: true } },
    });
    const reloaded = await repo.load(saved.id);
    expect(reloaded.careOverrides).toEqual({
      'watering-inspection': { intervalDays: 4 },
      trimming: { muted: true },
    });

    // An update clears it back to null.
    const cleared = await repo.update(saved.id, { careOverrides: null });
    expect(cleared.careOverrides).toBeNull();
  });

  it('restores a backup without careOverrides with the field defaulting to null', async () => {
    const { db } = makeTestDb();

    const envelope = {
      schemaVersion: STORE_SCHEMA_VERSION,
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

    const result = await restoreBackup(db, envelope, STORE_SCHEMA_VERSION);
    expect(result.builds).toBe(1);

    const repo = createBuildRepository(db);
    const reloaded = await repo.load('legacy-1');
    expect(reloaded.careOverrides).toBeNull();
  });
});
