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
| 4 | Local store (Drizzle/expo-sqlite) + repositories | 1 | ⬜ **next** |
| 5 | Core screens + component library + export/backup | 2 | ⬜ |
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

## ▶ NEXT — Phase 4 distilled brief: local store + repositories

**Goal.** Stand up a local DB (**Drizzle + expo-sqlite**) as the single source of truth, behind a
**thin typed repository layer** so the UI never awaits a network call. The Phase-3 seed
(`loadSeed()`) loads into it on first launch. Port v1's build/photo CRUD + the deferred
container-resolve, and land the **forward-looking schema** (placements, care-marks, substrate/drainage
depths) now — before any screen reads it — so Phases 5–7 never touch the DB shape.

**Read only these:** `Rebuild docs/Terrarium_V2_Migration_Sequence.md` → "Phase 4 — Local store +
repositories"; `Terrarium_V2_Grill_Decisions.md` → decisions **9** (builds.py is pure CRUD → its 12
tests port here, not Phase 2), **10** (`substrate_depth?`/`drainage_depth?` persisted on the build;
guide is a static projection), **11** (only **three** persisted entities — builds, build-photos,
care-marks; `plant_photos` is **struck**), **17** (**UUID** build PKs + a `migrate vN→vN+1` ladder for
the Phase-5 backup round-trip). v1 source-of-record: `../terrarium-app/engine/builds.py`,
`engine/photos.py`, `engine/models/builds.py`, `tests/test_builds.py` (12 CRUD), `tests/conftest.py`
(isolated-DB fixture), and the **3 `resolve_*` cases in `tests/test_containers.py`** +
`engine/containers.py::resolve_build_container` (both **deferred from Phase 2 to here**).

**Work.**
1. **Drizzle schema — three tables only** (decision 11): `builds`, `build_photos`, `care_marks`
   (care-marks net-new, for Phase 7). **No `plant_photos`** (curator imagery is the static seed
   `image` path from Phase 3). `builds` uses a **UUID PK** (decision 17), keeps the **container
   snapshot** columns (`container_shape/dimensions/volume/opening`), and gains **`placements`**
   (plant + hardscape `{x, y, scale}` — match the Phase-3 `presetSchema` placement shape in
   `src/data/presets.ts` so a preset can instantiate into a build) plus **`substrateDepth?` /
   `drainageDepth?`** (decision 10). `care_marks` key off the build UUID; plant refs stay **slugs**.
2. **Migrate ladder scaffold** (decision 17): a `migrate vN→vN+1` chain, schemaVersion 1 = no-op,
   present *so Phase 5's backup/restore + v2.1 can migrate* (reused by import in Phase 5).
3. **Repository layer** — port `engine/builds.py` (CRUD) + `engine/photos.py` as repo functions.
   **Preserve the photo invariants exactly:** first photo **auto-becomes primary**; on delete the
   primary **reassigns to the earliest remaining**; the dashboard thumbnail is the **explicit
   `primaryPhotoId`**, not newest-by-date. Repositories **call the engine, never the reverse** —
   keep `src/logic` importing nothing from `src/db`/`src/data` (grep-verify, as in Phases 2–3).
4. **Wire the Phase-3 seed**: `loadSeed()` → idempotent first-launch load (upsert-by-slug, mirroring
   v1 `db/loader.py`) of the 67 plants / 16 containers / presets into the store.
5. **Port `resolve_build_container`** (deferred from Phase 2) + its **3 `resolve_*` tests** — now that
   the build + container snapshot exist, it mostly collapses into the pure container constructor.
6. Confirm **social is fully gone** (no `LOCAL_AUTHOR`, no `engine/social.py` analog).

**Gotchas.**
- **expo-sqlite is native — it will NOT load in the pure-node Vitest runner** (the Phase-2/3 config is
  `environment: 'node'`, no RN transform). Run the 12 repo unit tests against **`node:sqlite`** (the
  built-in DB Phase 3 already used — flag-free in Node 22) via a thin driver adapter, mirroring
  `conftest.py`'s isolated-DB fixture; the on-device path uses expo-sqlite. Reconcile the Drizzle
  driver (expo-sqlite on device vs. a node driver for tests) behind the repository interface.
- **UUID PKs, not autoincrement** (decision 17): care-marks reference builds and restore = replace
  (Phase 5), so a renumbering reinsert would dangle every care-mark.
- `placements` / `care_marks` / `substrateDepth` exist now though **no screen reads them until Phases
  6–7** — deliberate, so those phases never touch the schema.
- Keep the engine **pure** — it's the locked oracle; the repos are a new layer on top.

**Subagent plan.** Keep the **Drizzle schema + migrate ladder + seed-wiring** in the orchestrating
chat (cross-cutting). Delegate self-contained chunks: (1) the **builds repository + the 12
`test_builds.py` CRUD cases** against `node:sqlite`; (2) the **photos repository + its primary-photo
invariants**; (3) `resolve_build_container` + its **3 `resolve_*` tests** (small — can ride with the
builds chunk). Verify each subagent's output line-for-line against the v1 oracle (`../terrarium-app`).

**DoD (Phase 4 exit):** all **12** repository unit tests (translated from `test_builds.py`) green
against a temp DB (isolated-DB fixture, à la `conftest.py`); a build **round-trips save → reload with
placements intact**; the **3 `resolve_*`** container tests green; the photo invariants (first =
primary; delete reassigns to earliest) covered; first-launch **seed loads 67 / 16 + presets** into the
store; `npx tsc --noEmit` clean; **full Vitest suite still green (Phases 2–3 untouched)**.

**Verification:** `npm run typecheck` && `npm run test:run`.

### Kickoff prompt (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). You are doing
> **Phase 4 — Local store + repositories**. Read `MIGRATION.md` (the phase table + the "▶ NEXT —
> Phase 4" brief + the Phase-3 session-log entry) and ONLY these doc sections: Sequence "Phase 4 —
> Local store + repositories", Decisions 9 / 10 / 11 / 17. Do NOT read all four docs. v1
> source-of-record: `../terrarium-app/engine/{builds,photos}.py`, `engine/models/builds.py`,
> `tests/test_builds.py` (12 CRUD) + `tests/conftest.py`, and the 3 `resolve_*` cases in
> `tests/test_containers.py` + `engine/containers.py::resolve_build_container` (deferred from Phase 2).
> Phase 3 is committed + tagged `v2-phase-3-complete`; the validated seed (`loadSeed()` /
> `loadPlants()` / `loadContainers()` / `loadPresets()`) is live in `src/data` (67 plants / 16
> containers / 4 presets), the zod schemas + pure engine are in `src/{types,logic}`, and **112 tests
> are green** — do NOT break them. Build the Drizzle/expo-sqlite schema for the **three** persisted
> entities (builds w/ UUID PK + `placements` + `substrateDepth?`/`drainageDepth?`, build-photos,
> care-marks — **no plant_photos**), a `migrate vN→vN+1` ladder scaffold (decision 17), the thin
> repository layer (port `builds.py`/`photos.py`, preserve the primary-photo invariants), wire
> `loadSeed()` to seed on first launch, and port `resolve_build_container` + its 3 tests. **Run the 12
> repo tests against `node:sqlite`** (expo-sqlite won't load in the node Vitest runner). Keep the
> engine pure (repos call the engine, never the reverse; grep-verify `src/logic` imports nothing from
> `src/db`/`src/data`). Use subagents for the builds-repo + photos-repo chunks; keep the schema +
> migrate ladder + seed-wiring in the main chat. When the DoD passes: run verification, `git add -A &&
> git commit`, `git tag -a v2-phase-4-complete`, flip the phase table (4 → ✅ done), append a Phase-4
> session-log entry, then write the Phase 5 distilled brief + this same kickoff prompt. Then stop.

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
