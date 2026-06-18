/**
 * Local-store schema (Phase 4) — Drizzle + SQLite.
 *
 * **Two groups of tables, one DB.**
 *
 * 1. **User data — the three persisted entities (decision 11).** `builds`,
 *    `build_photos`, `care_marks`. These are the mutable, per-install rows that
 *    ride the backup/restore payload (`care_marks` excepted only by the photo
 *    rule — see decision 17). v1's `plant_photos` is **struck** (decision 11):
 *    curator plant imagery is a static seed `image` path, not DB rows.
 *
 * 2. **Seed reference data — derived from the bundle (mirrors v1 `db/loader.py`).**
 *    `plants`, `containers`, `presets`. The engine reads the *bundle JSON*
 *    (`src/data`, zero DB round-trip — decision 11), so these tables are a
 *    queryable mirror seeded idempotently by `seedStore()` (upsert-by-slug), not
 *    the engine's read path. They are **regenerable from the bundle and never
 *    enter the backup payload** (decision 17). Stored as `{ slug, data }` JSON
 *    blobs — the validated record is the source of truth in `src/data`, so we do
 *    not re-model 30+ plant columns in SQL.
 *
 * **Decision 17 — UUID primary keys on every row.** `builds` (and, for
 * consistency + restore-safety, photos and care-marks) use a generated UUID, not
 * v1's integer autoincrement: care-marks reference builds and restore = replace,
 * so a renumbering reinsert would dangle every reference. UUIDs are round-trip
 * safe and the natural key for the eventual sync backend (decision 7).
 *
 * **Forward-looking on purpose (decisions 10 / Phase 6–7).** `builds.placements`,
 * `builds.substrateDepth/drainageDepth`, and the whole `care_marks` table exist
 * now though **no screen reads them until Phases 6–7** — landed here so those
 * phases never touch the DB shape.
 *
 * `SCHEMA_DDL` (below) is the `CREATE TABLE` form of these definitions, applied by
 * the node test harness and the on-device first run. **Keep it in sync with the
 * Drizzle tables above it** — they are the single schema, expressed twice (Drizzle
 * for typed queries, raw SQL for `exec`-style creation on both drivers).
 */
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Placement } from '../data/presets';
import type { Dimensions } from '../logic/containers';
import type { SubstrateMix } from '../logic/substrateMixer';

// --- User data: the three persisted entities (decision 11) ------------------

export const builds = sqliteTable('builds', {
  /** UUID (decision 17) — generated on create, never renumbered. */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /**
   * Provenance only: the preset slug a container was based on, or `null` for a
   * fully-custom container. The container snapshot below is the authoritative
   * geometry. (v1 forced a `"custom"` sentinel for a legacy NOT NULL; the fresh
   * v2 column is simply nullable.)
   */
  containerSlug: text('container_slug'),
  // Container builder snapshot — authoritative geometry when present.
  containerShape: text('container_shape'), // 'rectangular' | 'cylindrical'
  containerDimensions: text('container_dimensions', { mode: 'json' }).$type<Dimensions>(),
  containerVolumeL: real('container_volume_l'),
  containerOpening: text('container_opening'), // 'sealed' | 'lidded' | 'open'
  plantSlugs: text('plant_slugs', { mode: 'json' }).$type<string[]>().notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  description: text('description'),
  /**
   * Plant + hardscape front-plane placements (Phase 6 reads). Same shape as the
   * Phase-3 preset `Placement` (`{ slug, x, y, scale }`) so a preset instantiates
   * straight into a build. Build *data*, not render state — survives restart.
   */
  placements: text('placements', { mode: 'json' }).$type<Placement[]>(),
  // Persisted Substrate-step overrides (decision 10) — the guide + the container
  // diagram both read these (single source of truth). Phase 6 writes them.
  substrateDepth: real('substrate_depth'),
  drainageDepth: real('drainage_depth'),
  /**
   * The substrate **mixer** recipe (decision 12, Phase 8) — `componentId → integer
   * parts`, or `null` when the owner built no custom mix (opt-in; never seeded).
   * Drives the build-guide recipe line + the live planner bars; does NOT feed the
   * compatibility score. Additive column → an existing store gets it via the
   * guarded ALTER on open (`ensureSubstrateMixColumn`), not `CREATE TABLE`.
   */
  substrateMix: text('substrate_mix', { mode: 'json' }).$type<SubstrateMix>(),
  /** Explicit hero pointer (decision: NOT newest-by-date) → `build_photos.id`. */
  primaryPhotoId: text('primary_photo_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const buildPhotos = sqliteTable(
  'build_photos',
  {
    id: text('id').primaryKey(),
    /** References `builds.id`; integrity enforced in the repo, not by FK (à la v1). */
    buildId: text('build_id').notNull(),
    filePath: text('file_path').notNull(),
    caption: text('caption'),
    takenAt: integer('taken_at', { mode: 'timestamp_ms' }).notNull(),
    /** Append order — the repo assigns `max+1`; "earliest remaining" sorts by this. */
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('idx_build_photos_build_id').on(t.buildId)],
);

/**
 * Care-marks (net-new, **Phase 7**: reminders + timeline). Keyed off the build
 * UUID; plant refs stay slugs (`plantSlug` null = whole-build). Shape lands now
 * so Phase 7 never alters the schema; Phase 7 owns the repo + may refine columns.
 */
export const careMarks = sqliteTable(
  'care_marks',
  {
    id: text('id').primaryKey(),
    buildId: text('build_id').notNull(),
    plantSlug: text('plant_slug'), // null = applies to the whole build
    kind: text('kind').notNull(), // 'water' | 'mist' | 'fertilize' | 'prune' | 'note' | ...
    note: text('note'),
    dueAt: integer('due_at', { mode: 'timestamp_ms' }), // scheduled reminder; null = log-only
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }), // null = pending
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('idx_care_marks_build_id').on(t.buildId)],
);

// --- Seed reference data: regenerable from the bundle (mirrors db/loader.py) --

export const plants = sqliteTable('plants', {
  slug: text('slug').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
});

export const containers = sqliteTable('containers', {
  slug: text('slug').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
});

export const presets = sqliteTable('presets', {
  slug: text('slug').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
});

// --- Inferred row types ------------------------------------------------------

export type Build = typeof builds.$inferSelect;
export type NewBuild = typeof builds.$inferInsert;
export type BuildPhoto = typeof buildPhotos.$inferSelect;
export type NewBuildPhoto = typeof buildPhotos.$inferInsert;
export type CareMark = typeof careMarks.$inferSelect;
export type NewCareMark = typeof careMarks.$inferInsert;

/**
 * The store handle the repositories accept. Permissive over result-kind so the
 * **same** repository code runs on the async node:sqlite test driver
 * (`drizzle-orm/sqlite-proxy`) and the sync on-device driver
 * (`drizzle-orm/expo-sqlite`) — the driver is reconciled behind this type, and
 * repositories `await` every query (a no-op on sync results). Repos never import
 * a concrete driver.
 */
export type TerrariumDb = BaseSQLiteDatabase<'sync' | 'async', any>;

/**
 * `CREATE TABLE` form of the schema above — applied verbatim on both drivers
 * (`DatabaseSync.exec` in node tests, `SQLiteDatabase.execSync` on device). Must
 * mirror the Drizzle tables. `IF NOT EXISTS` keeps first-run/idempotent-init safe.
 */
export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS builds (
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

CREATE TABLE IF NOT EXISTS build_photos (
  id TEXT PRIMARY KEY NOT NULL,
  build_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  caption TEXT,
  taken_at INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_build_photos_build_id ON build_photos (build_id);

CREATE TABLE IF NOT EXISTS care_marks (
  id TEXT PRIMARY KEY NOT NULL,
  build_id TEXT NOT NULL,
  plant_slug TEXT,
  kind TEXT NOT NULL,
  note TEXT,
  due_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_care_marks_build_id ON care_marks (build_id);

CREATE TABLE IF NOT EXISTS plants (
  slug TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS containers (
  slug TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS presets (
  slug TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);
`;

/** The one additive column the substrate mixer (Phase 8) adds to `builds`. */
export const SUBSTRATE_MIX_COLUMN = 'substrate_mix';

/**
 * Guarded additive migration, run on every store open after `SCHEMA_DDL`.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op against an existing table, so it can
 * **never add a column** — a store created before the mixer shipped would be missing
 * `builds.substrate_mix`. This checks the live columns and `ALTER TABLE … ADD
 * COLUMN`s it only when absent (idempotent: a fresh DB already has it from the DDL,
 * so the guard does nothing). The column is appended on upgrade, but every query
 * Drizzle issues names its columns explicitly, so physical order never matters.
 *
 * Both drivers route through this single function (device `client.expo.ts` + the
 * node test helper) so CI exercises the same upgrade path the phone takes. This is
 * the *only* additive column v2.0 → (mixer) introduces — deliberately not a full
 * migration framework.
 *
 * @param buildsColumns the live column names of `builds` (from `PRAGMA table_info`).
 * @param exec runs a result-less DDL statement on the underlying driver.
 */
export function ensureSubstrateMixColumn(
  buildsColumns: readonly string[],
  exec: (sql: string) => void,
): void {
  if (!buildsColumns.includes(SUBSTRATE_MIX_COLUMN)) {
    exec(`ALTER TABLE builds ADD COLUMN ${SUBSTRATE_MIX_COLUMN} TEXT`);
  }
}
