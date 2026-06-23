/**
 * Isolated-DB test harness — the TS analog of v1's autouse `isolated_db` fixture
 * (`tests/conftest.py`). Each call returns a **fresh, empty in-memory** SQLite DB
 * with the full schema applied, wrapped as a `TerrariumDb` via the node driver.
 * Call it in `beforeEach` so every test runs against its own throwaway store and
 * can never touch a neighbour's rows.
 *
 * Not a `*.test.ts` file, so the runner ignores it as a suite — it is a helper.
 */
import { DatabaseSync } from 'node:sqlite';

import { createNodeDb } from '../client.node';
import {
  ensureCareOverridesColumn,
  ensureCharcoalDepthColumn,
  ensureSubstrateMixColumn,
  SCHEMA_DDL,
  type TerrariumDb,
} from '../schema';

export interface TestDb {
  /** The Drizzle handle the repositories accept. */
  db: TerrariumDb;
  /** The raw driver, for direct setup/inspection in tests. */
  sqlite: DatabaseSync;
}

/** A fresh in-memory store with the schema created. */
export function makeTestDb(): TestDb {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(SCHEMA_DDL);
  // Mirror the device open path: the guarded additive ALTER for `substrate_mix`.
  // A fresh DB already has the column from the DDL so this is a no-op here — but
  // it keeps CI walking the same code the phone runs, and the dedicated old-schema
  // migration test drives the branch that actually adds the column.
  const cols = (sqlite.prepare('PRAGMA table_info(builds)').all() as { name: string }[]).map(
    (c) => c.name,
  );
  ensureSubstrateMixColumn(cols, (sql) => sqlite.exec(sql));
  ensureCharcoalDepthColumn(cols, (sql) => sqlite.exec(sql));
  ensureCareOverridesColumn(cols, (sql) => sqlite.exec(sql));
  return { db: createNodeDb(sqlite), sqlite };
}
