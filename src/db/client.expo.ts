/**
 * On-device driver — Drizzle over `expo-sqlite`. The production counterpart to
 * `client.node.ts`; both return a `TerrariumDb`, so the repositories are
 * driver-agnostic.
 *
 * **Native — do not import from tests or repository code.** `expo-sqlite` is a
 * native module and does not load in the pure-node Vitest runner. The test path
 * uses `createNodeDb`; this is the device scaffolding the repositories plug into.
 */
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import {
  ensureCareOverridesColumn,
  ensureCharcoalDepthColumn,
  ensureSubstrateMixColumn,
  SCHEMA_DDL,
  type TerrariumDb,
} from './schema';

const DB_FILENAME = 'terrarium.db';

/**
 * Open (or create) the on-device database, ensure the schema exists, and return
 * the Drizzle handle. Schema creation is idempotent (`CREATE TABLE IF NOT
 * EXISTS`), mirroring v1's `init_db()`; the payload migrate ladder (`migrate.ts`)
 * handles cross-version data, not table creation.
 *
 * After the base DDL, run the guarded additive ALTERs for `substrate_mix`,
 * `charcoal_depth`, and `care_overrides`: a store created before each feature shipped
 * has every table but lacks that column, and `CREATE TABLE IF NOT EXISTS` can't
 * backfill it. The node test helper mirrors this exact sequence so CI walks the same
 * path.
 */
export function createExpoDb(filename: string = DB_FILENAME): TerrariumDb {
  const sqlite = openDatabaseSync(filename);
  sqlite.execSync(SCHEMA_DDL);
  const cols = sqlite
    .getAllSync<{ name: string }>('PRAGMA table_info(builds)')
    .map((c) => c.name);
  ensureSubstrateMixColumn(cols, (sql) => sqlite.execSync(sql));
  ensureCharcoalDepthColumn(cols, (sql) => sqlite.execSync(sql));
  ensureCareOverridesColumn(cols, (sql) => sqlite.execSync(sql));
  return drizzle(sqlite) as unknown as TerrariumDb;
}
