/**
 * Whole-app JSON backup/restore — the decision-7 / decision-17 envelope, pure of
 * any device IO so the round-trip is unit-tested in the node runner. The on-device
 * file-share + document-pick wrapper lives in `src/lib/backup-io.ts`.
 *
 * **What rides in the payload (decision 7):** the user data that round-trips —
 * `builds` (with their `placements` riding *inside* each row) and `care_marks`.
 * **Photos are excluded** (binary; documented gap): a restored build keeps its
 * `primaryPhotoId`, but the photo rows are gone, so `getPrimary` falls back to its
 * placeholder hero (the graceful-degrade, never a crash). Seed/reference tables
 * (`plants`/`containers`/`presets`) are regenerable from the bundle and **never**
 * enter a backup.
 *
 * **Import pipeline (decision 17):** read `envelope.schemaVersion` →
 * `migratePayload()` (the Phase-4 ladder — NOT re-implemented here) up to
 * `STORE_SCHEMA_VERSION` → **zod-validate the migrated payload against the current
 * schema** → **replace** (wipe the user tables, then insert). Because validation
 * runs to completion *before* the first write, any corrupt row rejects the **whole
 * file** with no half-import; a **newer-than-current** file is refused by
 * `migratePayload` before anything is touched. (The node test driver's
 * `sqlite-proxy` has no interactive `transaction()`, so atomicity is anchored at
 * the validate-before-mutate boundary — the only place a half-import could begin.)
 */
import { z } from 'zod';

import {
  type BackupEnvelope,
  migratePayload,
  STORE_SCHEMA_VERSION,
} from './migrate';
import {
  buildPhotos,
  builds,
  careMarks,
  type NewBuild,
  type NewCareMark,
  type TerrariumDb,
} from './schema';
import type { Dimensions } from '../logic/containers';

// --- Payload validation (against the *current* schema, post-migration) -------

const placementSchema = z.object({
  slug: z.string(),
  x: z.number(),
  y: z.number(),
  scale: z.number(),
});

/** A build row as it travels in a backup — every persisted column, dates coerced. */
const backupBuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  containerSlug: z.string().nullish(),
  containerShape: z.string().nullish(),
  // Geometry bag — validated structurally (the engine owns the shape semantics).
  containerDimensions: z.record(z.string(), z.number()).nullish(),
  containerVolumeL: z.number().nullish(),
  containerOpening: z.string().nullish(),
  plantSlugs: z.array(z.string()),
  tags: z.array(z.string()),
  description: z.string().nullish(),
  placements: z.array(placementSchema).nullish(),
  substrateDepth: z.number().nullish(),
  drainageDepth: z.number().nullish(),
  // The substrate-mixer recipe (Phase 8) — `componentId → parts`. Nullish: a v1
  // backup (schema v1) simply lacks the key, which the v1→v2 identity migration
  // carries through to `null` here (additive field).
  substrateMix: z.record(z.string(), z.number()).nullish(),
  // Kept so the round-trip is identical; the photo it points at is gone (excluded),
  // which getPrimary degrades to a placeholder rather than crashing.
  primaryPhotoId: z.string().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/** A care-mark row as it travels in a backup (Phase 7 owns the live repo). */
const backupCareMarkSchema = z.object({
  id: z.string(),
  buildId: z.string(),
  plantSlug: z.string().nullish(),
  kind: z.string(),
  note: z.string().nullish(),
  dueAt: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date(),
});

/** The `data` block: the user entities that round-trip. */
export const backupDataSchema = z.object({
  builds: z.array(backupBuildSchema),
  careMarks: z.array(backupCareMarkSchema),
});

export type ValidatedBackupData = z.infer<typeof backupDataSchema>;

/**
 * A *loose* envelope guard — enough to recover `schemaVersion` and the `data`
 * block from an arbitrary file before we know it migrates. A file that doesn't
 * even have this shape is rejected as "not a Terrarium backup" before any work.
 */
const envelopeShapeSchema = z.object({
  schemaVersion: z.number().int(),
  appVersion: z.string().optional(),
  exportedAt: z.string().optional(),
  data: z.unknown(),
});

// --- Export ------------------------------------------------------------------

/**
 * Read the user tables into a versioned `BackupEnvelope`. The returned `data`
 * holds live `Date`s / arrays; JSON serialization (at the IO edge) turns dates
 * into ISO strings, which the importer's `z.coerce.date()` reverses.
 */
export async function exportBackup(
  db: TerrariumDb,
  appVersion?: string,
): Promise<BackupEnvelope<ValidatedBackupData>> {
  const buildRows = await db.select().from(builds);
  const careRows = await db.select().from(careMarks);
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    // Cast: the selected rows are a superset-compatible shape; the importer is the
    // authority that *validates* on the way back in.
    data: { builds: buildRows, careMarks: careRows } as unknown as ValidatedBackupData,
  };
}

// --- Restore (replace) -------------------------------------------------------

export interface RestoreResult {
  builds: number;
  careMarks: number;
}

/** Thrown when a file isn't a recognizable backup envelope (vs. a valid-but-corrupt one). */
export class NotABackupError extends Error {
  constructor() {
    super('This file isn’t a Terrarium backup, or it’s been corrupted.');
    this.name = 'NotABackupError';
  }
}

/**
 * Restore a backup envelope, **replacing** all user data. Validation completes
 * before the first write, so any failure (newer version, corrupt row) rejects the
 * whole file and leaves the store untouched.
 *
 * @throws the decision-17 "made by a newer version" message (from `migratePayload`)
 *   for a newer file, a `ZodError` for a corrupt payload, or `NotABackupError` for
 *   a file that isn't an envelope at all.
 */
export async function restoreBackup(
  db: TerrariumDb,
  envelope: unknown,
  toVersion: number = STORE_SCHEMA_VERSION,
): Promise<RestoreResult> {
  // 1. Recognize the envelope (reject non-backups cleanly).
  const shape = envelopeShapeSchema.safeParse(envelope);
  if (!shape.success) throw new NotABackupError();

  // 2. Migrate the payload up to the current version (refuses a newer file).
  const migrated = migratePayload(shape.data.data, shape.data.schemaVersion, toVersion);

  // 3. Validate against the *current* schema — throws before any mutation.
  const data = backupDataSchema.parse(migrated);

  // 4. Replace: wipe the user tables, then insert. Photos can't be restored
  //    (excluded), so their rows are cleared too — restored builds degrade to a
  //    placeholder hero rather than pointing at a stale photo from a prior install.
  await db.delete(buildPhotos);
  await db.delete(careMarks);
  await db.delete(builds);

  const buildRows: NewBuild[] = data.builds.map((b) => ({
    id: b.id,
    name: b.name,
    containerSlug: b.containerSlug ?? null,
    containerShape: b.containerShape ?? null,
    containerDimensions: (b.containerDimensions ?? null) as Dimensions | null,
    containerVolumeL: b.containerVolumeL ?? null,
    containerOpening: b.containerOpening ?? null,
    plantSlugs: b.plantSlugs,
    tags: b.tags,
    description: b.description ?? null,
    placements: b.placements ?? null,
    substrateDepth: b.substrateDepth ?? null,
    drainageDepth: b.drainageDepth ?? null,
    substrateMix: b.substrateMix ?? null,
    primaryPhotoId: b.primaryPhotoId ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));
  const careRows: NewCareMark[] = data.careMarks.map((m) => ({
    id: m.id,
    buildId: m.buildId,
    plantSlug: m.plantSlug ?? null,
    kind: m.kind,
    note: m.note ?? null,
    dueAt: m.dueAt ?? null,
    completedAt: m.completedAt ?? null,
    createdAt: m.createdAt,
  }));

  if (buildRows.length > 0) await db.insert(builds).values(buildRows);
  if (careRows.length > 0) await db.insert(careMarks).values(careRows);

  return { builds: buildRows.length, careMarks: careRows.length };
}
