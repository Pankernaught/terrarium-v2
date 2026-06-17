/**
 * Driver-adapter guard — proves the `sqlite-proxy` ↔ `node:sqlite` bridge in
 * `client.node.ts` round-trips every non-trivial column kind the repositories
 * lean on: JSON columns (`plantSlugs`, `placements`, `containerDimensions`),
 * `timestamp_ms` integers (back to `Date`), nullable columns, and delete. If the
 * positional `Object.values` mapping or param coercion ever drifts, this fails
 * before the repo suites do.
 */
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { builds, type TerrariumDb } from '../schema';
import { makeTestDb } from './helpers';

let db: TerrariumDb;

beforeEach(() => {
  ({ db } = makeTestDb());
});

describe('node:sqlite driver adapter', () => {
  it('round-trips JSON, timestamps, and nullable columns', async () => {
    const created = new Date('2026-06-17T10:00:00.000Z');
    await db.insert(builds).values({
      id: 'b1',
      name: 'Adapter Build',
      containerSlug: null,
      containerShape: 'rectangular',
      containerDimensions: { length: 30, width: 20, height: 25 },
      containerVolumeL: 15,
      containerOpening: 'lidded',
      plantSlugs: ['fittonia-albivenis', 'ficus-pumila'],
      tags: ['office'],
      description: null,
      placements: [{ slug: 'fittonia-albivenis', x: 0.5, y: 0.7, scale: 1 }],
      substrateDepth: null,
      drainageDepth: null,
      primaryPhotoId: null,
      createdAt: created,
      updatedAt: created,
    });

    const [row] = await db.select().from(builds).where(eq(builds.id, 'b1'));
    expect(row.name).toBe('Adapter Build');
    expect(row.containerSlug).toBeNull();
    expect(row.plantSlugs).toEqual(['fittonia-albivenis', 'ficus-pumila']);
    expect(row.containerDimensions).toEqual({ length: 30, width: 20, height: 25 });
    expect(row.placements).toEqual([{ slug: 'fittonia-albivenis', x: 0.5, y: 0.7, scale: 1 }]);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.createdAt.getTime()).toBe(created.getTime());
  });

  it('returns undefined for a missing .get() row and reflects deletes', async () => {
    const now = new Date();
    await db.insert(builds).values({
      id: 'b2',
      name: 'Doomed',
      plantSlugs: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(await db.select().from(builds)).toHaveLength(1);

    await db.delete(builds).where(eq(builds.id, 'b2'));
    expect(await db.select().from(builds)).toHaveLength(0);

    const missing = await db.select().from(builds).where(eq(builds.id, 'nope')).get();
    expect(missing).toBeUndefined();
  });
});
