/**
 * Care-mark repository suite. DB isolation comes from a fresh
 * `makeTestDb()` per test (the analog of v1's autouse `isolated_db` fixture).
 *
 * Builds are inserted directly via Drizzle (no dependency on builds-repo) — the
 * care repo only needs a `buildId`, and it does not enforce build existence, so
 * the build row is convenience/realism, not a precondition.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { createCareRepository, type CareRepository } from '../care-repo';
import { builds, type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

let db: TerrariumDb;
let repo: CareRepository;

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

beforeEach(() => {
  ({ db } = makeTestDb());
  repo = createCareRepository(db);
});

describe('care repository', () => {
  it('add returns a populated pending row', async () => {
    const buildId = await makeBuild(db);
    const dueAt = new Date('2026-07-01T09:00:00.000Z');

    const mark = await repo.add({ buildId, kind: 'watering-inspection', dueAt });

    expect(mark.id).toBeTruthy();
    expect(mark.buildId).toBe(buildId);
    expect(mark.kind).toBe('watering-inspection');
    expect(mark.dueAt?.getTime()).toBe(dueAt.getTime());
    expect(mark.completedAt).toBeNull();
    expect(mark.plantSlug).toBeNull();
    expect(mark.note).toBeNull();
    expect(mark.createdAt).toBeInstanceOf(Date);
  });

  it('add carries explicit plantSlug and note', async () => {
    const buildId = await makeBuild(db);
    const mark = await repo.add({
      buildId,
      kind: 'trimming',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
      plantSlug: 'fittonia',
      note: 'leggy growth',
    });

    expect(mark.plantSlug).toBe('fittonia');
    expect(mark.note).toBe('leggy growth');
  });

  it('listForBuild orders by createdAt asc then dueAt asc', async () => {
    const buildId = await makeBuild(db);
    // Same createdAt resolution can collide, so vary dueAt to test the tiebreak too.
    const early = await repo.add({
      buildId,
      kind: 'lid-opening',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const late = await repo.add({
      buildId,
      kind: 'lid-opening',
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const all = await repo.listForBuild(buildId);
    expect(all).toHaveLength(2);
    // createdAt ascending = insertion order; both ids present in order.
    const ids = all.map((m) => m.id);
    expect(ids).toContain(early.id);
    expect(ids).toContain(late.id);
    // Sorted ascending by dueAt within the same createdAt bucket.
    expect(all[0].dueAt!.getTime()).toBeLessThanOrEqual(all[1].dueAt!.getTime());
  });

  it('pendingForBuild excludes completed rows, dueAt asc', async () => {
    const buildId = await makeBuild(db);
    const later = await repo.add({
      buildId,
      kind: 'watering-inspection',
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    const sooner = await repo.add({
      buildId,
      kind: 'watering-inspection',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    // Complete `later`; it should drop out of the pending set.
    await repo.markDone(later.id, 7);

    const pending = await repo.pendingForBuild(buildId);
    const pendingIds = pending.map((m) => m.id);
    expect(pendingIds).toContain(sooner.id);
    expect(pendingIds).not.toContain(later.id);
    // Ascending by dueAt.
    for (let i = 1; i < pending.length; i++) {
      expect(pending[i - 1].dueAt!.getTime()).toBeLessThanOrEqual(pending[i].dueAt!.getTime());
    }
  });

  it('listPending spans multiple builds, dueAt asc', async () => {
    const b1 = await makeBuild(db, 'b1');
    const b2 = await makeBuild(db, 'b2');

    const m1 = await repo.add({
      buildId: b1,
      kind: 'trimming',
      dueAt: new Date('2026-09-01T00:00:00.000Z'),
    });
    const m2 = await repo.add({
      buildId: b2,
      kind: 'trimming',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const m3 = await repo.add({
      buildId: b1,
      kind: 'lid-opening',
      dueAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    const pending = await repo.listPending();
    // All three, ordered by dueAt ascending → b2's July, b1's Aug, b1's Sept.
    expect(pending.map((m) => m.id)).toEqual([m2.id, m3.id, m1.id]);
  });

  it('markDone completes the original and appends the next pending occurrence', async () => {
    const buildId = await makeBuild(db);
    const at = new Date('2026-07-01T12:00:00.000Z');
    const original = await repo.add({
      buildId,
      kind: 'watering-inspection',
      dueAt: new Date('2026-07-01T09:00:00.000Z'),
      plantSlug: null,
    });

    const next = await repo.markDone(original.id, 7, at);

    // The returned row is a NEW pending occurrence dueAt = completedAt + interval.
    expect(next.id).not.toBe(original.id);
    expect(next.completedAt).toBeNull();
    expect(next.buildId).toBe(buildId);
    expect(next.kind).toBe('watering-inspection');
    expect(next.dueAt!.getTime()).toBe(at.getTime() + 7 * 86_400_000);

    // The original is completed (no longer pending).
    const all = await repo.listForBuild(buildId);
    const reloadedOriginal = all.find((m) => m.id === original.id)!;
    expect(reloadedOriginal.completedAt).toBeInstanceOf(Date);
    expect(reloadedOriginal.completedAt!.getTime()).toBe(at.getTime());

    // The build still has exactly one pending row of that kind.
    const pending = await repo.pendingForBuild(buildId);
    const pendingOfKind = pending.filter((m) => m.kind === 'watering-inspection');
    expect(pendingOfKind).toHaveLength(1);
    expect(pendingOfKind[0].id).toBe(next.id);
  });

  it('markDone defaults `at` to now', async () => {
    const buildId = await makeBuild(db);
    const original = await repo.add({
      buildId,
      kind: 'trimming',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const before = Date.now();
    const next = await repo.markDone(original.id, 3);
    const after = Date.now();

    // nextDue computed from a now-ish completion: within [before+3d, after+3d].
    const threeDays = 3 * 86_400_000;
    expect(next.dueAt!.getTime()).toBeGreaterThanOrEqual(before + threeDays);
    expect(next.dueAt!.getTime()).toBeLessThanOrEqual(after + threeDays);

    const all = await repo.listForBuild(buildId);
    const reloaded = all.find((m) => m.id === original.id)!;
    expect(reloaded.completedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(reloaded.completedAt!.getTime()).toBeLessThanOrEqual(after);
  });

  it('markDone on an unknown id throws not found', async () => {
    await expect(repo.markDone('nope', 7)).rejects.toThrow(/not found/);
  });

  it('disableForBuild removes pending rows but keeps completed ones', async () => {
    const buildId = await makeBuild(db);
    const a = await repo.add({
      buildId,
      kind: 'watering-inspection',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    await repo.add({
      buildId,
      kind: 'lid-opening',
      dueAt: new Date('2026-07-02T00:00:00.000Z'),
    });

    // Complete `a` → leaves a completed row plus a fresh pending follow-up.
    await repo.markDone(a.id, 7);

    await repo.disableForBuild(buildId);

    // No pending rows survive.
    expect(await repo.pendingForBuild(buildId)).toHaveLength(0);

    // The completed history row survives.
    const all = await repo.listForBuild(buildId);
    const completed = all.filter((m) => m.completedAt !== null);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe(a.id);
  });

  it('purgeForBuild removes everything for that build but leaves others untouched', async () => {
    const b1 = await makeBuild(db, 'b1');
    const b2 = await makeBuild(db, 'b2');

    const done = await repo.add({
      buildId: b1,
      kind: 'watering-inspection',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    await repo.markDone(done.id, 7); // b1 now has a completed + a pending row
    const survivor = await repo.add({
      buildId: b2,
      kind: 'trimming',
      dueAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    await repo.purgeForBuild(b1);

    expect(await repo.listForBuild(b1)).toHaveLength(0);

    const b2Rows = await repo.listForBuild(b2);
    expect(b2Rows).toHaveLength(1);
    expect(b2Rows[0].id).toBe(survivor.id);
  });
});
