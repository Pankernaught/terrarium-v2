/**
 * Builds-repository CRUD suite — translation of v1 `tests/test_builds.py`.
 * DB isolation comes from a fresh `makeTestDb()` per test (the analog of v1's
 * autouse `isolated_db` fixture). Ordering tests sleep briefly to guarantee
 * distinct `updatedAt`/`createdAt` timestamps (v1 used `time.sleep(0.01)`).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { type BuildRepository, createBuildRepository } from '../builds-repo';
import { type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let db: TerrariumDb;
let repo: BuildRepository;

beforeEach(() => {
  ({ db } = makeTestDb());
  repo = createBuildRepository(db);
});

describe('builds repository', () => {
  it('save_and_load_build', async () => {
    const build = await repo.save({
      name: 'My Office Terrarium',
      containerSlug: 'apothecary-jar',
      plantSlugs: ['fittonia-albivenis', 'ficus-pumila'],
      tags: ['office', 'small'],
    });

    expect(build.id).toBeTruthy();
    expect(build.name).toBe('My Office Terrarium');

    const loaded = await repo.load(build.id);
    expect(loaded.name).toBe('My Office Terrarium');
    expect(loaded.containerSlug).toBe('apothecary-jar');
    expect(loaded.plantSlugs).toHaveLength(2);
    expect(loaded.tags).toContain('office');
  });

  it('load_nonexistent_build', async () => {
    await expect(repo.load('nope')).rejects.toThrow(/not found/);
  });

  it('list_builds_ordering', async () => {
    const b1 = await repo.save({ name: 'Build 1', containerSlug: 'jar', plantSlugs: ['plant1'] });
    await sleep(8);
    const b2 = await repo.save({ name: 'Build 2', containerSlug: 'bowl', plantSlugs: ['plant2'] });
    await sleep(8);
    const b3 = await repo.save({ name: 'Build 3', containerSlug: 'tank', plantSlugs: ['plant3'] });
    await sleep(8);

    // Update b1 so it has the most recent updatedAt.
    await repo.update(b1.id, { name: 'Build 1 Updated' });

    const builds = await repo.list();
    expect(builds).toHaveLength(3);

    // Most recently updated first.
    expect(builds[0].id).toBe(b1.id);
    expect(builds[1].id).toBe(b3.id);
    expect(builds[2].id).toBe(b2.id);
  });

  it('update_build_changes_updated_at', async () => {
    const build = await repo.save({ name: 'Old Name', containerSlug: 'jar', plantSlugs: ['plant1'] });
    const originalUpdatedAt = build.updatedAt;

    await sleep(8);
    const updated = await repo.update(build.id, {
      name: 'New Name',
      plantSlugs: ['plant1', 'plant2'],
    });

    expect(updated.name).toBe('New Name');
    expect(updated.plantSlugs).toHaveLength(2);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it('rename_build', async () => {
    const build = await repo.save({ name: 'Name', containerSlug: 'jar', plantSlugs: [] });
    const updated = await repo.rename(build.id, 'New Name');
    expect(updated.name).toBe('New Name');
  });

  it('update_build_tags', async () => {
    const build = await repo.save({ name: 'Name', containerSlug: 'jar', plantSlugs: [] });
    const updated = await repo.updateTags(build.id, ['tag1']);
    expect(updated.tags).toContain('tag1');
  });

  it('duplicate_build', async () => {
    const original = await repo.save({
      name: 'Original',
      containerSlug: 'jar',
      plantSlugs: ['plant1'],
      tags: ['office'],
    });
    await sleep(8);

    const dup = await repo.duplicate(original.id, 'Copy');

    expect(dup.id).not.toBe(original.id);
    expect(dup.name).toBe('Copy');
    expect(dup.containerSlug).toBe(original.containerSlug);
    expect(dup.plantSlugs).toEqual(original.plantSlugs);
    expect(dup.tags).toEqual(original.tags);
    expect(dup.createdAt.getTime()).toBeGreaterThan(original.createdAt.getTime());
  });

  it('duplicate_nonexistent_build', async () => {
    await expect(repo.duplicate('nope', 'Nope')).rejects.toThrow(/not found/);
  });

  it('update_nonexistent_build', async () => {
    await expect(repo.update('nope', { name: 'Nope' })).rejects.toThrow(/not found/);
  });

  it('delete_build', async () => {
    const build = await repo.save({ name: 'To Delete', containerSlug: 'jar', plantSlugs: ['plant1'] });
    await repo.delete(build.id);

    await expect(repo.load(build.id)).rejects.toThrow(/not found/);
  });

  it('delete_nonexistent_build', async () => {
    await expect(repo.delete('nope')).rejects.toThrow(/not found/);
  });

  it('builds_containing_plant', async () => {
    const b1 = await repo.save({
      name: 'Target Plant Build',
      containerSlug: 'nano-jar',
      plantSlugs: ['fittonia-albivenis', 'target-slug'],
      tags: ['test'],
    });
    await sleep(8);
    const b2 = await repo.save({
      name: 'Other Build',
      containerSlug: 'small-dome',
      plantSlugs: ['fittonia-albivenis'],
      tags: ['test'],
    });

    const results = await repo.containingPlant('target-slug');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(b1.id);
    expect(results[0].name).toBe('Target Plant Build');

    // A plant in both returns both, newest first.
    const fittonia = await repo.containingPlant('fittonia-albivenis');
    expect(fittonia).toHaveLength(2);
    expect(fittonia[0].id).toBe(b2.id); // b2 is newer
    expect(fittonia[1].id).toBe(b1.id);
  });
});
