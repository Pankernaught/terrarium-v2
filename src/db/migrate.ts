/**
 * Backup-payload schema versioning + the migrate ladder (decision 17).
 *
 * This is the **scaffold** the Phase-5 backup/restore reuses — no migration runs
 * in v2.0, but shipping an *unversioned* backup is the one unfixable mistake (v2.0
 * files in the wild would carry no version, so v2.1 couldn't tell what it's
 * reading). So:
 *   - the backup envelope is **versioned now** — `schemaVersion` starts at **1**;
 *   - the `vN → vN+1` chain exists but is **empty** at v1 (a no-op migrate). The
 *     first real step (v1 → v2: substrate-mix fields + reusing `placements` for the
 *     3-D display) lands in **v2.1**;
 *   - a payload **newer** than this build is **refused** with a clear message — a
 *     foundation never best-effort-guesses a future schema.
 *
 * Phase 5's import path is: read `envelope.schemaVersion` → `migratePayload(...)`
 * up to `STORE_SCHEMA_VERSION` → validate against the current zod schemas → insert
 * in one transaction (restore = replace). The on-device store and the importer
 * share **this** ladder so they can never drift.
 */

/** The current local-store / backup schema version. Bump when a `MIGRATIONS` step is added. */
export const STORE_SCHEMA_VERSION = 1;

/**
 * The decision-17 backup envelope. `data` holds only user data that round-trips:
 * builds (with their `placements` riding inside each build) and care-marks. Photos
 * are **excluded** (decision 7 — the payload carries references, not binaries), and
 * seed/reference data never enters a backup (decision 17). Loosely typed here; the
 * Phase-5 export/restore pins the concrete row shapes against the zod schemas
 * *after* migration.
 */
export interface BackupData {
  builds: unknown[];
  careMarks: unknown[];
}

export interface BackupEnvelope<TData = BackupData> {
  schemaVersion: number;
  appVersion?: string;
  exportedAt?: string;
  data: TData;
}

/** A single `vN → vN+1` payload transform. Pure — no I/O, no DB. */
export type Migration = (data: any) => any;

/**
 * The migration ladder, keyed by **source** version (`N` migrates `N → N+1`).
 * Empty at schema v1; the first entry (`1`) is added in v2.1.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

/** Message for a payload made by a newer app than this build understands. */
export function newerSchemaMessage(fromVersion: number, toVersion: number): string {
  return (
    `This backup was made by a newer version of the app (schema v${fromVersion}, ` +
    `this app supports up to v${toVersion}). Please update the app to restore it.`
  );
}

/**
 * Pure migration core — apply a `vN → vN+1` chain drawn from `migrations` to move
 * `data` from `fromVersion` up to `toVersion`. Injecting `migrations` keeps it
 * testable with a fake ladder (the real ladder is empty until v2.1).
 *
 * @throws if the payload is newer than `toVersion` (refuse — never guess forward),
 *   or if a step in the chain is missing.
 */
export function migrateWith<T = unknown>(
  migrations: Readonly<Record<number, Migration>>,
  data: T,
  fromVersion: number,
  toVersion: number,
): T {
  if (fromVersion > toVersion) {
    throw new Error(newerSchemaMessage(fromVersion, toVersion));
  }
  let current: any = data;
  for (let v = fromVersion; v < toVersion; v++) {
    const step = migrations[v];
    if (!step) {
      throw new Error(`No migration registered from schema version v${v} to v${v + 1}.`);
    }
    current = step(current);
  }
  return current;
}

/**
 * Migrate a backup payload from its on-file `fromVersion` up to the app's current
 * `STORE_SCHEMA_VERSION`, using the real ladder. A v1 file with `toVersion === 1`
 * is returned unchanged (the no-op migrate).
 */
export function migratePayload<T = unknown>(
  data: T,
  fromVersion: number,
  toVersion: number = STORE_SCHEMA_VERSION,
): T {
  return migrateWith(MIGRATIONS, data, fromVersion, toVersion);
}
