/**
 * Builds repository — saved-terrarium CRUD.
 *
 * Faithful port of v1 `engine/builds.py` (`save_build`, `load_build`,
 * `list_builds`, `update_build`, `builds_containing_plant`, `rename_build`,
 * `update_build_tags`, `duplicate_build`, `delete_build`). Same semantics:
 *  - `list` / `containingPlant` order most-recently-updated first;
 *  - `update` applies only the keys you pass (an omitted key is left unchanged),
 *    and `''` clears a field — mirroring v1's "pass empty string to clear; None
 *    means leave unchanged";
 *  - `update` always bumps `updatedAt`; a `duplicate` gets a fresh `createdAt`
 *    and no photos.
 *
 * Divergences from v1:
 *  - UUID string primary keys (`newId()`), not integer autoincrement (decision 17).
 *  - `containerSlug` is simply nullable — v2 drops v1's `"custom"` sentinel that
 *    only existed for a legacy NOT NULL column.
 *  - New columns `placements` / `substrateDepth` / `drainageDepth` are carried
 *    through save/update/duplicate; otherwise the CRUD is unchanged.
 *
 * Imports are restricted to `drizzle-orm`, `./schema`, and `./ids` — the repo
 * never reaches a concrete driver, `src/data`, or `src/logic`.
 */
import { desc, eq } from 'drizzle-orm';

import { newId } from './ids';
import { type Build, builds, type TerrariumDb } from './schema';

/** Input to `save` — everything but `name` is optional. */
export interface SaveBuildInput {
  name: string;
  containerSlug?: string | null;
  plantSlugs?: string[];
  tags?: string[];
  containerShape?: Build['containerShape'];
  containerDimensions?: Build['containerDimensions'];
  containerVolumeL?: Build['containerVolumeL'];
  containerOpening?: Build['containerOpening'];
  description?: Build['description'];
  placements?: Build['placements'];
  substrateDepth?: Build['substrateDepth'];
  drainageDepth?: Build['drainageDepth'];
}

/**
 * Patch for `update` — every key optional. A key present and `!== undefined` is
 * applied (so `description: ''` clears it); an omitted key is left untouched.
 */
export interface UpdateBuildPatch {
  name?: string;
  containerSlug?: string | null;
  plantSlugs?: string[];
  tags?: string[];
  containerShape?: Build['containerShape'];
  containerDimensions?: Build['containerDimensions'];
  containerVolumeL?: Build['containerVolumeL'];
  containerOpening?: Build['containerOpening'];
  description?: Build['description'];
  placements?: Build['placements'];
  substrateDepth?: Build['substrateDepth'];
  drainageDepth?: Build['drainageDepth'];
}

export interface BuildRepository {
  save(input: SaveBuildInput): Promise<Build>;
  load(id: string): Promise<Build>;
  list(): Promise<Build[]>;
  update(id: string, patch: UpdateBuildPatch): Promise<Build>;
  rename(id: string, newName: string): Promise<Build>;
  updateTags(id: string, tags: string[]): Promise<Build>;
  duplicate(id: string, newName: string): Promise<Build>;
  delete(id: string): Promise<void>;
  containingPlant(plantSlug: string): Promise<Build[]>;
}

export function createBuildRepository(db: TerrariumDb): BuildRepository {
  /** Fetch one row or throw the v1-shaped "not found" error. */
  async function loadOrThrow(id: string): Promise<Build> {
    const [row] = await db.select().from(builds).where(eq(builds.id, id));
    if (!row) throw new Error(`Build with id ${id} not found.`);
    return row;
  }

  const repo: BuildRepository = {
    async save(input) {
      const now = new Date();
      const row: Build = {
        id: newId(),
        name: input.name,
        // v2 drops v1's `"custom"` sentinel — nullable column.
        containerSlug: input.containerSlug ?? null,
        containerShape: input.containerShape ?? null,
        containerDimensions: input.containerDimensions ?? null,
        containerVolumeL: input.containerVolumeL ?? null,
        containerOpening: input.containerOpening ?? null,
        plantSlugs: input.plantSlugs ?? [],
        tags: input.tags ?? [],
        description: input.description ?? null,
        placements: input.placements ?? null,
        substrateDepth: input.substrateDepth ?? null,
        drainageDepth: input.drainageDepth ?? null,
        primaryPhotoId: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(builds).values(row);
      return row;
    },

    load(id) {
      return loadOrThrow(id);
    },

    async list() {
      return db.select().from(builds).orderBy(desc(builds.updatedAt));
    },

    async update(id, patch) {
      await loadOrThrow(id);

      // Apply only keys that are explicitly provided (!== undefined), so a
      // passed `''` clears while an omitted field is left unchanged. Always
      // bump updatedAt.
      const set: Partial<Build> = { updatedAt: new Date() };
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.containerSlug !== undefined) set.containerSlug = patch.containerSlug;
      if (patch.plantSlugs !== undefined) set.plantSlugs = patch.plantSlugs;
      if (patch.tags !== undefined) set.tags = patch.tags;
      if (patch.containerShape !== undefined) set.containerShape = patch.containerShape;
      if (patch.containerDimensions !== undefined)
        set.containerDimensions = patch.containerDimensions;
      if (patch.containerVolumeL !== undefined) set.containerVolumeL = patch.containerVolumeL;
      if (patch.containerOpening !== undefined) set.containerOpening = patch.containerOpening;
      if (patch.description !== undefined) set.description = patch.description;
      if (patch.placements !== undefined) set.placements = patch.placements;
      if (patch.substrateDepth !== undefined) set.substrateDepth = patch.substrateDepth;
      if (patch.drainageDepth !== undefined) set.drainageDepth = patch.drainageDepth;

      await db.update(builds).set(set).where(eq(builds.id, id));
      return loadOrThrow(id);
    },

    rename(id, newName) {
      return this.update(id, { name: newName });
    },

    updateTags(id, tags) {
      return this.update(id, { tags });
    },

    async duplicate(id, newName) {
      const original = await loadOrThrow(id);
      const now = new Date();
      const row: Build = {
        id: newId(),
        name: newName,
        containerSlug: original.containerSlug,
        containerShape: original.containerShape,
        containerDimensions: original.containerDimensions,
        containerVolumeL: original.containerVolumeL,
        containerOpening: original.containerOpening,
        plantSlugs: [...original.plantSlugs],
        tags: [...original.tags],
        description: original.description,
        placements: original.placements,
        substrateDepth: original.substrateDepth,
        drainageDepth: original.drainageDepth,
        // A duplicate carries no photos yet.
        primaryPhotoId: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(builds).values(row);
      return row;
    },

    async delete(id) {
      await loadOrThrow(id);
      await db.delete(builds).where(eq(builds.id, id));
    },

    async containingPlant(plantSlug) {
      // Python-side filter on list() — preserves updatedAt DESC order.
      return (await this.list()).filter((b) => b.plantSlugs.includes(plantSlug));
    },
  };

  return repo;
}
