/**
 * Backup-payload schema versioning + the migrate ladder (decision 17).
 *
 * This is the **scaffold** the Phase-5 backup/restore reuses (decision 17). Shipping
 * an *unversioned* backup is the one unfixable mistake (files in the wild would carry
 * no version, so a later app couldn't tell what it's reading). So:
 *   - the backup envelope is **versioned** — `schemaVersion` is now **2**;
 *   - the `vN → vN+1` chain has its first real entry at **v1 → v2** (Phase 8): the
 *     substrate-mixer `substrateMix` field. It is an **additive nullish column**, so
 *     the step is the **identity** transform — a v1 build simply lacks the key, which
 *     resolves to `null` at insert. Bumping the stamp (rather than leaving it at 1)
 *     exercises the ladder + the refuse-newer guard for real, and is correct if the
 *     mixer ships in an update *after* base v2.0;
 *   - a payload **newer** than this build is **refused** with a clear message — a
 *     foundation never best-effort-guesses a future schema.
 *
 * Phase 5's import path is: read `envelope.schemaVersion` → `migratePayload(...)`
 * up to `STORE_SCHEMA_VERSION` → validate against the current zod schemas → insert
 * in one transaction (restore = replace). The on-device store and the importer
 * share **this** ladder so they can never drift.
 */

/** The current local-store / backup schema version. Bump when a `MIGRATIONS` step is added. */
export const STORE_SCHEMA_VERSION = 2;

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
 *
 * `1` (v1 → v2, Phase 8): the substrate-mixer `substrateMix` field. Additive +
 * nullish — a v1 build just omits the key, and the importer resolves a missing
 * `substrateMix` to `null` — so no payload transform is needed (**identity**). The
 * step still exists so the ladder is walked for real (and so a future v2 → v3 has a
 * registered predecessor).
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (data) => data,
};

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
 * `STORE_SCHEMA_VERSION`, using the real ladder. A current-version file is returned
 * unchanged; a v1 file runs the v1 → v2 identity step (additive `substrateMix`).
 */
export function migratePayload<T = unknown>(
  data: T,
  fromVersion: number,
  toVersion: number = STORE_SCHEMA_VERSION,
): T {
  return migrateWith(MIGRATIONS, data, fromVersion, toVersion);
}
