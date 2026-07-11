# M2 · Foundation — normalized schema + ordered migration harness — Pass 2 plan (file-level)

**Status:** planned (Pass 2 complete, 2026-07-11). Not yet executed — and per the outline's dependency order, **not executable until M1 lands** (engines in their boundary). Planning it before M1 is deliberate: the data model is the linchpin whose shape settles M1's extraction boundaries, M4's reconciliation, and M9's field mapping (outline, Recommended Pass 2 order #2).
**Phase ID:** M2 (see `00-conceptual-outline.md` § M2 for the ratified scope; this file expands it, it does not re-derive it).
**Intent sources:** master plan §5 (layers), §5.1 (local-first sync/outbox), §6 (target data model), §6.2 (provenance/rule versioning), §6.3 (animal-ready), §9 (bridge-first + field mapping + First-PR boundary: *"the second [change] introduces the migration harness and the new tables beside the old ones"* — M2 **is** that second change), §10 Phase 1, §11 (quality gates + SDK 56 constraints), §15 item 4, App. A `db/*` rows, App. C Phase-1 evidence.
**Reality source:** working tree on `verdict-overhaul` @ `e76559e` (+ owner's in-flight files, untouched), re-verified 2026-07-11 — all `path:line` cites below are from that verification.

M2 is a **build phase planned on paper here**: harness + empty normalized tables + repository/use-case contracts + the CI gate. It imports **no legacy data** (that is M9), composes **no screens** (M6/M7), and changes **no engine behavior** — the R5 golden fixtures must pass **byte-unchanged** throughout (ADR 0029); the only fixture-adjacent surface it touches is `client.expo.ts` wiring, and §10 below proves that equivalence mechanically. App. A verdicts honored: `db/schema.ts` REPLACE *via migration, old schema kept as source until cutover*; `db/*-repo.ts`/`provider.tsx` KEEP-the-pattern; `db/ids.ts` + both clients KEEP; `db/migrate.ts` REPLACE resolves as **split axes** (§3.1), not deletion.

---

## 1. Restated scope

Stand up the normalized local data model **beside** the legacy three tables and install a real ordered, transactional, rollback-tested SQLite migration mechanism — replacing create-if-not-exists + presence-guarded `ALTER`s as the *mechanism* while keeping them as *step 0001's content* (§5, §5.1, §6, §9, §15 item 4). In: `PRAGMA user_version` axis + ordered steps; the layer-D/A tables (terrariums … outbox); repository/use-case interfaces with a sync-neutral local implementation; new route-group/feature boundaries without recreating old screens; §6.3 animal-ready hooks; SDK 56 lint baseline fixed and lint + type-check + unit + migration tests as required checks (§11). Out: legacy-data import (M9), organism/profile content model (M4), new screens (M6/M7), any engine change. Depends on: M1 (execution); nothing (planning). Size L.

## 2. Pass-2 verification results (2026-07-11)

Run during planning so the plan starts from facts, not the outline's assumptions:

| Item | Result |
|---|---|
| Type-check | **GREEN** (`tsc --noEmit` exit 0). |
| Full suite | **GREEN — 38 files / 422 tests, 0 failures**, golden fixtures included and byte-unchanged (no code touched this session). |
| Lint baseline | **19 errors / 7 warnings — identical to the M0 §2 numbers.** All 19 errors live in **5 files**: `src/components/planner/cross-section.tsx` (~8, react-compiler render-phase/immutability family), `src/components/planner/plants-step.tsx` (2), `src/components/ui/range-slider.tsx`, `src/app/settings.tsx` (incl. the one `react/no-unescaped-entities`), `src/hooks/use-color-scheme.web.ts` (`react-hooks/set-state-in-effect`). 0 errors auto-fixable. Fate of the two big offenders: M7 REBUILD / M10 retire — shapes §9's strategy. |
| Schema-version axis | **Confirmed absent:** no `PRAGMA user_version` anywhere in `src/` or `tools/`. Schema state is inferred per-open from live column presence: `SCHEMA_DDL` (`CREATE TABLE IF NOT EXISTS`, `schema.ts:150`) + `ensureSubstrateMixColumn`/`ensureCharcoalDepthColumn`/`ensureCareOverridesColumn` (`schema.ts:223-268`), sequenced in `createExpoDb` (`client.expo.ts:35-45`) and mirrored by the node test helper. Confirms Open Q A2's premise. |
| Payload ladder | `migrate.ts` is **only** the backup-payload ladder: `STORE_SCHEMA_VERSION = 2` (`migrate.ts:23`), pure `vN→vN+1` transforms (`migrate.ts:44`, "no I/O, no DB"), refuse-newer guard. Restore path = ladder → zod → replace (`backup.ts:13-20,163-221`). It never touches DDL. Confirms A2's other premise. |
| A4 column types | Confirmed at line level: `substrateDepth`/`drainageDepth`/`charcoalDepth` are scalar `real` columns (`schema.ts:61-69`); `substrateMix` is a JSON **object** `componentId → integer parts` (`schema.ts:77`); `careOverrides` is a JSON **object** `taskType → {intervalDays?, muted?}` (`schema.ts:85`); `placements` is a JSON **array** of `{slug,x,y,scale}` (`schema.ts:58`). |
| Transactions | The node test driver (`drizzle-orm/sqlite-proxy`, `client.node.ts:38`) exposes **no interactive `transaction()`** — today's atomicity is anchored at validate-before-mutate (`backup.ts:19-20`). Raw `BEGIN`/`COMMIT` through the underlying drivers **is** available on both (`node:sqlite` `exec`; expo-sqlite `execSync` — SDK 56 explicitly supports explicit transactions, §11). The harness and the outbox invariant must therefore ride a **raw-SQL executor seam**, not Drizzle's transaction API (§5, §7). |
| FKs | None anywhere in the legacy schema — referential integrity is repo-enforced by design (`schema.ts:96`). New-table FK policy is a decision this plan makes (§6.4). |
| drizzle-kit | Present as a devDependency (`^0.31.10`) but **unused**: no `drizzle.config.*`, no journal dir. The harness design below deliberately does not adopt it (§5.5). |
| Route shell | Root layout is a single flat `Tabs` navigator; every non-tab route is registered `href: null` (`_layout.tsx:70-78`) — the precedent a hidden `(rebuild)` group follows (§8). |
| CI | Still **no hosted CI** (`.github/workflows/` absent); every green above is a local run. The §11 required-checks gate is this phase's deliverable (§9). |
| Tree discipline | `git status --porcelain` byte-identical to the session-2 wrap state — owner's in-flight vibes/canopy files untouched; R1 snapshot still holds. |

## 3. Settled questions — the on-paper resolutions this pass owes

### 3.1 A2 — payload ladder ≠ schema migration: **two mechanisms, two version axes, resolved**

The word "migration" currently names two different futures, and App. A's one-line `db/migrate.ts REPLACE — "Ordered DB and payload migrations with historical fixtures"` conflates them. M2 splits them permanently:

| | **Backup-payload ladder** (exists — keep) | **Schema-migration harness** (new — build) |
|---|---|---|
| Owns | Cross-version compatibility of **backup files** | Evolution of the **live SQLite database** (DDL) |
| Version axis | `STORE_SCHEMA_VERSION` in the JSON envelope (`migrate.ts:23`) | `PRAGMA user_version` in the DB file |
| Unit | Pure `vN→vN+1` payload transforms, no I/O | Ordered, transactional DDL steps |
| Home | `src/db/migrate.ts` — **untouched by M2** | `src/db/schema-migrations/` — new (§5) |
| Bumps when | The *envelope shape* changes (next: M8's media-manifest export → v3) | Any DDL lands (M2 itself: 0001→0005; M4/M6 append) |
| Interplay | none at runtime: restore = ladder → zod → repo writes into whatever schema the harness has already produced. A restored file never carries DDL; a migration step never reads envelopes. | |

Consequences: the two axes advance independently (M2 ships five schema steps and **zero** payload bumps); doc-banners in both modules cross-reference the other; the R5 `backup` golden fixture (which pins `migratePayload` v1→v2 and the refuse-newer throw) is untouched by construction. The rename of `migrate.ts` → `payload-migrate.ts` is **deferred to M8** (when its content changes anyway) to keep M2's diff mechanical. Recorded as **ADR 0030** at execution (§11, step S7).

### 3.2 A4 — exact legacy types → exact normalized destinations: **resolved**

The §9 field-mapping row "layer depths / mix → design components" now has precise semantics. Legacy source types verified in §2; destinations are the §6 tables:

| Legacy (`builds.*`, exact type) | Normalized destination | Precision notes for M9 |
|---|---|---|
| `substrate_depth REAL`, `drainage_depth REAL`, `charcoal_depth REAL` (cm, nullable scalars — **not** JSON) | One `design_layers` **row per layer**: `{design_revision_id, position, kind: 'drainage'\|'charcoal'\|'substrate', depth_cm REAL}` | `NULL` depth → **no row** (absent layer), never a 0-depth row. `charcoal_depth` null = no charcoal layer (ADR 0003 semantics preserved). Original calculator version rides `design_revisions.rule_set_version` (§9 "preserve the original calculator version"). |
| `substrate_mix TEXT` = JSON **object** `componentId → integer parts` (never an array; `null` = no custom mix) | `design_layers.recipe` (JSON **object**, same shape) on the `kind='substrate'` row | Kept as an object column, not exploded to component rows: reads are whole-recipe, writes are whole-recipe, and the material **catalog** split is M4's job (§4.2 → M4) — exploding now would guess M4's material keys. Component-row normalization remains open to M4 as an ordinary migration step *if* its catalog needs it. |
| `care_overrides TEXT` = JSON **object** `taskType → {intervalDays?, muted?}` (`null` = all defaults) | `care_policy_overrides` rows `{terrarium_id, task_type TEXT, interval_days INTEGER NULL, muted INTEGER(0/1) NULL, rule_set_version TEXT NULL}`, unique `(terrarium_id, task_type)` | Columns **specified here; DDL authored by M6** (its owner — the CarePlan reforge), created as an M6 harness step before M9 imports. "Translate by task type and version" (§9): task-type vocabulary maps 1:1 today; version stamps at import. |
| `placements TEXT` = JSON **array** of `{slug,x,y,scale}` | `design_revisions.placements` (JSON array, same shape) | Stays a JSON column: revisions are immutable snapshots (§5.1), so row-splitting buys nothing. Slug→profile re-key inside it is M4/M9 (Open Q A1). "Clamp and preserve" (§9). |

Outline Open Questions A2/A4 get `[Resolved …]` annotations pointing here (mirroring D1/D2).

### 3.3 Boundary ambiguity settled: which tables M2 creates

The outline's § M2 list omits profile/assertion tables, while § M4 "depends on M2 (profile/assertion tables)". Resolution — consistent with §10 Phase 1's own table list and cross-check row 174 ("M2 (tables) + M4 (profiles/assertions)"): **M2 creates the harness and the thirteen layer-D/A tables below; M4/M6/M11 author their own tables as later ordered steps on M2's harness.** That is what an ordered harness is *for* — M4's dependency on M2 is the mechanism + the tables its content rides on (`provider_snapshots`, `residents.profile_id` seam), not pre-built profile DDL. Specifically deferred: `organism_profiles`, `external_taxon_refs`, `cultivar_aliases`, `trait_assertions` (M4); `care_plans`, `care_policy_overrides`, `outcomes` (M6); `build_publications` (M11).

## 4. Target file layout

Everything new sits beside the legacy surface; nothing legacy moves or is deleted (bridge-first, §9).

```
src/db/
  schema-migrations/
    executor.ts        SqlExecutor type ({exec(sql), queryRows(sql)}) + expo/node adapters +
                       withTransaction(executor, fn) via raw BEGIN IMMEDIATE/COMMIT/ROLLBACK (§2 transactions row)
    steps.ts           SCHEMA_MIGRATIONS: readonly MigrationStep[] — {toVersion, name, up(exec)}; steps 0001–0005 (§5.3)
    runner.ts          runSchemaMigrations(executor): {applied: string[]} — reads user_version, applies steps > it,
                       one transaction per step, stamps version inside the same transaction (§5.2)
  normalized/
    schema.ts          Drizzle defs for the 13 tables (§6) + inferred row types + syncColumns() helper (§6.2)
    boundaries.ts      zod schemas for every JSON column (dimensions, recipe, placements, organisms, viability,
                       amounts, derivatives, outbox payload) — §6.1's "Zod validates at the data boundary" applied to layer D
    repos/             one file per aggregate, interface + create*Repository(db, executor) factory (house pattern,
                       builds-repo.ts:70-80): terrariums-, designs-, residents-, occurrences-, interventions-,
                       journal-, measurements-, media-, provider-snapshots-, outbox-repo.ts
    use-cases.ts       thin commands owning cross-repo invariants (§7.3): createTerrarium, reviseDesign,
                       recordIntervention, logJournalEvent, recordMeasurement — each entity-write + outbox-append
                       in ONE withTransaction. Engine-free: no src/logic import (decouples M2 from M1's boundaries).
  __tests__/
    schema-migrations.test.ts   ordering / idempotency / historical matrix / rollback-recovery / fresh≡upgraded (§10)
    normalized-crud.test.ts     per-repo round-trips, FK + integrity checks, outbox invariant (§10)
    helpers.ts                  EXTEND: node executor + openMigratedDb() so every db test runs post-harness
src/app/
  (rebuild)/_layout.tsx         nested Stack for the new feature shell (dormant)
  (rebuild)/store-inspector.tsx dev-only proof surface: table counts + user_version + last-applied step (§8)
  _layout.tsx                   EDIT: register <Tabs.Screen name="(rebuild)" options={{href:null}}/> (precedent :70-78)
src/db/client.expo.ts           EDIT: createExpoDb = open → runSchemaMigrations(expoExecutor) → drizzle handle
                                (replaces inline SCHEMA_DDL + ensure* calls; equivalence proven §10.1)
src/db/index.ts                 EDIT: re-export normalized surface (stays driver-free)
src/db/provider.tsx             EDIT: Repos gains the normalized repos + use-cases (screens untouched)
src/db/schema.ts                UNTOUCHED except a doc-banner line pointing at schema-migrations/ (source-of-truth
                                for legacy tables until cutover, App. A)
src/db/migrate.ts               UNTOUCHED (A2 — §3.1)
.github/workflows/checks.yml    NEW: npm ci → lint → typecheck → test:run on push/PR (§9)
eslint.config.js                EDIT: legacy-waiver override block + zero-error default (§9)
docs/adr/0030-*.md              NEW at execution: schema-migration mechanism + two-axes decision (§3.1, §5.5)
```

## 5. The schema-migration harness (design spec)

### 5.1 Version axis + bootstrap from presence-inference

`PRAGMA user_version` (integer, atomic with the DB file, supported by both drivers) becomes the single DDL version axis. **Bootstrap needs no probe:** every existing install reads `user_version = 0` regardless of which of the four historical column states it is in (base / +mix / +charcoal / +overrides), and step **0001 is idempotent by construction** — it runs `SCHEMA_DDL` (`CREATE TABLE IF NOT EXISTS`) plus the three `ensure*` guards (reused as-is from `schema.ts:223-268`, keeping their unit tests meaningful), which no-op wherever the work is already done. So the runner's one rule — *apply every step whose `toVersion` > `user_version`, in order* — handles fresh installs and all four historical states through the same code path. No presence-inference survives outside 0001.

### 5.2 Runner contract

- Steps are data: `{toVersion, name, up(exec)}`, `toVersion` dense from 1; the runner asserts density and monotonicity at startup (a gap or duplicate is a programmer error → throw, mirroring `migrateWith`'s missing-step throw, `migrate.ts:89`).
- Per step: `BEGIN IMMEDIATE` → `up(exec)` → `PRAGMA user_version = N` → `COMMIT`; any throw → `ROLLBACK` and rethrow. SQLite DDL is transactional, so a failed step leaves *both* the tables and the stamp at the pre-step state — re-open retries it. **No `down()` migrations**: on-device rollback is transaction abort + the R0–R3 recovery story, not reverse-DDL theater (decision, ADR 0030).
- `PRAGMA foreign_keys = ON` is set per-connection at open (after migration), never inside a step (SQLite ignores FK enforcement changes mid-transaction).
- The runner takes only the `SqlExecutor` — no Drizzle, no driver import — so device (`execSync`) and node (`DatabaseSync.exec`) share it verbatim; this rides *under* `sqlite-proxy`'s no-transaction limitation (§2).
- Refuse-newer, mirrored from the ladder: `user_version` **greater than** the last known step → throw with an update-the-app message (a downgraded binary must not run an unknown schema), same doctrine as `newerSchemaMessage` (`migrate.ts:61`).

### 5.3 The five M2 steps

| # | Name | Creates |
|---|---|---|
| 0001 | `legacy-baseline` | Legacy three tables + the three guarded columns (absorbs today's entire mechanism — §5.1) |
| 0002 | `normalized-core` | `terrariums`, `enclosures`, `designs`, `design_revisions`, `design_layers`, `residents` + indexes |
| 0003 | `lifecycle` | `task_occurrences`, `interventions`, `journal_events`, `measurements` + indexes |
| 0004 | `media-and-provider-cache` | `media_assets`, `provider_snapshots` + indexes |
| 0005 | `outbox` | `outbox_ops` + indexes |

Split rather than one mega-step so each transactional unit is small, reviewable, and the *ordering* machinery is exercised from day one (a single step would leave ordering untested until M4 appends).

### 5.4 What changes at the open path

`createExpoDb` (`client.expo.ts:35-45`) becomes: `openDatabaseSync` → `runSchemaMigrations(expoExecutor(sqlite))` → `PRAGMA foreign_keys = ON` → `drizzle(sqlite)`. The node test helper gains the same sequence, so CI keeps walking the exact upgrade path the phone takes (the property the current comment promises, `client.expo.ts:31-33`). Equivalence with the old inline sequence is proven mechanically in §10.1.

### 5.5 Alternative considered — drizzle-kit journal: **rejected**

`drizzle-kit generate` + `drizzle-orm` migrators assume a per-driver migrator entry and (on Expo) babel-inlined `.sql` imports; our constraints are dual-driver parity through one raw-exec seam, transactional stamping we control, and steps that can *reuse* the tested `ensure*` functions. Hand-written ordered steps match the house precedent (`SCHEMA_DDL` as reviewed source, `schema.ts:20-23`) and keep the harness ~150 lines of owned code. `drizzle-kit` stays a dev-time sanity tool (manual diff of `normalized/schema.ts` vs step DDL), never a runtime dependency. (ADR 0030 records this.)

## 6. The normalized schema (thirteen tables)

### 6.1 Design rules

- **UUID text PKs everywhere** via `newId()` (`ids.ts` KEEP — restore-safe, sync-natural).
- **§5.1 sync columns on every mutable user-data table** (the outbox seam's per-entity half): `rev INTEGER NOT NULL DEFAULT 1` (bumped per write), `created_at`/`updated_at INTEGER` (ms), `deleted_at INTEGER NULL` (soft-delete marker; hard delete stays legal until sync activates in M11). Emitted by one `syncColumns()` helper in `normalized/schema.ts` so the shape can't drift per-table. `provider_snapshots` is deliberately exempt (cache, not user data — refresh-wins, §5.1 table).
- **JSON columns are objects/arrays validated by `boundaries.ts` zod schemas at the repo edge** — never free-form (`§6.1` doctrine extended to layer D).
- **Timestamps** integer ms epoch (matches legacy `timestamp_ms` mode).
- **Animal-ready without scope (§6.3):** `residents.organism_kind TEXT NOT NULL DEFAULT 'plant'`; the vocabulary check lives in `boundaries.ts` with exactly `['plant']` enabled and the constant exported (`ENABLED_ORGANISM_KINDS`) so enabling a kind later is a policy change, not a schema change. Trait namespaces/welfare hooks need no M2 columns — they are M4 (assertions) and M13 (policy) concerns; what M2 owes is that nothing plant-specific leaks into resident/terrarium/task column names. Column names below honor that.

### 6.2 Tables (column sketch; exact DDL is execution work inside `steps.ts`)

| Table | Purpose (§6 concept row) | Key columns beyond `id` + sync set |
|---|---|---|
| `terrariums` | Real, owned ecosystem | `name`, `description`, `tags` JSON[], `enclosure_id → enclosures`, `current_design_revision_id` NULL, `legacy_build_id` NULL (audit link; M9 *also* preserves the UUID as `id` per §9) |
| `enclosures` | Vessel geometry + ventilation | `shape`, `dimensions` JSON obj (same vocabulary as `containers.ts` `Dimensions`), `volume_l REAL`, `opening`, `equipment` JSON NULL |
| `designs` | Design identity / head pointer | `terrarium_id` NULL (a design may precede its terrarium; "mark as built" links, M7), `name`, `head_revision_id` NULL |
| `design_revisions` | Immutable revision (§5.1: fork on concurrent edits) | `design_id`, `seq INTEGER`, `enclosure_id`, `organisms` JSON[] of `{ref, kind:'slug'}` (M4 re-keys to profiles — envelope avoids a table rebuild), `placements` JSON[] (§3.2), `rule_set_version` NULL + `viability` JSON NULL + `generated_at` NULL (§6.2 provenance; filled by M7, nullable until M1's version scaffold exists), no repo `update` method (immutability is contract, enforced in repo) |
| `design_layers` | Layer/Material rows (§3.2 A4 destination) | `design_revision_id`, `position INTEGER`, `kind` ('drainage'\|'charcoal'\|'substrate'\|'hardscape'), `depth_cm REAL`, `material_ref` NULL (componentId vocabulary until M4's catalog), `recipe` JSON obj NULL (substrate row) |
| `residents` | One organism in one terrarium | `terrarium_id`, `organism_kind` (§6.1 rules), `organism_ref` (legacy slug for now; M4 re-key), `profile_id` NULL **plain TEXT + index — FK deferred to M4** (§6.4), `status`, `added_at`, `removed_at` NULL, `placement` JSON NULL, `provenance` JSON NULL (`{designRevisionId}` — §15 "without losing provenance") |
| `task_occurrences` | One due action + status (§8; M6 owns semantics) | `terrarium_id`, `resident_id` NULL, `task_type`, `due_at`, `status` ('pending'\|'done'\|'skipped'\|'snoozed'), `completed_at` NULL, `snoozed_until` NULL, `source` ('derived'\|'manual'\|'legacy-import'), `rule_set_version` NULL |
| `interventions` | What was actually done | `terrarium_id`, `resident_id` NULL, `occurrence_id` NULL, `kind`, `amounts` JSON NULL, `note` NULL, `performed_at`, `legacy_payload` JSON NULL (§9: care_marks "preserve the raw legacy payload for audit") |
| `journal_events` | Unified timeline entries (append-only, §5.1) | `terrarium_id`, `at`, `kind` ('note'\|'photo'\|'milestone'\|…), `body` NULL, `media_asset_id` NULL, `ref` JSON NULL |
| `measurements` | Time-series environmental values (append-only) | `terrarium_id`, `at`, `type`, `value REAL`, `unit`, `source` ('manual'\|'sensor'), `quality` NULL, `superseded_by` NULL (correction = superseding record, §5.1) |
| `media_assets` | User/licensed media (§6; M8 activates binaries) | `terrarium_id` NULL, `resident_id` NULL, `storage_path`, `bytes` NULL, `checksum` NULL, `mime` NULL, `origin` ('user'\|'remote'), `license` NULL, `attribution` NULL, `upload_state` DEFAULT 'local-only', `derivatives` JSON NULL, `taken_at`, `caption` NULL, `sort_order` |
| `provider_snapshots` | Provider identity cache (M3 consumes) | `provider` ('inat'), `kind` ('taxon'\|'search'\|'observation-aggregate'\|'photo-meta'), `key`, `payload` JSON, `etag` NULL, `fetched_at`, `expires_at` NULL, `negative` 0/1; UNIQUE `(provider, kind, key)`; **no sync columns** (§6.1) |
| `outbox_ops` | §5.1 operation log (seam only; drained M11) | `seq INTEGER` AUTOINCREMENT (strict local order), `entity_table`, `entity_id`, `op` ('create'\|'update'\|'delete'\|'append'), `payload` JSON, `idempotency_key` UNIQUE, `sync_state` DEFAULT 'pending', `created_at`, `acked_at` NULL |

### 6.3 Explicitly not created in M2

§3.3's deferral list, verbatim in the schema doc-banner so nobody "helpfully" adds them early: organism/profile/assertion tables (M4), `care_plans`/`care_policy_overrides`/`outcomes` (M6, columns for the overrides pre-specified in §3.2), `build_publications` (M11).

### 6.4 FK policy (decision)

New tables declare real `FOREIGN KEY` clauses **among themselves** and run with `PRAGMA foreign_keys = ON`; legacy tables keep repo-enforced integrity (unchanged — FK enforcement only applies to declared constraints, so turning the pragma on cannot break them). Cross-phase references (`residents.profile_id` → M4's `organism_profiles`) stay plain indexed columns until the owning phase lands, then that phase decides rebuild-with-FK vs. permanent repo-enforcement (SQLite cannot `ADD CONSTRAINT`; a rebuild is a routine harness step by then). §11's "referential integrity" migration tests assert both the pragma state and a violation actually throwing.

## 7. Repositories, use-cases, and the transactional seam

1. **Pattern:** exactly the house pattern (interface + `create*Repository(db, …)` factory, imports restricted to `drizzle-orm`/schema/ids — `builds-repo.ts:21-23`), one repo per aggregate (§4 file list). Method sketches: `terrariums` save/load/list/update/softDelete; `designs` create/saveRevision (immutable append + head bump)/getHead/listRevisions + `layers` accessors; `residents` add/remove(list by terrarium); `occurrences` schedule/complete/skip/snooze/listDue; `interventions`+`journal`+`measurements` append/list-by-terrarium (append-only — no update); `media` register/list (rows only, no binary IO in M2); `provider-snapshots` get/put/evictExpired/putNegative; `outbox` append/listPending/markAcked.
2. **The seam:** repo factories take `(db, executor)`; multi-write invariants run inside `withTransaction(executor, fn)` (raw `BEGIN IMMEDIATE` — §2/§5.2). Single-row writes stay plain Drizzle calls (SQLite autocommit).
3. **Use-cases (`use-cases.ts`)** own the §5.1 invariant *"a local transaction writes the entity change and its outbox operation together"*: every command bumps `rev`, stamps `updated_at`, appends the `outbox_ops` row with a fresh `idempotency_key`, all in one transaction. Sync-neutral = rows accumulate, nothing drains them, no behavior depends on them (M11 activates; §5 "pre-draw the seam"). Use-cases import **no engine code** — M2 stays decoupled from M1's boundary choices; the first engine-calling use-case is M7's viability report.
4. **Zod at the boundary (`boundaries.ts`):** every JSON column has a schema; repos parse on read in dev/test builds and always validate on write (mirrors `backup.ts`'s validate-before-mutate doctrine).

## 8. Route groups + feature boundaries (without recreating old screens)

- `src/app/(rebuild)/` — a route **group** with its own nested `Stack` layout, registered on the root Tabs as `href: null` (the exact precedent of `glyph-lab`, `_layout.tsx:76-78`). URL-space stays clean (groups are path-invisible); nothing links to it from the product UI.
- One screen inside for M2: `store-inspector.tsx`, a dev-only diagnostics surface reading `user_version`, applied-step names, and per-table row counts through the normalized repos — the on-device half of the "offline CRUD works" exit proof, and the seed of the M6/M7 shell.
- **Legacy screens do not move.** Relocating them into a `(legacy)` group would churn the owner's in-flight tree for zero user-visible gain; the group boundary matters for *new* code only. M10 deletes, it doesn't reorganize.
- Feature-boundary rule for M2's code: new db surface under `src/db/normalized/` + `src/db/schema-migrations/` as specified; **no `src/features/` restructure** is invented here — package-boundary design for engines is M1's plan, and M2 must not preempt it (§1 depends-on note).
- Per AGENTS.md, execution consults the versioned Expo docs (`https://docs.expo.dev/versions/v56.0.0/`) before writing the route-group and expo-sqlite code — §11's SDK 56 constraints (Expo Router entry points only; explicit transactions; parameterized statements) are the contract.

## 9. Lint baseline + the required-checks gate (§11)

- **Zero-error strategy:** fix outright where local and behavior-preserving — `use-color-scheme.web.ts` (set-state-in-effect has a mechanical rewrite), `settings.tsx` unescaped entity, and `range-slider.tsx` if its fix is provably render-equivalent; **inventory-waive** the react-compiler render-phase errors in `cross-section.tsx` + `plants-step.tsx` via an `eslint.config.js` override block scoped to those two files, each line carrying its M7-REBUILD/M10-retire fate in a comment table. §11's "not waived globally" is honored: waivers are per-file, enumerated, and burn down at M7/M10; **new directories (`schema-migrations/`, `normalized/`, `(rebuild)/`) are never waived.** Net: `npm run lint` exits 0, warnings included in the count reported but not gated (7 today).
- **UI-touching lint fixes are device-unverified when made** (CI/device split honesty) — they join the owner verification queue like every UI change this project ships.
- **CI:** `.github/workflows/checks.yml` — Node 22, `npm ci`, `npm run lint && npm run typecheck && npm run test:run` on push + PR. Migration tests and golden fixtures ride `test:run`, so the §11 quartet (lint / type / unit / migration) is one workflow. Making the checks **required** is a GitHub branch-protection flip = **owner gate** (queued in the handoff beside the M0 three; solo work ends at "workflow exists and is green on `verdict-overhaul`").
- `npm run check` convenience script (lint+typecheck+test:run) so local discipline matches CI.

## 10. Test plan — the harness must *prove* §11's migration bullets

### 10.1 Schema-migration suite (`schema-migrations.test.ts`, node driver)

| Property (§11) | Test |
|---|---|
| Ordering | Runner applies exactly the steps > `user_version`, in order; density/monotonicity assertions throw on a gapped ladder (fake ladder injection, mirroring `migrateWith`'s test style) |
| Every supported historical schema | Matrix: fresh-empty · v2.0-base (3 tables, no extra columns) · +mix · +charcoal · +overrides (all four built by hand-rolled DDL fixtures mirroring real history) → run harness → **identical final state** |
| Fresh ≡ upgraded | Deep-compare normalized `sqlite_master` (tables, columns, indexes) of fresh-run vs. each upgraded fixture |
| Idempotency | Run harness twice on every matrix entry → second run applies zero steps, schema byte-identical |
| Referential integrity | `PRAGMA foreign_keys` confirmed ON; an orphaning insert/delete across a declared FK throws; the repo-enforced cross-phase columns documented as excluded |
| Rollback / recovery | Inject a step whose `up` throws mid-DDL → assert transaction rolled back (`user_version` unmoved, no partial tables), then a clean re-run completes — the §11 "recovery" bullet |
| Legacy equivalence | Post-harness DB passes the **existing** `substrate-mix-`/`charcoal-depth-`/`care-overrides-migration.test.ts` expectations and `backup.test.ts` round-trip unchanged — proving the `client.expo.ts` rewiring (§5.4) is behavior-identical |
| Golden net | Full suite green with **fixture files byte-unchanged** (ADR 0029) — asserted by running the goldens after all db tests; any diff fails M2 |

### 10.2 Normalized CRUD + seam suite (`normalized-crud.test.ts`)

Per-repo round-trips against a migrated node DB (create/read/update/soft-delete where applicable; immutability of revisions — `update` absent and `saveRevision` appends); zod boundary rejection on malformed JSON columns; the **outbox invariant** (a use-case write and its `outbox_ops` row commit or roll back together — induced failure between the two must leave neither); `ENABLED_ORGANISM_KINDS` gate (inserting a non-plant kind rejects at the boundary); provider-snapshot TTL/negative-cache accessors.

**Exit-of-suite bar:** all of §10 green **plus** the untouched 422 existing tests — locally and in the new CI workflow.

## 11. Execution order (each step leaves the suite green)

| # | Step | Lands |
|---|---|---|
| S0 | Pre-flight: confirm M1 executed + goldens green; branch discipline unchanged (no `git add -A`; owner tree untouched) | — |
| S1 | `schema-migrations/` executor + runner + step 0001 only; rewire `client.expo.ts` + node helper; §10.1 legacy-equivalence rows | The mechanism, proven harmless |
| S2 | Steps 0002–0005 + `normalized/schema.ts` + `boundaries.ts`; §10.1 matrix/idempotency/rollback rows | The thirteen tables |
| S3 | Repos + `use-cases.ts` + §10.2 suite | The contracts |
| S4 | `provider.tsx` extension + `(rebuild)/` group + store-inspector | The proof surface (device check = owner queue) |
| S5 | Lint baseline: fixes + inventoried waivers → `npm run lint` exit 0 | §9 first half |
| S6 | `checks.yml` + `npm run check`; verify green on push | §9 second half (required-flip = owner gate) |
| S7 | ADR 0030 (proposed): two-axes decision, no-down-migrations, FK policy, drizzle-kit rejection | The record |
| S8 | Close out: update BASELINE-style evidence in `deliverables/` + handoff; suite green twice | Exit |

## 12. Exit-criterion checklist (outline § M2 ←→ App. C Phase 1)

| Criterion | Satisfied by | Evidence |
|---|---|---|
| Offline CRUD against new tables | §10.2 suite (CI) + store-inspector (device, owner-verified) | test run + inspector screenshot |
| Ordered / idempotent / integrity / rollback migration tests | §10.1 suite | test run |
| New tables coexist with legacy three | steps 0002–0005 create-beside; zero legacy DDL touched after 0001 | `sqlite_master` diff in tests |
| Zero-error lint + type on new surface | §9 (new dirs never waived; repo-wide exit 0) | lint/typecheck output |
| Required-checks gate live | `checks.yml` green; **branch-protection flip = owner gate** | workflow run + owner queue |
| App. C "Ordered migrations / Normalized local schema / Repository contracts" | above | this plan §5–§7 |
| App. C "Offline vertical slice" | **NOT closed by M2** — honest split: M2 delivers CRUD-level offline proof; the user-visible slice (§15 item 8) closes with M6/M7 per outline cross-check (§10 Phase 1 = M1+M2; slice → M6/M7 row) | recorded here + in handoff |
| Golden fixtures byte-unchanged (ADR 0029) | §10.1 golden-net row | fixture diff = empty |

## 13. Risks & unknowns for execution

- **`client.expo.ts` rewiring is the one legacy-touching change.** Mitigated by §10.1's legacy-equivalence rows + the goldens; still list it first in the PR description for review attention.
- **expo-sqlite transaction/pragma behavior on device** is asserted from SDK 56 docs (§11 bullet), verified in CI only via node:sqlite parity — a device semantics gap (e.g. `execSync` inside an open transaction) would surface at the owner's device pass. Keep the executor tiny so a device quirk is a one-file fix.
- **M1 hasn't been planned yet** (its Pass 2 follows this one). M2 assumes of M1 only: engines remain import-isolated and the suite stays green — no package-path assumption anywhere in M2's files (checked in §4/§7 by construction). If M1's plan moves test helpers, only `__tests__/helpers.ts` here needs a path touch-up.
- **Schema regret risk** (the L-size design risk the outline names): mitigated by nullable-first columns, JSON envelopes where M4/M6 will re-key (`organisms`, `material_ref`), and the harness itself — a wrong column is a later ordered step, not a crisis. The deliberately-deferred tables (§6.3) are the main guard against designing M4/M6's model for them.
- **Two version axes confuse future contributors** — the exact failure A2 flagged. Guarded by doc-banners both sides + ADR 0030 + the §3.1 table living in this stable reference.
- **Owner gates accumulate:** M0's three + branch-protection flip + store-inspector device check. None blocks M3/M1 planning; all block formal phase closes. Handoff carries the queue.

---

*Next per the outline's recommended order: **Pass 2 · M3** (iNaturalist adapter + cache — plan on paper, fed by the R9 spike findings), then M1's extraction plan against this model, then M4. M2 execution waits for M1 execution; nothing in this plan expires meanwhile.*
