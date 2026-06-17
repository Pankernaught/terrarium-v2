/**
 * Build-progress-photo repository suite — translation of v1 `tests/test_photos.py`.
 * DB isolation comes from a fresh `makeTestDb()` per test (the analog of v1's
 * autouse `isolated_db` fixture).
 *
 * Builds are inserted directly via Drizzle (no dependency on builds-repo, which
 * may be written in parallel). Because `add` assigns `sortOrder = max+1`, append
 * order is deterministic without relying on the wall clock — so the suite does not
 * sleep between adds.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createPhotoRepository, type PhotoRepository } from '../photos-repo';
import { builds, type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

let db: TerrariumDb;
let repo: PhotoRepository;

async function makeBuild(database: TerrariumDb, id = 'b1'): Promise<string> {
  const now = new Date();
  await database.insert(builds).values({
    id,
    name: 'Test',
    plantSlugs: [],
    tags: [],
    primaryPhotoId: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function primaryIdOf(database: TerrariumDb, buildId: string): Promise<string | null> {
  const [b] = await database.select().from(builds).where(eq(builds.id, buildId));
  return b.primaryPhotoId;
}

beforeEach(() => {
  ({ db } = makeTestDb());
  repo = createPhotoRepository(db);
});

describe('photos repository', () => {
  it('add returns a populated photo', async () => {
    const buildId = await makeBuild(db);
    const photo = await repo.add(buildId, '/path/to/photo.jpg', 'A caption');

    expect(photo.id).toBeTruthy();
    expect(photo.buildId).toBe(buildId);
    expect(photo.filePath).toBe('/path/to/photo.jpg');
    expect(photo.caption).toBe('A caption');
    expect(photo.sortOrder).toBe(0);
    expect(photo.takenAt).toBeInstanceOf(Date);
  });

  it('add defaults caption to null', async () => {
    const buildId = await makeBuild(db);
    const photo = await repo.add(buildId, '/path/to/photo.jpg');
    expect(photo.caption).toBeNull();
  });

  it('first photo auto-becomes primary; second does not change it', async () => {
    const buildId = await makeBuild(db);

    const p1 = await repo.add(buildId, '/p1.jpg');
    expect(await primaryIdOf(db, buildId)).toBe(p1.id);

    const p2 = await repo.add(buildId, '/p2.jpg');
    // Still p1 — only the *first* photo auto-promotes.
    expect(await primaryIdOf(db, buildId)).toBe(p1.id);
    expect(await primaryIdOf(db, buildId)).not.toBe(p2.id);
  });

  it('add to a missing build throws', async () => {
    await expect(repo.add('nope', '/p.jpg')).rejects.toThrow(/not found/);
  });

  it('sortOrder increments across adds', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');
    const p3 = await repo.add(buildId, '/p3.jpg');

    expect(p1.sortOrder).toBe(0);
    expect(p2.sortOrder).toBe(1);
    expect(p3.sortOrder).toBe(2);
  });

  it('setPrimary changes the pointer', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');

    expect(await primaryIdOf(db, buildId)).toBe(p1.id);
    await repo.setPrimary(buildId, p2.id);
    expect(await primaryIdOf(db, buildId)).toBe(p2.id);
  });

  it('setPrimary with a nonexistent photo id throws', async () => {
    const buildId = await makeBuild(db);
    await repo.add(buildId, '/p1.jpg');
    await expect(repo.setPrimary(buildId, 'nope')).rejects.toThrow(/does not belong/);
  });

  it('setPrimary with a photo from another build throws', async () => {
    const buildId = await makeBuild(db, 'b1');
    await repo.add(buildId, '/p1.jpg');

    const otherBuildId = await makeBuild(db, 'b2');
    const foreign = await repo.add(otherBuildId, '/other.jpg');

    await expect(repo.setPrimary(buildId, foreign.id)).rejects.toThrow(/does not belong/);
  });

  it('setPrimary on a missing build throws not found', async () => {
    await expect(repo.setPrimary('nope', 'whatever')).rejects.toThrow(/not found/);
  });

  it('getPrimary returns the explicit primary, then follows setPrimary', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');

    const first = await repo.getPrimary(buildId);
    expect(first?.id).toBe(p1.id);

    await repo.setPrimary(buildId, p2.id);
    const second = await repo.getPrimary(buildId);
    expect(second?.id).toBe(p2.id);
  });

  it('getPrimary falls back to earliest when primaryPhotoId is cleared', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    await repo.add(buildId, '/p2.jpg');

    // Force-clear the pointer; getPrimary should fall back to the earliest photo.
    await db.update(builds).set({ primaryPhotoId: null }).where(eq(builds.id, buildId));

    const primary = await repo.getPrimary(buildId);
    expect(primary?.id).toBe(p1.id);
  });

  it('getPrimary returns null when the build has no photos', async () => {
    const buildId = await makeBuild(db);
    expect(await repo.getPrimary(buildId)).toBeNull();
  });

  it('getPrimary returns null when the build does not exist', async () => {
    expect(await repo.getPrimary('nope')).toBeNull();
  });

  it('list returns photos in append order', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');
    const p3 = await repo.add(buildId, '/p3.jpg');

    const photos = await repo.list(buildId);
    expect(photos.map((p) => p.id)).toEqual([p1.id, p2.id, p3.id]);
  });

  it('delete reassigns primary to the earliest remaining photo', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');
    const p3 = await repo.add(buildId, '/p3.jpg');

    expect(await primaryIdOf(db, buildId)).toBe(p1.id);

    await repo.delete(p1.id);
    expect(await primaryIdOf(db, buildId)).toBe(p2.id);

    await repo.delete(p2.id);
    expect(await primaryIdOf(db, buildId)).toBe(p3.id);

    await repo.delete(p3.id);
    expect(await primaryIdOf(db, buildId)).toBeNull();
  });

  it('deleting a non-primary photo leaves the primary unchanged', async () => {
    const buildId = await makeBuild(db);
    const p1 = await repo.add(buildId, '/p1.jpg');
    const p2 = await repo.add(buildId, '/p2.jpg');

    expect(await primaryIdOf(db, buildId)).toBe(p1.id);

    await repo.delete(p2.id);
    expect(await primaryIdOf(db, buildId)).toBe(p1.id);
  });

  it('delete a nonexistent photo throws', async () => {
    await expect(repo.delete('nope')).rejects.toThrow(/not found/);
  });
});
