/**
 * Node test driver — wraps Node's built-in `node:sqlite` behind Drizzle's
 * `sqlite-proxy` so the **same repository code** runs in the pure-node Vitest
 * runner. expo-sqlite is a native module and will not load here (the Vitest env
 * is `node`, no RN transform), so the on-device path (`client.expo.ts`) uses
 * expo-sqlite and this path mirrors v1's isolated-DB fixture (`conftest.py`).
 *
 * `node:sqlite` is the flag-free built-in DB the Phase-3 seed gate already used in
 * Node 22. This module is imported **only** by tests/node tooling — never by app
 * or repository code — so the device bundle never references `node:sqlite`.
 */
import type { DatabaseSync } from 'node:sqlite';

import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { TerrariumDb } from './schema';

/** Coerce a Drizzle-bound param into a value `node:sqlite` accepts (no booleans/undefined). */
function toSqliteValue(v: unknown): any {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}

/**
 * Build a `TerrariumDb` backed by an open `node:sqlite` database.
 *
 * The `sqlite-proxy` contract (see `drizzle-orm/sqlite-proxy/session.js`):
 *   - `'all'` / `'values'` → `{ rows: any[][] }` (each row an array of column
 *     values in the query's column order).
 *   - `'get'` → `{ rows: any[] | undefined }` (a **single** row as a values
 *     array, or a falsy value when absent — Drizzle maps that to `undefined`).
 *   - `'run'` → `{ rows: [] }`.
 * `node:sqlite` returns rows as column-keyed objects; `Object.values` recovers the
 * positional array in SELECT order, which is what Drizzle maps back by field.
 */
export function createNodeDb(sqlite: DatabaseSync): TerrariumDb {
  return drizzle(async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    const args = params.map(toSqliteValue);

    if (method === 'run') {
      stmt.run(...args);
      return { rows: [] };
    }
    if (method === 'get') {
      const row = stmt.get(...args);
      // A single row as a values array, or undefined → Drizzle returns undefined.
      return { rows: (row ? Object.values(row) : undefined) as any };
    }
    // 'all' | 'values'
    const rows = stmt.all(...args) as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  });
}
