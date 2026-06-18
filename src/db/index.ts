/**
 * Local-store public API (Phase 4) — the **driver-agnostic** surface.
 *
 * Re-exports the schema, repositories, seed loader, and migrate ladder. It does
 * **not** re-export a concrete driver (`client.node` pulls in `node:sqlite`;
 * `client.expo` pulls in the native `expo-sqlite`) — importing `@/db` must be safe
 * in both the node test runner and the device bundle. Construct the `TerrariumDb`
 * at the edge (tests via `client.node`, the app via `client.expo`) and hand it to
 * these repositories, which never reach a driver themselves.
 */
export * from './schema';
export * from './ids';
export * from './builds-repo';
export * from './photos-repo';
export * from './care-repo';
export * from './seed';
export * from './migrate';
