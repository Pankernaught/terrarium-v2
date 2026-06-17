/**
 * Build-progress-photo repository.
 *
 * Faithful port of v1 `engine/photos.py` (`add_build_photo`, `set_primary_photo`,
 * `get_primary_photo`, `list_build_photos`, `delete_build_photo`) — the v1
 * semantics are preserved EXACTLY, including the two load-bearing invariants:
 *
 *   1. **First photo auto-becomes primary** — `add` sets the build's
 *      `primaryPhotoId` to the new photo's id whenever the build has no primary
 *      yet (so the first photo a build gets is its hero, automatically).
 *   2. **Delete reassigns primary to the earliest remaining photo** — deleting the
 *      photo a build currently points at as primary re-points it at the earliest
 *      remaining photo, or `null` when that was the build's last photo. Deleting a
 *      non-primary photo leaves the primary pointer untouched.
 *
 * `getPrimary` mirrors v1's resilience: an unset, dangling, or foreign
 * `primaryPhotoId` falls back to the earliest photo for the build.
 *
 * Divergence from v1 (intentional, decision 17 + deterministic ordering):
 *  - Photo ids are generated **UUIDs** (`newId()`), not v1's integer
 *    autoincrement.
 *  - `sortOrder` is an explicit **append counter** assigned `max(existing) + 1`
 *    per build (first photo = 0), where v1 left `sort_order = 0` for every photo
 *    and leaned on `taken_at` alone. This makes "earliest remaining" deterministic
 *    regardless of clock resolution. The secondary `takenAt` ascending tiebreak in
 *    every ordered query is kept to stay aligned with v1.
 *
 * Imports are restricted to `drizzle-orm`, `./schema`, and `./ids` — the repo
 * never reaches a concrete driver, `src/data`, or `src/logic`.
 */
import { asc, eq, max } from 'drizzle-orm';

import { newId } from './ids';
import { type Build, type BuildPhoto, buildPhotos, builds, type TerrariumDb } from './schema';

export interface PhotoRepository {
  add(buildId: string, filePath: string, caption?: string | null): Promise<BuildPhoto>;
  setPrimary(buildId: string, photoId: string): Promise<void>;
  getPrimary(buildId: string): Promise<BuildPhoto | null>;
  list(buildId: string): Promise<BuildPhoto[]>;
  delete(photoId: string): Promise<void>;
}

export function createPhotoRepository(db: TerrariumDb): PhotoRepository {
  /** The build row, or `undefined` when absent. */
  async function getBuild(buildId: string): Promise<Build | undefined> {
    const [row] = await db.select().from(builds).where(eq(builds.id, buildId));
    return row;
  }

  /** A single photo row, or `undefined` when absent. */
  async function getPhoto(photoId: string): Promise<BuildPhoto | undefined> {
    const [row] = await db.select().from(buildPhotos).where(eq(buildPhotos.id, photoId));
    return row;
  }

  /**
   * The build's photos, earliest first — `sortOrder` asc then `takenAt` asc,
   * matching v1's ORDER BY (append order, with the v1 timestamp tiebreak).
   */
  async function listOrdered(buildId: string): Promise<BuildPhoto[]> {
    return db
      .select()
      .from(buildPhotos)
      .where(eq(buildPhotos.buildId, buildId))
      .orderBy(asc(buildPhotos.sortOrder), asc(buildPhotos.takenAt));
  }

  /** Earliest photo for the build, or `null` when it has none. */
  async function earliest(buildId: string): Promise<BuildPhoto | null> {
    const [row] = await listOrdered(buildId);
    return row ?? null;
  }

  const repo: PhotoRepository = {
    async add(buildId, filePath, caption = null) {
      const build = await getBuild(buildId);
      if (!build) throw new Error(`Build with id ${buildId} not found.`);

      // Explicit append counter: max+1 per build → first photo gets 0.
      const [{ m }] = await db
        .select({ m: max(buildPhotos.sortOrder) })
        .from(buildPhotos)
        .where(eq(buildPhotos.buildId, buildId));
      const sortOrder = (m ?? -1) + 1;

      const photo: BuildPhoto = {
        id: newId(),
        buildId,
        filePath,
        caption,
        takenAt: new Date(),
        sortOrder,
      };
      await db.insert(buildPhotos).values(photo);

      // INVARIANT 1 — first photo auto-becomes primary.
      if (build.primaryPhotoId === null) {
        await db
          .update(builds)
          .set({ primaryPhotoId: photo.id })
          .where(eq(builds.id, buildId));
      }

      return photo;
    },

    async setPrimary(buildId, photoId) {
      const build = await getBuild(buildId);
      if (!build) throw new Error(`Build with id ${buildId} not found.`);

      const photo = await getPhoto(photoId);
      if (!photo || photo.buildId !== buildId) {
        throw new Error(`Photo ${photoId} does not belong to build ${buildId}.`);
      }

      await db.update(builds).set({ primaryPhotoId: photoId }).where(eq(builds.id, buildId));
    },

    async getPrimary(buildId) {
      const build = await getBuild(buildId);
      if (!build) return null;

      // Explicit pointer wins — but only when it resolves to a photo that
      // actually belongs to this build (an unset, dangling, or foreign pointer
      // falls through to the earliest-photo fallback, like v1).
      if (build.primaryPhotoId !== null) {
        const photo = await getPhoto(build.primaryPhotoId);
        if (photo && photo.buildId === buildId) return photo;
      }

      return earliest(buildId);
    },

    list(buildId) {
      return listOrdered(buildId);
    },

    async delete(photoId) {
      const photo = await getPhoto(photoId);
      if (!photo) throw new Error(`Photo with id ${photoId} not found.`);

      const { buildId } = photo;
      await db.delete(buildPhotos).where(eq(buildPhotos.id, photoId));

      // INVARIANT 2 — if the deleted photo was the build's primary, re-point it at
      // the earliest remaining photo (or null when it was the last one). A
      // non-primary delete leaves the pointer untouched.
      const build = await getBuild(buildId);
      if (build && build.primaryPhotoId === photoId) {
        const replacement = await earliest(buildId);
        await db
          .update(builds)
          .set({ primaryPhotoId: replacement ? replacement.id : null })
          .where(eq(builds.id, buildId));
      }
    },
  };

  return repo;
}
