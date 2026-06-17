import { beforeEach, describe, expect, it } from 'vitest';

import { backupDataSchema, exportBackup, NotABackupError, restoreBackup } from '../backup';
import { createBuildRepository, type BuildRepository } from '../builds-repo';
import { newId } from '../ids';
import { STORE_SCHEMA_VERSION } from '../migrate';
import { createPhotoRepository, type PhotoRepository } from '../photos-repo';
import { careMarks, type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

/** Insert a care-mark directly (Phase 7 owns the repo; the backup carries the rows). */
async function addCareMark(db: TerrariumDb, buildId: string, kind: string, note?: string) {
  await db.insert(careMarks).values({
    id: newId(),
    buildId,
    plantSlug: null,
    kind,
    note: note ?? null,
    dueAt: null,
    completedAt: null,
    createdAt: new Date(),
  });
}

/** Simulate the file trip: serialize to JSON and parse back (Date → ISO string). */
function throughFile<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('whole-app backup/restore (decisions 7 / 17)', () => {
  let source: TerrariumDb;
  let builds: BuildRepository;

  beforeEach(async () => {
    source = makeTestDb().db;
    builds = createBuildRepository(source);
  });

  it('round-trips builds + placements + care-marks identically into a fresh store', async () => {
    const a = await builds.save({
      name: 'Mossy Jar',
      plantSlugs: ['fittonia', 'moss'],
      tags: ['sealed', 'beginner'],
      containerShape: 'rectangular',
      containerDimensions: { length: 15, width: 15, height: 20 },
      containerOpening: 'sealed',
      placements: [{ slug: 'fittonia', x: 0.3, y: 0.6, scale: 1 }],
    });
    const b = await builds.save({ name: 'Desert Bowl', plantSlugs: ['cactus'], tags: [] });
    await addCareMark(source, a.id, 'water', 'weekly');
    await addCareMark(source, b.id, 'mist');

    const envelope = await exportBackup(source, '1.0.0');
    expect(envelope.schemaVersion).toBe(STORE_SCHEMA_VERSION);

    // Restore into a *fresh* store (proves replace + that care-marks rebind).
    const target = makeTestDb().db;
    const targetBuilds = createBuildRepository(target);
    const result = await restoreBackup(target, throughFile(envelope));

    expect(result).toEqual({ builds: 2, careMarks: 2 });

    const restored = await targetBuilds.load(a.id);
    expect(restored.name).toBe('Mossy Jar');
    expect(restored.plantSlugs).toEqual(['fittonia', 'moss']);
    expect(restored.tags).toEqual(['sealed', 'beginner']);
    expect(restored.placements).toEqual([{ slug: 'fittonia', x: 0.3, y: 0.6, scale: 1 }]);
    expect(restored.createdAt.getTime()).toBe(a.createdAt.getTime());

    const restoredMarks = await target.select().from(careMarks);
    expect(restoredMarks).toHaveLength(2);
    // care-marks are still bound to their builds across the round-trip (UUID PKs).
    const ids = new Set([a.id, b.id]);
    expect(restoredMarks.every((m) => ids.has(m.buildId))).toBe(true);
  });

  it('replaces (not merges) — restoring wipes existing user data first', async () => {
    const target = makeTestDb().db;
    const targetBuilds = createBuildRepository(target);
    await targetBuilds.save({ name: 'Pre-existing', plantSlugs: [], tags: [] });

    await builds.save({ name: 'From Backup', plantSlugs: [], tags: [] });
    const envelope = await exportBackup(source);
    await restoreBackup(target, throughFile(envelope));

    const after = await targetBuilds.list();
    expect(after.map((x) => x.name)).toEqual(['From Backup']);
  });

  it('refuses a newer-than-current file with a clear message — no half-import', async () => {
    await builds.save({ name: 'Keep me', plantSlugs: [], tags: [] });
    const newer = { schemaVersion: STORE_SCHEMA_VERSION + 1, data: { builds: [], careMarks: [] } };

    await expect(restoreBackup(source, newer)).rejects.toThrow(/newer version/i);
    // The pre-existing build is untouched (validation/migration runs before any write).
    expect(await builds.list()).toHaveLength(1);
  });

  it('rejects a corrupt payload as a whole — never a partial restore', async () => {
    await builds.save({ name: 'Keep me', plantSlugs: [], tags: [] });
    // One good build, one missing its required `name` → the whole file must reject.
    const corrupt = {
      schemaVersion: STORE_SCHEMA_VERSION,
      data: {
        builds: [
          { id: 'ok', name: 'Fine', plantSlugs: [], tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'bad', plantSlugs: [], tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ],
        careMarks: [],
      },
    };
    await expect(restoreBackup(source, corrupt)).rejects.toThrow();
    // No half-import: still exactly the original build, nothing from the corrupt file.
    const list = await builds.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Keep me');
  });

  it('rejects a file that is not a backup envelope at all', async () => {
    await expect(restoreBackup(source, { hello: 'world' })).rejects.toBeInstanceOf(NotABackupError);
    await expect(restoreBackup(source, null)).rejects.toBeInstanceOf(NotABackupError);
  });

  it('degrades a missing photo to no-primary (placeholder hero), never a crash', async () => {
    const built = await builds.save({ name: 'Had a photo', plantSlugs: [], tags: [] });
    const photos: PhotoRepository = createPhotoRepository(source);
    await photos.add(built.id, 'file:///tmp/hero.jpg');

    // Export, then restore into a fresh store: the photo rows do NOT ride along.
    const envelope = await exportBackup(source);
    const target = makeTestDb().db;
    const targetPhotos = createPhotoRepository(target);
    await restoreBackup(target, throughFile(envelope));

    // primaryPhotoId may still be set, but the photo is gone → graceful null.
    await expect(targetPhotos.getPrimary(built.id)).resolves.toBeNull();
  });

  it('exports a payload that re-validates against the current schema', async () => {
    await builds.save({ name: 'Self-consistent', plantSlugs: ['fittonia'], tags: ['x'] });
    const envelope = await exportBackup(source);
    expect(() => backupDataSchema.parse(throughFile(envelope.data))).not.toThrow();
  });
});
