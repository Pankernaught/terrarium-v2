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
| 3 | Ship the data (versioned JSON, images, presets) | 1 | ⬜ **next** |
| 4 | Local store (Drizzle/expo-sqlite) + repositories | 1 | ⬜ |
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

## ▶ NEXT — Phase 3 distilled brief: ship the data

**Goal.** Turn v1's **67 plants + 16 containers** into **versioned, typed JSON** that validates
against the Phase-2 `zod` schemas and seeds a local DB on first launch — folding in the data-model
changes (decisions 4 / 8 / 11 / 12 / 18). The **~67 plant images are the long pole and gate the
phase exit.**

**Read only these:** `Rebuild docs/Terrarium_V2_Migration_Sequence.md` → "Phase 3 — Ship the data";
`Terrarium_V2_Migration_Plan.md` → §2.2–2.5; `Terrarium_V2_Grill_Decisions.md` → decisions **11**
(drop `plant_photos`; one static `image` path/plant), **12** (substrate-vocab freeze +
reference-only root-depth range; property matrix deferred to v2.1), **18** (CC/PD photos,
accuracy-first, + 3–5 onboarding presets). v1 seed-of-record: `../terrarium-app/data/{plants,containers}.yaml`
+ `../terrarium-app/db/loader.py` (how v1 seeds).

**Work (in order — images gate the exit, so start them first):**
1. **`src/data/containers.json`** from `containers.yaml` (16 rows) — a serialize step; camelCase the
   keys, add `schemaVersion`. The shape already matches `containerSchema`. Validate all 16.
2. **`src/data/plants.json`** from `plants.yaml` (67 rows), camelCased, with these authored changes:
   - **`light`/`soilMoisture` → `{primary, secondary?}`** — pure widening; scalar → `{primary}`.
     **Author `secondary` only where botanically real** (NOT all 67); primary-only is intentional +
     documented (decision 4).
   - **`toxicity?: string`** top-level nullable free text — hand-authored for toxic/irritant species
     only; **blank ≠ safe**, never rendered as a safety claim (decision 8).
   - **Substrate hygiene (decision 12):** freeze the ~9-material component vocabulary (perlite, peat,
     sphagnum, sand, coco coir, grit, orchid bark, pumice, mud) as a canonical `{id,label}` list
     (new small module, e.g. `src/data/substrate-components.ts`); **split `wood`/`rock` out of
     `substrateTags` as hardscape.** Do **not** author the per-component property matrix (v2.1).
   - **Root depth → `rootDepthMinCm`/`rootDepthMaxCm`** range, authored for all, **reference-only** —
     NOT wired into depth math (that stays `maxHeightCm`-driven, preserving Phase-2 oracle parity).
   - **`image` path per plant** (decision 11) + **`imageCredit` + `imageLicense`** (seed-only, **never**
     in the backup/export payload). Source CC0/PD → CC-BY → CC-BY-SA (no `-NC`/`-ND`), Wikimedia
     primary, accuracy first (AI ruled out as default — a wrong species corrupts trust).
   - Optional: short free-text `nativeContext` sentence (Tier-3 view); keep `nativeBiome` scored.
3. **Bundle the ~67 plant images** as static assets, uniform card treatment (fixed aspect/crop).
   **This is the long pole** — owner is source of record (ASPCA et al. are references, not a gate).
4. **3–5 onboarding presets** (decision 18): curated starter builds (container + compatible plants +
   placements) as bundled seed. They **depend on the images**, so author last. Keep preset placements
   as plain `{slug, x, y, scale}` data (the build-schema `placements` field lands in Phase 4).
5. **Seed script** loads the JSON into a throwaway `expo-sqlite` DB; **validate every record against
   the Phase-2 zod schemas at build/CI time** so a malformed plant fails CI, not the device.

**Schema additions in `src/types/plant.ts`** (extend, don't break the 96 Phase-2 tests): `toxicity?`,
`rootDepthMinCm?`/`rootDepthMaxCm?`, `image` + `imageCredit?`/`imageLicense?`, `nativeContext?`.
Confirm the engine still imports nothing from `src/db`.

**Gotchas.**
- Root-depth range is **display-only** — never let it masquerade as a live depth driver (that would
  diverge from the oracle Phase 2 just locked; the depth seed stays `maxHeightCm`-based).
- `imageCredit`/`imageLicense` are **seed-only** — never in the backup/export payload.
- Toxicity blank surfaces as "no note authored," **never** "Non-toxic ✓."
- No `plant_photos` table (decision 11) and no substrate property matrix (decision 12) in v2.0.

**Subagent plan.** (1) One agent: `containers.yaml`→JSON serializer + a zod-validation seed test
(small, mechanical). (2) One agent: the `plants.yaml`→JSON transform with the field reshapes + a
zod-validation test over all 67. (3) Image sourcing + licensing is **curator/owner work**
(accuracy-first) — an agent can scaffold the `image`/credit/license fields + a "every plant has an
image + license" CI check, but the photo selection is a human pass (the true long pole). Keep preset
authoring in the orchestrating chat (depends on images + judgment).

**DoD (Phase 3 exit):** both JSON files validate against the zod schemas; a seed script loads them
into a throwaway `expo-sqlite` DB with row counts **67 / 16**; toxicity present only where
botanically real (blank = "no note," never "safe"); **every plant has an `image`** (+ credit/license
for any CC-BY[-SA] source); the **3–5 onboarding presets load through the seed**; `npx tsc --noEmit`
clean; full Vitest suite still green (Phase-2 tests untouched).

**Verification:** `npm run typecheck` && `npm run test:run` (+ the new seed/validation test).

### Kickoff prompt (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). You are doing
> **Phase 3 — Ship the data**. Read `MIGRATION.md` (the phase table + the "▶ NEXT — Phase 3" brief +
> the Phase-2 session-log entry) and ONLY these doc sections: Sequence "Phase 3 — Ship the data",
> Plan §2.2–2.5, Decisions 11 / 12 / 18. Do NOT read all four docs. v1 seed-of-record:
> `../terrarium-app/data/{plants,containers}.yaml` (67 plants / 16 containers) + `db/loader.py`.
> Phase 2 is committed + tagged `v2-phase-2-complete`; the engine + zod schemas are live in
> `src/{logic,types}` and **96 tests are green** — EXTEND the plant schema, don't break it. Emit
> versioned `src/data/{plants,containers}.json` with the decision-4/8/11/12/18 field changes, bundle
> the ~67 plant images (the long pole — accuracy-first, CC/PD, owner is source of record), author
> 3–5 onboarding presets, and add a zod-validated seed script. Use subagents for the mechanical
> serialize+validate chunks (containers, plants); keep image curation + preset authoring in the main
> chat. When the DoD passes: run verification, `git add -A && git commit`, `git tag -a
> v2-phase-3-complete`, flip the phase table (3 → ✅ done), append a Phase-3 session-log entry, then
> write the Phase 4 distilled brief + this same kickoff prompt. Then stop.

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
