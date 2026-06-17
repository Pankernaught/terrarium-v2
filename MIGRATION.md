# Terrarium V2 — migration control doc

This file is the **cross-chat memory** for the v1 → v2 (React Native + Expo) rebuild. The
migration is split across many focused chats (one per phase) so no single chat has to hold the
whole thing. **Read this file + only the `Rebuild docs/` sections your phase brief points to —
do NOT read all four docs every time.**

- **Spec (source of truth):** `Rebuild docs/` (decisions 1–18, fully grilled).
- **v1 reference oracle:** the sibling repo `../terrarium-app`, frozen at tag `v1-oracle`
  (`engine/` = the pure logic to port, `tests/` = the safety-net suite).
- **Toolchain:** Expo SDK 56, Expo Router, RN 0.85, React 19.2, Reanimated 4, Drizzle +
  expo-sqlite, zod 4, Vitest. Node 22 LTS lives in `~/.local`.

## How to continue (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). Read
> `MIGRATION.md` — the phase table + the distilled brief for the current phase — and only the
> `Rebuild docs/` sections that brief names. Do NOT read all four docs. You are doing **Phase N**.
> Use subagents for the self-contained chunks the brief lists (they keep this chat's context
> small). When the phase's Definition-of-Done passes: run the verification, commit, tag
> `v2-phase-N-complete`, update this file's phase table + session log, and **write the next
> phase's distilled brief + this same kickoff prompt** at the bottom. Then stop.

## Phase status

| Phase | Goal | Chats | Status |
|---|---|---|---|
| 1 | Lock decisions · freeze v1 · Expo skeleton | 1 | ✅ **done** |
| 2 | Port the pure engine, test-first (+ primary/secondary) | 1 | ✅ **done** |
| 3 | Ship the data (versioned JSON, images, presets) | 1 | ✅ **done** |
| 4 | Local store (Drizzle/expo-sqlite) + repositories | 1 | ✅ **done** |
| 5 | Core screens + component library + export/backup | 2 | 🔄 **in progress** — **chat 1 DONE** (component library + dashboard + build-detail + Browse/plant); chat 2 = export/backup + planner shell |
| 6 | Planner: 5-step flow + 2-D drag + 2-D preview | 2 | ⬜ |
| 7 | Care reminders + photo timeline | 1 | ⬜ |
| 8 | Substrate mixer (parallel to 7) | 1 | ⬜ |
| 9 | Premium polish | 1 | ⬜ |

## Handoff protocol (every phase chat follows this)

1. Verify the phase **Definition of Done** (DoD).
2. `git add -A && git commit` with a clear message.
3. `git tag -a v2-phase-N-complete -m "..."`.
4. Update the **phase status** table above + append a **session log** entry below.
5. Write the **next phase's distilled brief** (goal · DoD · which doc sections to read · subagent
   plan · gotchas) at the bottom, followed by the kickoff prompt. Then stop.

**Subagents:** a subagent runs in its own context and returns only a summary, so use them for
self-contained chunks (one engine module + its test suite; one isolated screen/component). Keep
cross-cutting design (the scoring rule, the DB schema) in the orchestrating chat.

---

## ▶ NEXT — Phase 5 distilled brief: core screens + component library + export/backup

**Goal.** The first **read-mostly UI**, built on the proven engine (Phase 2) + store (Phase 4). **Lock
the component library *first*,** then the dashboard, build-detail, and Browse/plant screens; then
**export + whole-app JSON backup/restore** (the decision-17 envelope, importing through the
**Phase-4 migrate ladder** already shipped in `src/db/migrate.ts`). Planner is **shell-only** this
phase. Budgeted for **2 chats** (see kickoff) — do not rush both into one.

**Read only these:** `Rebuild docs/Terrarium_V2_Migration_Sequence.md` → "Phase 5 — Core screens on
the trusted foundation"; `Terrarium_V2_Premium_Design.md` → **§7.2 component library** + the screen
sections (dashboard / build-detail / browse) + safe-area/spacing rules; `Terrarium_V2_Grill_Decisions.md`
→ decisions **7** (manual JSON backup/export — the model), **8** (toxicity **display-only**, never a
filter, **blank ≠ safe**), **3** (DB is curator-owned; "Suggest a plant" is **out-of-band**, no
in-app community/backend), **17** (backup envelope + import = migrate→validate→one-transaction;
refuse-newer; restore = replace — the **ladder + `STORE_SCHEMA_VERSION` + `BackupEnvelope` type
already exist** from Phase 4). v1 source-of-record: `../terrarium-app/engine/export.py` (TXT is a pure
string fn → port as-is; PDF used `reportlab` → becomes an **`expo-print` HTML→PDF** template +
`expo-sharing`), `pages/home.py` (the `handle_builds_and_actions` mega-callback + the
`except Exception: pass` grey-"⚠" at ~line 189 — **surface the diagnostic, don't swallow it**),
`components/build_card.py` (the **7-button card** → collapses to hero + name + Eco chip + a single
**⋮ overflow** + tap-to-open; "Post to Forum" is gone), `pages/build_detail.py` (728-line tabbed →
glance → verdict band → Tier-2 expanders → Tier-3 matrix behind a gesture), `pages/plant_profile.py`
+ the browse page, and `pages/planner.py` (**shell only** — stepper scaffold + persistent preview
pane, no interactions).

**Work.**
1. **Component library FIRST** (Premium §7.2): stat strip, section label, glance header, **verdict band**
   (Eco-balance meter + one plain-English sentence), chip/pill, bottom sheet, reusable meter. Pin the
   **4 / 8 / 16 / 24 / 32** spacing scale. Respect **safe-area insets from screen one** (the instant
   "web-wrapper" tell). Every screen pulls from these — build them before the screens.
2. **Dashboard (Terrariums).** Responsive **centered** grid; card = hero photo + name + Eco-balance
   chip + single **⋮ overflow** (Duplicate / Export / Delete) + tap-to-open. Wire load/rename/delete/
   duplicate to the **Phase-4 build repo** (plain store calls — no mega-callback). A `checkGroup`
   throw renders a **real diagnostic**, never a silent grey badge.
3. **Build detail (read-only by default).** Glance header → verdict band → Tier-2 (container facts,
   plant chips) → Tier-3 pairwise matrix behind a deliberate gesture. "Edit" re-opens the planner.
4. **Browse + plant view.** Search + filter (type / biome / light / difficulty). **Toxicity is
   display-only** (decision 8): a card indicator when non-empty (never color-alone) + a Tier-3 line;
   **never render absence as "Non-toxic ✓."** "Suggest a plant" is out-of-band (mailto / web form).
5. **Export & backup.** Per-build **TXT** = pure string fn (port `export.py` as-is, unit-testable);
   **PDF** = `expo-print` HTML→PDF + `expo-sharing`. **Whole-app JSON backup/restore** (decisions 7/17)
   via `expo-sharing` + `expo-document-picker`: export the **`{ schemaVersion, appVersion, exportedAt,
   data }`** envelope (builds + placements + care-marks; **photos excluded** — binary, documented gap);
   import = **`migratePayload()` (Phase-4 ladder) → zod-validate → insert in one transaction**, **refuse
   a newer-than-current file** with a clear message, **restore = replace** (wipe + load, with a confirm),
   any validation failure rejects the **whole file** (no half-import). The importer **degrades
   gracefully** on a missing photo file (placeholder hero, never crash). UUID build IDs (Phase 4) keep
   care-marks bound across the round-trip.
6. **Planner shell only** — stepper scaffold + persistent preview pane, **no interactions** (Phase 6).

**Gotchas.**
- **Build the component library *before* the screens**, not alongside — the Sequence is explicit.
- **`reportlab` does not exist in RN** → PDF is `expo-print` HTML. The TXT path stays a pure function.
- **Photos are excluded from the backup** (binary). Restore must placeholder a missing photo, not crash.
- **Don't re-implement persistence or versioning** — the repos (`createBuildRepository` /
  `createPhotoRepository`), the seed (`seedStore`), and the migrate ladder (`migratePayload`,
  `STORE_SCHEMA_VERSION`, `BackupEnvelope`) all exist in `src/db`. Construct the device DB via
  `createExpoDb()` (`src/db/client.expo.ts`) at the app edge and hand it to the repos.
- **Surface scoring failures** as diagnostics (kill the v1 `except: pass` grey badge).
- **CI tests pure logic only** (vitest is `environment: 'node'`, no RN transform). Screen *rendering*
  is verified on device/Expo, not in CI — be honest about that split in the session log.

**Subagent plan (2-chat phase).** **Chat 1** = component library + dashboard + build-detail +
Browse/plant. **Chat 2** = export/backup + planner shell. Keep the **component-library tokens/spacing**
and the **backup envelope + import pipeline** in the orchestrating chat (cross-cutting); delegate
self-contained *screens* (one screen + its pieces) to subagents. The export **TXT string fn** and the
**backup round-trip** (export→migrate→validate→insert) are pure → unit-test them in Vitest.

**DoD (Phase 5 exit):** dashboard, build-detail, and Browse **render real seeded data**; per-build
export produces **TXT + PDF**; **whole-app backup round-trips** (export → wipe → restore → identical,
care-marks still bound to their builds, a missing photo degrading to a placeholder not a crash); a
**newer-version** backup and a **corrupt** file are each **rejected cleanly** (no half-import); Browse
shows toxicity as a **display-only** indicator (never a "safe" claim); tap-to-open + ⋮ overflow work; a
deliberately broken build shows a **diagnostic, not a grey badge**. `npm run typecheck` clean; full
Vitest suite green (Phase 2–4 untouched).

**Verification:** `npm run typecheck` && `npm run test:run` (logic: export string fn + backup
round-trip + migrate); **plus an on-device/Expo render pass** for the screens (no RN component-test
harness in v2.0 — note what was checked manually vs. in CI).

### Kickoff prompt (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). You are doing
> **Phase 5 — Core screens + component library + export/backup** (a **2-chat** phase — this is
> **chat 1**). Read `MIGRATION.md` (the phase table + the "▶ NEXT — Phase 5" brief + the Phase-4
> session-log entry) and ONLY these doc sections: Sequence "Phase 5 — Core screens on the trusted
> foundation", Premium Design **§7.2** + the dashboard/build-detail/browse + safe-area/spacing
> sections, Decisions **7 / 8 / 3 / 17**. Do NOT read all four docs. v1 source-of-record:
> `../terrarium-app/engine/export.py`, `pages/home.py`, `components/build_card.py`,
> `pages/build_detail.py`, `pages/plant_profile.py` + browse, `pages/planner.py` (shell only). Phase 4
> is committed + tagged `v2-phase-4-complete`: the local store is live in `src/db` — `createExpoDb()`
> (device) / `createNodeDb()` (tests) behind `TerrariumDb`, `createBuildRepository` /
> `createPhotoRepository` (faithful ports w/ UUID PKs + the primary-photo invariants), `seedStore()`
> (idempotent 67/16+presets), and the decision-17 migrate ladder (`migratePayload`,
> `STORE_SCHEMA_VERSION = 1`, `BackupEnvelope`). The pure engine + zod schemas are in `src/{logic,
> types}`, the seed bundle in `src/data`, and **161 tests are green** — do NOT break them, and keep
> `src/logic` importing nothing from `src/db`/`src/data`. **Chat 1:** lock the component library FIRST
> (§7.2 + the 4/8/16/24/32 spacing scale + safe-area insets), then build the read-mostly screens —
> dashboard (centered grid; card = hero + name + Eco chip + single ⋮ overflow; wire to the build repo;
> surface scoring failures as a diagnostic, no silent grey badge), build-detail (glance → verdict band
> → Tier-2 → Tier-3 matrix), Browse + plant view (filters; toxicity display-only, **blank ≠ safe**).
> Construct the device DB via `createExpoDb()` and hand it to the repos — do NOT re-implement
> persistence. Use subagents for self-contained screens; keep the component-library tokens in the main
> chat. **Defer export/backup + planner-shell to chat 2.** When chat 1's slice is solid (screens render
> real seeded data; typecheck clean; suite green), DON'T tag — instead append a Phase-5 chat-1
> progress note to the session log and write a **"Phase 5 (chat 2)" distilled brief + kickoff**
> (export/backup + planner shell) at the bottom. Tag `v2-phase-5-complete` only when the **full** Phase-5
> DoD passes. Then stop.

---

## Session log

### Phase 1 — skeleton + orchestration scaffold (done)
- **Env:** Node 22.22.3 LTS installed to `~/.local` (symlinked into `~/.local/bin`, on PATH).
- **v1 frozen:** tag `v1-oracle` on `terrarium-app@3c1773e` (local; push blocked — no GitHub
  remote/auth yet, see follow-up). The uncommitted 1-line `planner.py` redirect was excluded
  (it diverged from the v2 plan).
- **Scaffold:** Expo SDK 56 (Expo Router) at `terrarium-v2`. Deps: zod 4, drizzle-orm, vitest,
  drizzle-kit, expo-sqlite/notifications/image-picker/camera/print/sharing/document-picker/haptics,
  @expo/vector-icons. `expo-gl`/`react-three-fiber` deliberately omitted (v2.1).
- **Structure:** `src/{logic,types,data,db}` created; example cruft pruned; **4-tab shell**
  (Terrariums · Browse · Care · Settings) via classic `expo-router` `Tabs` + `GestureHandlerRootView`.
- **Decisions made this chat:**
  - Used the **stable classic `Tabs`** (not the template's `unstable-native-tabs`) for the
    skeleton; the premium native tab bar + human-drawn icons are Phase 9.
  - **"screens/" → `src/app/`** (Expo Router file-based routing). See `src/README.md`.
  - Added `src/global.d.ts` (`declare module '*.css'`) so the template's web CSS import typechecks.
- **Verified:** `tsc --noEmit` clean · `vitest run` green (sanity test) · `expo start` boots Metro.
- **Tag:** `v2-phase-1-complete`.

### Phase 2 — port the pure engine, test-first (done)
- **Result:** the full v1 scoring/derivation engine is reproduced in TS under `src/logic/` +
  `src/types/`. **96 Vitest tests green** (8 files), `tsc --noEmit` clean. `recommend()` + the
  container builder import nothing from `src/db` (grep-verified).
- **Modules ported:** `constants.ts` (verbatim), `compatibility.ts` (`checkPair`/`checkGroup`),
  `environment.ts` (`deriveEnvelope`), `recommend.ts` (DB-free; candidates passed in),
  `containers.ts` (pure geometry — `resolve_build_container` **excluded** → Phase 4), `guide.ts`,
  `care.ts`; types `plant`/`container`/`results` (zod for persisted/validated shapes, plain TS for
  engine result types) + shared `__tests__/factories.ts` (`makePlant` / `makeContainerSpec`).
- **The one divergence (decision 15) — primary/secondary:** `light` + `soilMoisture` reshaped to
  `{primary, secondary?}` (pH untouched). 15a: score the best-matching pair on the v1 ladder; a
  distance-0 pair reached **only via a secondary** deducts the one-step caution penalty (−15 light /
  −7 moisture, `viaSecondary=true`). 15b: survival/lethal tier judged on **primaries only**
  (annotation suppressed). `growthRate` stays intentionally unscored.
- **Test-count reconciliation (96):** **71 faithful ports** (36 compatibility + 19 containers + 7
  guide + 4 environment + 3 care + 2 plant-model) + **25 net-new/replacement**: 8 new compatibility
  cases (the 2 sanctioned families — distance-0 secondary cap; primaries-only survival, incl. an
  explicit "a secondary does NOT rescue a lethal pairing"), 1 envelope-union, 5 recommend-coverage
  (recommend refactored to take candidates), 10 plant zod-validation tests (the 5 `test_models.py`
  social-schema tests dropped — social scrapped — and replaced), 1 Phase-1 sanity. The 3
  `test_containers` `resolve_*` cases are **deferred to Phase 4** with `resolve_build_container`;
  `test_builds.py` (12, CRUD) and `test_social.py` (9) were always Phase-4 / scrapped.
- **DESIGN NUANCE (flag for v2.1):** a *single* via-secondary distance-0 match scores **85 (light) /
  93 (moisture)** — inside the ≥80 "compatible" band. This is faithful to the frozen −15/−7 penalty
  + the ≥80 band (decision 6): only the composed multi-factor case reaches caution (100−15−7=78).
  The docs' "lands in caution / never a free 100" holds at the **conflict-severity** level (a
  via-secondary match always emits a caution conflict with `viaSecondary=true`, never a free 100).
  Whether to **hard-cap the verdict at caution** for any via-secondary match is an open **v2.1**
  question — deliberately NOT forced by changing a frozen constant during the faithful port.
- **Method:** orchestrator owned the entangled primary/secondary work (constants, compatibility,
  environment, recommend, types, factories) + the 2 net-new families; the 3 mechanical modules
  (containers, guide, care) + their suites were each delegated to a general-purpose subagent in
  parallel, then verified line-for-line against the v1 oracle (`../terrarium-app`).
- **Tag:** `v2-phase-2-complete`.

### Phase 3 — ship the data (done)
- **Result:** v1's **67 plants + 16 containers** are now **versioned, typed JSON** (`src/data/{plants,
  containers}.json`, `schemaVersion: 1`) that validate against the Phase-2 zod schemas. **112 Vitest
  tests green** (10 files) — the **96 Phase-2 tests untouched** + **16 net-new** (12 seed + 4 image);
  `tsc --noEmit` clean. Engine isolation re-verified: `src/logic` imports nothing from `src/db`/`src/data`.
- **Reproducible generator, not hand-written rows:** `scripts/build-seed.mjs` reads the v1 YAML and
  applies the transforms + the in-repo **botanical authoring tables** (the human-judgment part) → emits
  both JSON files; re-run if the YAML changes. The authoring tables are reviewable in that one file.
- **Schema (`src/types/plant.ts`) — extend, don't break:** all Phase-3 fields are **optional in the
  base `plantSchema`** (so `makePlant` + the Phase-2 zod fixtures still parse), and a stricter
  **`seedPlantSchema`** (in `src/data/index.ts`) *requires* `image` + the root-depth range + the frozen
  vocab for every shipped plant. `rootDepthCm` (read by nothing) replaced by the min/max range.
- **Data-model changes applied** (decisions 4/8/11/12/18): `light`/`soilMoisture` → `{primary,
  secondary?}` with **17 light / 10 moisture** secondaries authored (only where botanically real;
  every secondary one ladder-step from its primary — adjacency-checked; primary-only is intentional).
  **Toxicity** free text on **14/67** toxic/irritant species (aroids, begonias, tradescantia, jade,
  ficus, string-of-pearls) — a test guarantees a note **never reads as a safety claim** (`/non-?toxic|
  safe/i`), blank = "no note." **Substrate vocab frozen** to the 9 canonical `{id,label}` materials
  (`src/data/substrate-components.ts`), tags normalized to ids; **`wood`/`rock` split into
  `hardscapeTags`** on the **4** mounted epiphytes. **Root-depth** min/max authored for all 67,
  **reference-only** (height-derived heuristic + moss/epiphyte/succulent overrides — NOT a depth
  driver; depth math stays `maxHeightCm`-based, oracle parity preserved). **`nativeContext`** sentence
  on 25/67 (optional Tier-3 copy). `phPreference` carried through on all 67.
- **Onboarding presets:** **4** curated, mutually-compatible starter builds (`src/data/presets.ts`) —
  Beginner Sealed Jar, Tropical Terrarium, Desert Open Bowl, Open Foliage Garden — placements as plain
  `{slug, x, y, scale}`; referential integrity (container + plant slugs resolve) is tested.
- **Seed gate (`src/data/__tests__/seed.test.ts`):** zod-validates every record **and loads them into a
  throwaway in-memory SQLite DB asserting counts 67 / 16** — using Node's built-in **`node:sqlite`**
  (flag-free in Node 22) rather than pulling native expo-sqlite into the pure-node runner. Vitest
  config gained `src/data/**`.
- **⚠️ Images — the long pole is HANDED OFF, not finished.** The decision-18 accuracy-first CC/PD photo
  curation is **owner work** and is **NOT done**. What Phase 3 shipped is the *scaffolding* (exactly
  the agent-side split the brief specified): every plant carries an `image: "plants/<slug>.png"` path;
  **67 clearly-marked stylized placeholder SVGs** live in `assets/plants/_placeholders/`; a 67-row
  **`assets/plants/IMAGE_SOURCING.md`** worklist (all `Pending`) tracks the human pass; and a CI check
  (`images.test.ts`) enforces the path convention, placeholder-per-plant, the **license→credit**
  obligation, and **no `-NC`/`-ND`** (the last two vacuous until real photos + their licenses land).
  `imageCredit`/`imageLicense` are authored empty on purpose — **no attribution was fabricated.**
  Toxicity notes are likewise first-pass drafts from standard references for the owner (source of
  record) to verify. **Net: the engineering DoD passes; sourcing 67 real species photos remains the
  outstanding owner task.**
- **Method:** orchestrator owned the cross-cutting schema + the generator/authoring tables (botanical
  judgment) + presets + the seed test; **one general-purpose subagent** scaffolded the image layer
  (placeholders + manifest + image CI test), verified independently.
- **Tag:** `v2-phase-3-complete`.

### Phase 4 — local store + repositories (done)
- **Result:** the local store is live in `src/db`. **161 Vitest tests green** (16 files) — the **112
  Phase-2/3 tests untouched** + **49 net-new**; `tsc --noEmit` clean. Engine purity re-verified
  (`src/logic` imports nothing from `src/db`/`src/data`, grep-clean) and **social is fully gone** (no
  `LOCAL_AUTHOR`, no `engine/social.py` analog, `plant_photos` struck).
- **Schema (`src/db/schema.ts`) — two groups, one DB.** (1) **User data, the three persisted entities
  (decision 11):** `builds`, `build_photos`, `care_marks`. (2) **Seed reference tables (regenerable
  from the bundle, never in a backup):** `plants` / `containers` / `presets` as `{ slug, data }` JSON.
  `builds` carries the **container snapshot** + new **`placements`** (same `{slug,x,y,scale}` shape as
  the Phase-3 preset `Placement`, so a preset instantiates straight into a build) + **`substrateDepth?`
  / `drainageDepth?`** (decision 10). **Every row uses a generated UUID PK** (`src/db/ids.ts::newId`),
  not just builds (decision 17) — uniform + restore-safe + sidesteps autoincrement/`lastInsertRowid`
  through the proxy. `SCHEMA_DDL` is co-located with the Drizzle tables (applied via `exec` on both
  drivers). `care_marks` (id/buildId/plantSlug?/kind/note?/dueAt?/completedAt?/createdAt) lands now but
  has **no repo yet — Phase 7 owns it** (shape may still be refined there).
- **Driver reconciliation (the key design move).** Schema defined once via `drizzle-orm/sqlite-core`.
  **Device** = `drizzle-orm/expo-sqlite` (`client.expo.ts`); **tests** = Node's built-in `node:sqlite`
  wrapped behind `drizzle-orm/sqlite-proxy` (`client.node.ts`) — because **expo-sqlite is native and
  won't load in the pure-node Vitest runner**. Both return a permissive **`TerrariumDb`**; repositories
  take it by DI and **import no concrete driver** (grep-verified). `makeTestDb()` is the per-test
  isolated-DB fixture (à la `conftest.py`). A `client.node.test.ts` guards the proxy adapter (JSON +
  `timestamp_ms`→`Date` + nullable + delete round-trip).
- **Repositories (faithful ports, verified line-for-line vs the v1 oracle).** `createBuildRepository`
  (port of `engine/builds.py`, **12 `test_builds.py` cases** green) and `createPhotoRepository` (port of
  `engine/photos.py`, **17 invariant tests**: first photo auto-becomes primary; delete reassigns the
  primary to the earliest remaining; `getPrimary` falls back through unset/dangling/foreign pointers).
  Two intentional divergences, documented in the file headers: **(a)** `containerSlug` is simply
  **nullable** — v2 drops v1's `"custom"` sentinel (a legacy NOT-NULL workaround); **(b)** photo
  `sortOrder` is an explicit **append counter (`max+1`)** rather than v1's all-zero `sort_order`, making
  "earliest remaining" deterministic without clock resolution (the `takenAt` ASC tiebreak is kept).
- **`resolve_build_container` ported PURE** into `src/logic/containers.ts` (deferred from Phase 2): it
  takes the candidate containers as an argument — the same dependency-inversion `recommend()` uses — so
  the engine stays DB-free. The slug case (v1 hit `ContainerModel`) now resolves against the passed
  `loadContainers()`. The **3 `resolve_*` tests** moved into `containers.test.ts`.
- **Migrate ladder (`src/db/migrate.ts`, decision 17):** `STORE_SCHEMA_VERSION = 1`, an **empty**
  `MIGRATIONS` map (no-op at v1; the v1→v2 step lands in v2.1), a **refuse-newer** guard, and a
  testable `migrateWith(migrations, …)` core + the `BackupEnvelope` type. **Phase 5's import reuses
  this** (migrate → validate → one transaction) — it is NOT re-implemented there.
- **Seed wiring (`src/db/seed.ts`):** `seedStore(db)` does an **idempotent upsert-by-slug + prune**
  (mirrors v1 `db/loader.py::load_seed_data`) of `loadSeed()` into the reference tables — first-launch
  loads **67 / 16 + presets**, and re-running is a no-op (safe every launch).
- **Reconciliation note (decision 11).** "Three persisted entities" = **user data** (builds / photos /
  care-marks). `plants` / `containers` / `presets` are **seed reference tables** — regenerable from the
  bundle, never in the backup payload — seeded by `seedStore`, mirroring v1's `db/loader.py` (which
  likewise seeded plant/container tables by slug). So shipping them is consistent with decision 11, not
  a contradiction; the engine still reads the **bundle** directly (zero DB round-trip, decision 11).
- **49 net-new tests:** 12 builds-CRUD + 17 photo-invariant + 3 `resolve_*` + 8 migrate-ladder + 5
  seed-store + 2 driver-adapter + 2 build-round-trip (save→reload with `placements` + depths intact).
- **Method:** orchestrator owned the cross-cutting foundation (schema + both drivers + test harness +
  migrate ladder + seed + the pure `resolve_build_container`); the **builds-repo** and **photos-repo**
  chunks were each delegated to a general-purpose subagent (run **sequentially** to avoid shared-repo
  tsc races) against `node:sqlite`, then verified line-for-line against `../terrarium-app`.
- **Tag:** `v2-phase-4-complete`.

### Phase 5 — chat 1, PARTIAL (items 1–2 of 4: component library + dashboard) — NOT tagged
- **Scope this session:** the work-list's **items 1 (component library) + 2 (dashboard)** only. Items
  3 (build detail) + 4 (Browse/plant) are the **remainder of chat 1**; export/backup + planner shell
  are chat 2. **No tag** (the §1 component library + the dashboard are in; build-detail + Browse are not).
- **Result:** **181 Vitest tests green** (was 161 + **20 net-new** pure-logic) · `tsc --noEmit` clean ·
  new files lint-clean (`expo lint`) · **`expo export -p ios` bundles with no Metro/babel/import errors.**
  Phase 2–4 suites untouched; `src/logic` still imports nothing from `src/db`/`src/data`.
- **Doc reality check:** the brief points at Premium Design **"§7.2"**, but that doc tops out at **§6** —
  the component library is actually specified across **§3 (tokens)** + **§4 (per-screen pieces)**. Built
  from those. (Flag for whoever maintains the brief: the "§7.2" pointer is stale.)
- **1 · Component library (locked FIRST, the cross-cutting foundation — owned in the main chat).**
  - **Token system** rewritten into `src/constants/theme.ts` (§3): earth-modern light/dark `Colors`
    (forest/sage/terracotta + eco roles; **back-compat aliases** kept so the Phase-1 `themed-*` keep
    working), the **4/8/16/24/32/48 `Spacing`** scale, `Radii`, `Typography` (33/28/23/19/16/13/11 ·
    ratio 1.2), `Motion` springs (snappy/settle/delight/dragReturn/micro + the reduce-motion fade),
    and an `elevation()` e0/e1/e2 shadow+hairline helper. `useTokens()` (`src/hooks`) hands components
    `{ c, scheme, isDark }`.
  - **Pure, unit-tested logic** (in `src/logic`, so CI verifies it — the brief's "CI tests pure logic
    only" split): `eco.ts` (band thresholds = v1 badge ≥80/≥50; **`ecoColor` interpolates the meter in
    OKLab** so the midpoint is vivid amber not muddy brown — the one runtime-OKLCH payoff, done
    dependency-free), `verdict.ts` (`summarizeVerdict` → the one plain-English sentence, survival-critical
    leads over cautions), and **`score-build.ts` — the honest replacement for v1's `home.py:189`
    `except Exception: pass`**: resolves a build→(plants,container) via the injected seed (structural
    `Build` type, no db import → purity intact) and returns a **surfaced `diagnostic`** on a missing
    container / missing plant / `checkGroup` throw, never a swallowed error. Empty build → 100 (v1 parity).
  - **UI primitives** in `src/components/ui/` (+ barrel `index.ts`): `Screen` (safe-area frame — applied
    from screen one, the "web-wrapper" tell), `Text` (typed variants), `Card` (e0), `Meter`/`EcoMeter`,
    `Chip`/`EcoChip` (colour **always** paired with number+word — never-color-alone), `SectionLabel`,
    `StatStrip`, `GlanceHeader`, `VerdictBand` (Eco meter + sentence, or the diagnostic when scoring
    failed), `BottomSheet` + `ActionSheet` (velocity-aware swipe-down dismiss, Reanimated+GH on the UI
    thread), and semantic `haptics`.
- **2 · Dashboard (`src/app/index.tsx`).** Replaces v1's `home.py` mega-callback with plain repo calls.
  Responsive **centered, capped** grid (1 col → 2 at ≥560px, `MaxContentWidth` 760, 24px gutters) — fixes
  the left-aligned dead space. Card (`src/components/build-card.tsx`) = hero (expo-image, 🌿 fallback) +
  name + **EcoChip** + a **single ⋮ overflow** → `ActionSheet` (Duplicate / Export / Delete) + tap-to-open;
  the **7-button v1 card collapsed**, "Post to Forum" gone. **Optimistic delete + 5s Undo snackbar** (SQLite
  delete commits only after the window), **Duplicate** wired to the repo, **Export** is a placeholder
  `Alert` (the real TXT/PDF is the chat-2 export step — menu shape is final). Honest **loading (skeleton
  flash) / error (diagnostic) / empty** states. A scoring failure renders a real **"⚠ Needs review"** chip,
  **not** v1's silent grey badge.
- **App-edge wiring (cross-cutting, main chat):** `src/db/provider.tsx` (`DbProvider` + `useRepos`/
  `useDbState`) is the **one** place the native driver is built — `createExpoDb()` → `seedStore()` →
  hands the Phase-4 repos down by context; screens never touch a driver or re-implement persistence.
  Wired into `src/app/_layout.tsx`. Tap-to-open routes to a **placeholder** `src/app/build/[id].tsx`
  (hidden from the tab bar via `href:null`) — the real build-detail is item 3.
- **Method:** the entangled foundation (tokens + the three pure logic modules + the UI primitives + the
  DB provider) was owned in the orchestrating chat because every screen depends on it; the dashboard,
  though a "self-contained screen," was built in-chat too since it couples to `_layout` routing. No
  subagents this session (the one delegable screen wasn't cleanly isolatable from the routing change).
- **Honest split (per the brief):** typecheck + the full Vitest suite + lint + an iOS bundle export all
  pass in CI; **the on-device/Expo *visual* render of the dashboard is NOT yet done** — that's the next
  step's first action (`npm start`, open the dashboard, confirm the grid/cards/Eco chip/⋮ sheet render
  and the empty state shows, since the seed ships **0 builds** so the live screen is the empty state until
  a build exists).
- **▶ RESUME HERE (continue chat 1):** do **item 3 (build detail)** then **item 4 (Browse + plant view)**,
  reusing the locked component library (`@/components/ui`) + `scoreBuild`/`VerdictBand` + `useRepos`.
  Build detail: glance header → `VerdictBand` → Tier-2 (container facts via `StatStrip`, plant `Chip`s) →
  Tier-3 pairwise matrix behind a deliberate gesture; "Edit" re-opens the planner (Phase 6); replace the
  `build/[id].tsx` placeholder. Browse: search + filter (type/biome/light/difficulty) over `loadPlants()`;
  **toxicity display-only (decision 8) — a card indicator when the note is non-empty, never color-alone,
  and NEVER render blank as "Non-toxic ✓"**; "Suggest a plant" is out-of-band (mailto, decision 3). When
  items 3–4 land (screens render real seeded data; typecheck/suite/lint green), append a chat-1-complete
  note and write the **"Phase 5 (chat 2)" brief + kickoff** (export/backup + planner shell). Tag
  `v2-phase-5-complete` only when the **full** Phase-5 DoD passes.

  **Kickoff (paste into a NEW chat to resume):**
  > You're continuing the Terrarium V2 RN+Expo migration in `terrarium-v2`. Read `MIGRATION.md` (the
  > phase table + the "▶ NEXT — Phase 5" brief + the **Phase-5 chat-1 PARTIAL** session-log entry) and
  > ONLY: Sequence "Phase 5 — Core screens", Premium Design **§3 + §4** (the doc has no §7.2 — that
  > pointer is stale) for build-detail/browse + safe-area/spacing, Decisions **8 / 3** (and 7/17 when you
  > reach export). Do NOT read all four docs. **Chat 1 items 1–2 are DONE** (component library in
  > `@/components/ui` + tokens in `@/constants/theme` + pure `src/logic/{eco,verdict,score-build}.ts` +
  > the dashboard `src/app/index.tsx` + `DbProvider`/`useRepos`; 181 tests green, tsc/lint clean, iOS
  > bundle clean). **Your job: items 3 (build detail) + 4 (Browse + plant view)**, reusing the locked
  > library — do NOT rebuild tokens or re-implement persistence (`useRepos()` from `@/db/provider`;
  > `scoreBuild` + `VerdictBand` for the verdict; toxicity **display-only, blank ≠ safe**). Replace the
  > `src/app/build/[id].tsx` placeholder. **First, run the app and confirm the dashboard renders** (the
  > on-device visual pass wasn't done in chat-1; seed has 0 builds → you'll see the empty state). Defer
  > export/backup + planner shell to chat 2. When items 3–4 are solid, append a session-log note + write
  > the "Phase 5 (chat 2)" brief + kickoff; tag only at the full Phase-5 DoD.

### Phase 5 — chat 1, COMPLETE (items 1–4: component library + dashboard + build-detail + Browse/plant) — NOT tagged
- **Scope this session:** the work-list's **items 3 (build detail) + 4 (Browse + plant view)** — the
  remainder of chat 1 on top of chat-1's already-done items 1–2 (component library + dashboard). All four
  read-mostly screens now exist. **Export/backup + planner shell are chat 2.** **No tag** (the full
  Phase-5 DoD needs export + backup round-trip, which is chat 2).
- **Result:** **190 Vitest tests green** (was 181 + **9 net-new** pure-logic `filterPlants` cases) ·
  `tsc --noEmit` clean · new files lint-clean (`expo lint`) · **`expo export -p ios` bundles with no
  Metro/babel/import errors** (build/[id], plant/[slug], browse routes included). Phase 2–4 suites
  untouched; `src/logic` still imports nothing from `src/db`/`src/data` (the new `browse-filter.ts`
  imports only `../types`, like `compatibility.ts`).
- **3 · Build detail (`src/app/build/[id].tsx`).** Replaced the placeholder with the read-only view
  (Premium §4.3): hero → `GlanceHeader` → **`VerdictBand`** (the shared `scoreBuild` → meter + sentence,
  or a real diagnostic — same honest path as the dashboard, no grey badge) → **Tier-2** (container facts
  via `StatStrip` from `resolveBuildContainer`; plant `Chip`s that deep-link to the plant view) →
  **Tier-3 pairwise matrix behind a deliberate tap** (`haptics.select()` toggle; upper-triangle unique
  pairs from `report.pairMatrix`, each a verdict chip + per-conflict lines, **`viaSecondary` annotated**
  per decision 15). "Edit" stubs an Alert ("opens in the planner" — Phase 6). Async build-load handles
  loading / **not-found** / db-error honestly. Couples to routing, so kept in the main chat.
- **4a · Plant view (`src/app/plant/[slug].tsx`).** Port of v1 `plant_profile.py` on the Phase-3 model:
  care requirements (light/moisture render **primary + the tolerable secondary**, d.15), plant profile
  (growth/height/suitability/habit), **toxicity as a display-only "Safety note" card — rendered ONLY when
  a note exists, icon+word never colour-alone, and a blank note is NEVER shown as "Non-toxic ✓"** (d.8),
  optional Origin (`nativeContext`) + Notes, and "Used in these builds" (the one DB read, via
  `builds.containingPlant`). **v1's `plant_photos` section is gone** (struck Phase 4). **Plant catalog
  hero shows the 🌿 fallback** — the seed `image` path (`plants/<slug>.png`) isn't bundled (the
  accuracy-first photo set is the Phase-3 owner long-pole); the hero is the one place to wire real photos
  when they land. Registered as a hidden route (`href:null`) in `_layout`.
- **4b · Browse (`src/app/browse.tsx`) + the pure `filterPlants`.** Port of v1 `browse.py`, reshaped from
  a desktop table+dropdown wall into search + tappable chip facets over `loadPlants()` (decision 11, no DB
  round-trip). Filter set = **type / biome / light / difficulty** + free-text search, all run through the
  **pure, unit-tested `src/logic/browse-filter.ts::filterPlants`** (the CI-verifiable slice of item 4 — 9
  tests: search, each facet, multi-select OR, AND-across-facets, sort, and a **`@ts-expect-error` guard
  that there is no toxicity facet**). **Light filter matches primary OR secondary** (d.15). Plant rows
  carry a **"Handling note" indicator only when `toxicity` is non-empty** (icon+word, never colour-alone;
  blank ≠ safe, d.8). **"Suggest a plant" is out-of-band** — a `mailto:` to the owner (decision 3, no
  in-app community/backend).
- **Shared:** `src/lib/labels.ts` (presentation-only `humanize` / `lightLabel` / `moistureLabel` /
  `suitabilityLabel`) centralizes the v1 `.replace("-"," ").title()` formatting the screens repeat.
- **Doc pointer reality check (carried from chat-1):** the brief says Premium **"§7.2"**, but that doc
  tops out at **§6**; the component library + screen specs are **§3 (tokens) + §4 (per-screen)**. Built
  from those.
- **Method:** no subagents — build-detail couples to routing + the shared `scoreBuild`, and plant-view +
  Browse share the plant-rendering + `labels` helpers, so doing them in the main chat (where the full
  component-library context was already loaded) was lower-risk than cold-spawning agents that re-derive it.
  Consistent with chat-1's documented rationale.
- **Honest CI-vs-device split (per the brief):** typecheck + the full 190-test Vitest suite + lint
  (new files) + an iOS bundle export all pass in CI. **The on-device/Expo *visual* render is still NOT
  done** — no RN component-test harness in v2.0, and **no iOS simulator is available in this environment**
  (`xcrun simctl` lists none), so the dashboard/build-detail/Browse/plant screens have not been eyeballed
  running. The bundle-export clean + the seed-load tests give high confidence the data wiring is sound, but
  the literal "screens render real seeded data" visual confirmation remains a device task. (Seed ships **0
  builds** → the live dashboard is the empty state until a build exists; Browse shows the 67 plants.)
- **⚠️ Working tree is UNCOMMITTED.** chat-1's items 1–2 (component library, dashboard, `DbProvider`, the
  three pure logic modules) were **never committed** — they sit untracked alongside this session's
  build-detail / plant-view / browse / `browse-filter` / `labels`. The whole Phase-5 chat-1 slice is on
  disk, **not** in git history. Recommend committing it as a checkpoint before chat 2 (no tag yet).

---

## ▶ NEXT — Phase 5 (chat 2) distilled brief: export/backup + planner shell

**Goal.** Finish Phase 5: per-build **export** (TXT + PDF) and **whole-app JSON backup/restore** (the
decision-17 envelope, importing through the **Phase-4 migrate ladder**), plus the **planner shell**
(stepper scaffold + persistent preview pane, **no interactions** — Phase 6 owns the drag). The four
read-mostly screens already exist (chat 1); this is the write/IO + scaffold slice that takes Phase 5 to
its **full DoD + the `v2-phase-5-complete` tag**.

**Read only these:** `Terrarium_V2_Premium_Design.md` → **§4.4** (planner — shell only this phase) +
the safe-area/spacing rules you already know; `Terrarium_V2_Grill_Decisions.md` → decisions **7**
(manual JSON backup/export — the model) + **17** (envelope + import = migrate→validate→one-transaction;
refuse-newer; restore = replace) — **re-read these two even though chat 1 touched 3/8**; the Sequence
"Phase 5 — Core screens" **Export & backup** bullet. v1 source-of-record: `../terrarium-app/engine/export.py`
(the TXT summary is a **pure string fn → port as-is, unit-testable**; the PDF used `reportlab` →
**becomes an `expo-print` HTML→PDF template + `expo-sharing`**), and `pages/planner.py` (**shell only** —
stepper scaffold + persistent preview pane, no interactions).

**Work.**
1. **Per-build TXT export** — port `export.py`'s summary as a **pure string function** in `src/logic`
   (e.g. `src/logic/export-txt.ts`), taking the resolved build + plants + container (dependency-inverted,
   no DB/`src/data` import → engine-purity intact) → **unit-test it in Vitest**. Wire the dashboard +
   build-detail "Export" action (currently an `Alert` placeholder — the menu shape is final) to write the
   string to a temp file + `expo-sharing`.
2. **Per-build PDF export** — an **`expo-print` HTML→PDF** template (NOT `reportlab`, which doesn't exist
   in RN) → `expo-sharing`. The HTML template can reuse the TXT content shaped into markup. Device-only.
3. **Whole-app JSON backup/restore** (decisions 7 / 17) via `expo-sharing` + `expo-document-picker`:
   - **Export** the **`{ schemaVersion: STORE_SCHEMA_VERSION, appVersion, exportedAt, data }`** envelope
     (`BackupEnvelope` type already exists in `src/db/migrate.ts`). `data` = **builds + placements +
     care-marks** (the three persisted user entities). **Photos are EXCLUDED** (binary — documented gap).
     Seed reference tables (plants/containers/presets) are **never** in the payload (regenerable).
   - **Import = `migratePayload()` (the Phase-4 ladder, do NOT re-implement) → zod-validate against current
     schema → insert in ONE transaction.** **Refuse a newer-than-current file** with a clear message
     (`migratePayload` already guards this). **Restore = replace** (wipe user tables + load, behind a
     confirm; merge is v2.1). **Any validation failure rejects the WHOLE file** — no half-import.
   - The importer **degrades gracefully on a missing photo file** (placeholder hero, never crash). UUID
     build IDs (Phase 4) keep care-marks bound to their builds across the round-trip.
   - **Unit-test the round-trip in Vitest** (export → migrate → validate → insert → reload identical;
     newer-version rejected; corrupt file rejected) against `node:sqlite` — this is the CI-verifiable core.
   - Surface these in the **Settings** tab ("Back up to file" / "Restore from file").
4. **Planner shell** (`src/app/`, a new route — likely a hidden `planner` route the dashboard's "New" +
   build-detail's "Edit" point at): the **5-step stepper scaffold** (Container · Substrate · Hardscape ·
   Plants · Final) + the **persistent 2-D preview pane**, docked-peekable, **rendering nothing
   interactive** (Phase 6 owns drag-to-place + live recommendations + the preview sprites). Just the
   chrome: step indicator, next/back, the preview frame. Wire "Edit"/"New" to navigate here.

**Gotchas.** `reportlab` does NOT exist in RN → PDF is `expo-print` HTML. Photos are excluded from the
backup (binary); restore must placeholder a missing photo, not crash. **Don't re-implement the migrate
ladder / `STORE_SCHEMA_VERSION` / `BackupEnvelope`** — all in `src/db/migrate.ts`. Keep the **TXT string
fn + the backup round-trip pure** so CI verifies them; the screen IO (`expo-sharing` / `expo-print` /
`expo-document-picker`) is device-only and won't run in the node Vitest runner — be honest about that
split. The **iOS visual render of all Phase-5 screens is still unverified** (no simulator in chat-1's
env) — do a device/Expo render pass before tagging if a simulator is available, and note it honestly if not.

**Subagent plan.** Keep the **backup envelope + import pipeline** (cross-cutting, touches the migrate
ladder + a one-transaction insert) and the **TXT string fn** in the orchestrating chat. The **planner
shell** is a self-contained scaffold (no shared logic) → a good subagent candidate. The **PDF HTML
template** can also be delegated once the TXT content shape is fixed.

**DoD (full Phase 5 exit — tag `v2-phase-5-complete` here):** dashboard, build-detail, Browse render real
seeded data; per-build export produces **TXT + PDF**; **whole-app backup round-trips** (export → wipe →
restore → identical, care-marks still bound, a missing photo degrading to a placeholder not a crash); a
**newer-version** backup and a **corrupt** file are each **rejected cleanly** (no half-import); Browse
shows toxicity display-only (never a "safe" claim — done); tap-to-open + ⋮ overflow work (done); a broken
build shows a diagnostic not a grey badge (done); planner shell renders (stepper + preview, no
interactions). `npm run typecheck` clean; full Vitest suite green (Phase 2–4 + chat-1 untouched).

**Verification:** `npm run typecheck` && `npm run test:run` (TXT string fn + backup round-trip + migrate)
+ `expo export -p ios` clean; **plus a device/Expo render pass** if a simulator/device is available (note
the split otherwise). Then **commit + `git tag -a v2-phase-5-complete`** + update the phase table + append
a final Phase-5 session-log entry + write the **Phase 6** distilled brief + kickoff.

### Kickoff prompt (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in `terrarium-v2`. You are doing **Phase 5 — chat
> 2** (export/backup + planner shell — the final slice that takes Phase 5 to its DoD + tag). Read
> `MIGRATION.md` (the phase table + the **"▶ NEXT — Phase 5 (chat 2)"** brief + the **Phase-5 chat-1
> COMPLETE** session-log entry) and ONLY: Premium Design **§4.4** (planner — shell only), Decisions **7 +
> 17** (backup envelope + import pipeline), and the Sequence "Phase 5" **Export & backup** bullet. Do NOT
> read all four docs. **Chat 1 is DONE** — the component library (`@/components/ui` + `@/constants/theme`),
> the pure logic (`src/logic/{eco,verdict,score-build,browse-filter}.ts`), `DbProvider`/`useRepos`, and all
> four read-mostly screens (dashboard `src/app/index.tsx`, build-detail `src/app/build/[id].tsx`, plant
> `src/app/plant/[slug].tsx`, Browse `src/app/browse.tsx`); 190 tests green, tsc/lint clean, iOS bundle
> clean. **NOTE the chat-1 + chat-1-remainder work may still be UNCOMMITTED** — check `git status` first
> and commit it as a checkpoint before starting. **Your job:** (1) per-build **TXT** export = a **pure
> string fn** in `src/logic` (port `../terrarium-app/engine/export.py`, unit-test it) wired to the
> dashboard/build-detail "Export" action (currently an `Alert` placeholder) via `expo-sharing`; (2)
> per-build **PDF** = `expo-print` HTML→PDF (NOT `reportlab`) + `expo-sharing`; (3) **whole-app JSON
> backup/restore** (decisions 7/17) in **Settings** — export the `BackupEnvelope` (`{ schemaVersion,
> appVersion, exportedAt, data }`, data = builds + placements + care-marks, **photos excluded**); import =
> **`migratePayload()` (the Phase-4 ladder — do NOT re-implement) → zod-validate → one transaction**,
> **refuse newer**, **restore = replace** (confirm), any failure rejects the **whole file**, missing photo
> → placeholder not crash; **unit-test the round-trip in Vitest** against `node:sqlite`; (4) **planner
> shell** — the 5-step stepper scaffold (Container · Substrate · Hardscape · Plants · Final) + persistent
> 2-D preview pane, **no interactions** (Phase 6 owns drag). Reuse the locked component library; do NOT
> rebuild tokens or re-implement persistence/versioning. Keep the backup pipeline + TXT fn in the main
> chat; the **planner shell** is a good subagent. When the **full** Phase-5 DoD passes (`npm run
> typecheck` + `npm run test:run` + `expo export -p ios`; device render if a simulator exists), **commit +
> tag `v2-phase-5-complete`**, update the phase table + session log, and write the **Phase 6** brief +
> kickoff. Then stop.

