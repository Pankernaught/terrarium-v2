**Terrarium V2 — Recommended Migration Sequence**

*A codebase-grounded expansion of section 6 of the V2 migration plan*

Prepared by Claude with full read access to the v1 source  ·  15 June 2026

*Amended by the V2 grill session (decisions 1–18, now complete) — see `Terrarium_V2_Grill_Decisions.md`. Where this doc and the grill conflict, the grill wins.*

# Overview

This document expands section 6 of the V2 migration plan into nine phases. Each phase lists its goal, the concrete work mapped to real v1 files, exit criteria you can check, and the risks or decisions that gate it. The spine follows the plan's own ordering — logic → data → store → screens → interactive → polish — because each layer becomes the trusted, tested foundation the next one builds on.

## What the code confirms

Everything the plan asserts checks out against the source: the scoring engine is pure standard library (no `numpy` / `pandas` / `scipy` anywhere), so the logic port is near-mechanical; the silent `except Exception: pass` that blanks a build's score sits at `pages/home.py:189`; all 67 plants already carry `ph_preference` (24 carry `native_biome`, 0 carry `special_notes`); and the "3-D" view is faux-3D — a rotatable `Mesh3d` of an empty container shell with no plant or hardscape models.

## Two reframings that drive the sequence

- **The engine is stdlib-pure and already test-covered** (~91 engine tests across compatibility, containers, builds, guide, care, environment, and models). Carry those tests over to Vitest — they are the **safety net** for the port; v1 is a faithful starting reference, not a permanent contract, so there is **no** separate parity harness (decisions 6 + 9). Phases 1–2 are the lowest-risk part of the project — spend the saved risk budget on the net-new interactive work in Phases 6–8.
- **The 3-D doesn't exist yet** — it is faux-3D, and decision 5 **defers the 3-D display to v2.1**. v2.0 ships the **2-D front view as the only preview**, so Phase 6 is a 2-D *build*, not a *port*; lock Option A (2-D drag, placements-as-data, no 3-D drag) before starting it.

## Phase map at a glance

| **Phase** | **Track** | **Goal** | **Key exit criterion** |
| --- | --- | --- | --- |
| 1 | Process | Lock decisions; freeze v1 as reference | Decisions written; v1 tagged; Expo skeleton boots |
| 2 | Foundation | Port the pure engine, test-first | ~79 engine tests green (builds CRUD → Phase 4); recommend() decoupled |
| 3 | Foundation | Ship data as versioned, typed JSON | JSON validates; seeds sqlite (67 / 16) |
| 4 | Foundation | Local store + repositories | Build round-trips with placements intact |
| 5 | Surfaces | Core screens + component library | Dashboard/detail render store data; export works |
| 6 | Surfaces | Planner: 5-step flow, 2-D drag, 2-D preview | End-to-end build; 60fps drag on every device (measured on the owner's iPhone) |
| 7 | Surfaces | Care tab + photo timeline | Schedule + local notification post-first-build |
| 8 | Surfaces · parallel | Substrate mixer | Mixer logic green; live derived stats |
| 9 | Process | Premium polish | §9 checklist passes; 60fps drag, 30fps JS-thread floor (design budget) |

# The nine phases

## Phase 1 — Lock decisions & freeze v1

**Goal:** turn the open questions into written constraints, and pin v1 as a faithful starting reference for the port — not a permanent contract (decisions 6 + 9).

**Work**

- Lock the decisions (all eighteen — see `Terrarium_V2_Grill_Decisions.md`). The ones that change downstream code shape: **interaction = Option A** (2-D drag, placements-as-data, **3-D display deferred to v2.1**), **store = `expo-sqlite` + Drizzle**, the **primary/secondary scoring rule** (min-adjacency across the condition cross-product; a secondary caps a pair at "caution"), and **manual JSON backup/restore** (decision 7). Already settled: **substrate mixer = fast-follow** and the **build guide = a static, read-only projection** in the planner's Final step + the `expo-print` export, with the four override inputs re-homed to the Substrate/Hardscape steps (decision 10).
- Freeze the Dash app at a tagged commit. It never ships, but it stays runnable as a reference if the port reveals an under-specified case. Note: there is **no** side-by-side parity harness (decision 9) — the carried-over tests, not a running v1, are the safety net.
- Stand up the Expo project skeleton in parallel (zero-risk, unblocks Phase 2): TypeScript; the folder shape the plan names (`logic/`, `types/`, `data/`, `db/`, `screens/`, `components/`); Vitest as the logic test runner; `zod`, Drizzle, Reanimated + Gesture Handler, `expo-notifications`, `expo-image-picker` / `expo-camera`, `expo-print`, `expo-sharing`, `expo-document-picker`, `expo-haptics`. (`expo-gl` + `react-three-fiber` are **not** v2.0 dependencies — they join in v2.1 with the 3-D display.)

**Exit criteria:** decisions written down; `git tag v1-oracle` pushed; `npx expo start` boots an empty app; `vitest` runs zero tests green.

**Risks / decisions:** this is the only phase where indecision is expensive — every later phase assumes Option A and the primary/secondary rule. Don't start Phase 2 with these open.

## Phase 2 — Port the pure engine, test-first

**Goal:** reproduce the entire scoring/derivation engine in TypeScript, proven identical by the ported test suite, with the one data-model change folded in.

**Work — translate the carried-over tests first, then make them pass**

- **Port the tests before the code.** The pure-logic suites are `test_compatibility.py` (36), `test_containers.py` (22), `test_guide.py` (7), `test_models.py` (7), `test_environment.py` (4), `test_care.py` (3) — ~79 engine tests. **`test_builds.py` (12) is 100% CRUD, not scoring — it ports in Phase 4 alongside `builds.py`** (decision 9's Step 2C correction: build "scoring" is just `check_group`, ported here; there is no separate build-scoring code). Skip `test_social.py` (9, social is scrapped). The `_make_plant` / `_make_container` fixtures translate to plain TS factory functions.
- **Port the constants verbatim — they *are* the rules.** From `engine/compatibility.py`: `_LIGHT_ORDER` (note `direct: 4`, the deliberate gap), `_MOISTURE_ORDER`, `_PH_ORDER`, the survival penalties (35), survival gaps (moisture 3, pH 2), `_PH_CAUTION_PENALTY: 7`, `_SURVIVAL_SCORE_CEILING: 40`, crowding thresholds (2.0 L, >2 / >4 plants), the 1.0 L gas-exchange threshold, and the verdict bands (>= 80 / >= 50). These become `constants.ts`.
- **Port the functions** straight across: `check_pair`, `check_group` (preserve the upper-triangle averaging, the container-penalty tiers, and the survival-clamp), `derive_envelope`, `generate_care_guide`, `generate_build_guide`, and the geometry math (`compute_volume_l`, `container_profile`, `recommend_container_dimensions`, `default_layer_depths`, `parse_dimensions_str`). All are pure.
- **Do the primary/secondary change here** (precise mechanics = decision 15), while inside every rule and every record. `light` and `soil_moisture` become `{primary, secondary?}`; **pH is untouched**. Rewrite the light/moisture **graduated** branches of `check_pair` to score the best-matching cross-product pair on the v1 ladder, with a **distance-0 match reached only via a secondary** deducting the one-step caution penalty (−15 light / −7 moisture) — capping at "caution," never "compatible." Crucially, the **survival/lethal tier stays on primaries only** (`predicate(a.primary, b.primary)` — light direct+shade, moisture dry+wet): a secondary never downgrades a lethal primary conflict (decision 15b). Ripple into `derive_envelope` (union primary ∪ secondary — **display sets only**; the recommender re-runs `check_pair`, it doesn't read the envelope) and surface "via secondary" in the result type; fix `recommend()`'s exact-equality light check too. Add **two** net-new case families the ported tests won't cover — the distance-0 secondary cap **and** the "a secondary does NOT rescue a lethal pairing" survival assertion.
- **Decouple the recommender.** `engine/recommend.py:13` calls `s.query(PlantModel).all()` itself; `resolve_build_container` hits the DB on the preset fallback. In TS, `recommend(selected, container, candidates)` takes the candidate list as an argument and `makeContainer(...)` is a pure constructor — no module reaches for a session.

**Exit criteria:** Vitest green on all ported cases; `recommend()` and the container builder import nothing from the store. (No parity harness — decision 9 drops it; the green ported tests are the proof the language switch didn't silently break anything.)

**Risks / decisions:** for the *initial* port, reproduce v1 exactly except the primary/secondary rule — but that faithfulness is a **starting point, not a permanent contract** (decision 9). Once green, the scoring is expected to be reworked in V2; update the carried-over tests as the logic changes. Keep `growth_rate` *unscored* in `check_pair` for the faithful port (it is intentionally a once-surfaced care note) — re-introducing it as a per-pair penalty is the easy mistake.

## Phase 3 — Ship the data

**Goal:** the 67 plants and 16 containers become versioned, typed JSON that seeds the local DB on first launch.

**Work**

- Emit `plants.json` + `containers.json` from the YAML. The shape is already range-tuple JSON (`humidity_pct_range: [70, 90]`) — a serialize step, not a cleaning project. Add a `schemaVersion`.
- Reshape `light` / `soil_moisture` into the `{primary, secondary?}` form the engine now expects (a pure widening; `secondary` absent by default). **Author secondary conditions only where botanically real** — not forced on all 67 — and treat primary-only as **intentional and documented**, not missing data (decision 4).
- **Promote toxicity to a top-level, nullable free-text field** (`toxicity?: string`) — *not* a typed enum and *not* nested in `special_notes` (decision 8). Net-new data entry (`special_notes` is populated on 0/67 today), **hand-authored where botanically real** for toxic/irritant species only — NOT all 67. It is display-only, and **blank ≠ safe**.
- **Substrate hygiene — freeze the vocabulary; defer the property matrix to v2.1** (decision 12). Do **not** author the per-component property dataset (aeration / water-retention / nutrient / buffering / particle-size) in v2.0 — it is co-located with the v2.1 mixer that is its only consumer. v2.0 does two things only: **freeze the component vocabulary** (the ~9 real materials — perlite, peat, sphagnum, sand, coco coir, grit, orchid bark, pumice, mud — as a canonical id + label list) and **split `wood` / `rock` out as hardscape, not substrate** (they only ever fed the guide's hardscape grep; decision 10 makes hardscape placement-driven). Today plants only carry `substrate_tags: list[str]`.
- **Author root depth as a reference-only range** (decision 12): replace v1's single nullable `root_depth_cm` float with a sortable `root_depth_min_cm` / `root_depth_max_cm` pair, authored for all plants — but **mark it reference-only**. It is *not* wired into the depth math (the substrate-depth seed stays `max_height_cm`-driven, so there is no divergence from the oracle); it is display data and a ready input for a future v2.1+ depth refinement. (v1's column is read by no logic and populated in 0 seed rows.)
- **Author the static plant `image` paths** (decision 11): v1's `plant_photos` table is dropped (see Phase 4), so each plant instead carries a single static `image` path in the seed — serving both the icon-first selector thumbnail and the profile hero — bundled as a static app asset. v1 ships zero plant images, so all ~67 are net-new here regardless; a distinct stylized `icon` and a multi-photo gallery are deferred. **Source = decision 18: CC / public-domain photographs (Wikimedia primary), accuracy first** (AI ruled out as the default — a wrong species corrupts trust), normalized with a uniform card treatment (fixed aspect, consistent crop). **License hygiene:** CC0/PD → CC-BY → CC-BY-SA only — **no `-NC`/`-ND`** — and store **`image_credit` + `image_license`** per plant (seed-only; never in the backup payload). The ~67 images are this pass's **long pole** and **gate the Phase 3 exit**.
- **Author 3–5 onboarding presets** (decision 18): curated starter builds (container + compatible plants + placements) as bundled seed — the "<60s to first value" path (Plan §4.9), demo/screenshot material, and end-to-end planner test fixtures. They **depend on the plant images**, so author them after the images; a larger library is v2.1.
- Keep `native_biome` as the scored categorical (24/67 populated); optionally backfill a short "native context" sentence for the Tier-3 plant view.
- Validate every record against the Phase-2 `zod` schemas at build time, so a malformed plant fails CI, not the device.

**Exit criteria:** both JSON files validate against the `zod` schemas; a seed script loads them into a throwaway `expo-sqlite` DB and row counts match (67 / 16); toxicity is present **where botanically real** (not on all 67), and blank is represented as "no note authored," never as "safe"; **every plant has an `image` (with `image_credit`/`image_license` for any CC-BY[-SA] source) and the 3–5 onboarding presets load through the seed** (decision 18).

**Risks / decisions:** toxicity is free text, so there is no vocabulary to freeze — the risk is the UI rendering a blank as a safety claim, which it must never do (decision 8). The owner is the source of record (ASPCA et al. are references, not a gate). The substrate-component **property** matrix is **not authored in v2.0 at all** (decision 12) — defer it to v2.1 with the mixer; v2.0 only freezes the component vocabulary. Root depth **is** authored, but **reference-only** — never let it masquerade as a live depth driver (the depth seed stays `max_height_cm`-based). Every plant also gets a static `image` path (decision 11).

## Phase 4 — Local store + repositories

**Goal:** a local DB as the single source of truth, behind a thin typed repository layer, so the UI never awaits a network call.

**Work**

- Mirror the **three** persisted entities from `engine/models/`: builds, build-photos, and a **care-marks** table (net-new, for Phase 7). v1's `plant_photos` table is **struck** (decision 11) — it had no write path, was never seeded, and was read exactly once (always "No photos yet"); curator plant imagery is a static seed `image` path, not a per-install DB table. Builds already carry a **container snapshot** (`container_shape/dimensions/volume/opening` on the `Build` model) — keep it; it is why `resolve_build_container` mostly collapses into the pure constructor. **Builds use a UUID primary key** (decision 17), not v1's integer autoincrement: care-marks reference builds, restore = replace (Phase 5), and a renumbering reinsert would dangle every care-mark — UUIDs are round-trip-safe and the natural key for the eventual sync backend. Care-marks key off the build UUID; plant refs stay slugs.
- **Add a `placements` field to the build** (plant + hardscape `{x, y, scale}`). Placements are build *data*, not render state, so a build survives restart and renders identically on the dashboard, in the planner's 2-D front view, and (once it ships in v2.1) in the 3-D preview. Putting this in the schema now — before any screen reads it — is why it is Phase 4, not Phase 6. **Also add `substrate_depth?` and `drainage_depth?`** to the build record (decision 10): the persisted Substrate-step overrides that the static build guide and the container diagram both read (single source of truth) — same rationale as placements for landing in the schema now.
- Port the CRUD from `engine/builds.py` and `engine/photos.py` as repository functions; **`builds.py` is pure CRUD, so its 12 `test_builds.py` cases port here, not in Phase 2** (decision 9's Step 2C correction). Preserve the photo invariants exactly: **first photo auto-becomes primary**, and on delete the primary **reassigns to the earliest remaining photo**. The dashboard thumbnail is the *explicit* `primary_photo_id`, not newest-by-date — keep that; if you adopt "newest," make it a one-time re-point so old builds don't change silently.
- Drop `engine/social.py` and `engine/models/social.py` entirely. This is also where the "fatal" `LOCAL_AUTHOR` surface disappears — it lived only in the social layer.

**Exit criteria:** all 12 repository unit tests (translated from `test_builds.py`) green against a temp `expo-sqlite` DB, mirroring the isolated-DB fixture in `conftest.py`; a build round-trips through save → reload with placements intact.

**Risks / decisions:** keep all engine functions pure — repositories call the engine, never the reverse. The care-marks and placements tables exist now even though no screen reads them until Phases 6–7; that is deliberate, so those phases never touch the schema.

## Phase 5 — Core screens on the trusted foundation

**Goal:** the read-mostly surfaces, built on the proven engine + store, establishing the component library before any hard interaction.

**Work**

- **Lock the component library first** (§7.2): stat strip, section label, glance header, verdict band (Eco-balance meter + one plain-English sentence), chip/pill, bottom sheet, reusable meter. Pin the 4 / 8 / 16 / 24 / 32 spacing scale. Every later screen pulls from these.
- **Dashboard (Terrariums).** Responsive centered grid (today's cards are left-aligned with dead whitespace). Card = hero photo + name + Eco-balance chip + a **single ⋮ overflow** (Duplicate, Export, Delete) + tap-to-open. This fixes the 7-button card in `components/build_card.py` (Open / Build Guide / Post to Forum / Duplicate / TXT / PDF / Delete); "Post to Forum" is gone with social.
- **Replace the mega-callback honestly.** `home.py`'s `handle_builds_and_actions` folds load + rename + delete + duplicate into one Output-owner; in RN these are just store calls. And **surface, don't swallow, the scoring failure**: the `except Exception: pass` at `pages/home.py:189` blanks the score to a grey "⚠". In V2 a `check_group` throw should render a real diagnostic, not a silent grey badge.
- **Build detail (read-only by default).** Glance header → verdict band → Tier-2 expanders (container facts, plant chips) → Tier-3 pairwise matrix behind a deliberate gesture. "Edit" re-opens the planner on this build. Replaces the 728-line tabbed `pages/build_detail.py`.
- **Browse + plant view.** Search + filter (type, biome, light, difficulty) — **toxicity is display-only, not a filter** (decision 8): a card indicator when non-empty (per never-color-alone) plus a Tier-3 line; **blank ≠ safe**, so never render absence as "Non-toxic ✓." The DB is curator-owned; a "Suggest a plant" affordance is **out-of-band** (mailto / owner-controlled web form) — no in-app community or backend (decision 3).
- **Export & backup.** Port `engine/export.py` — but `reportlab` does not exist in RN. The per-build TXT summary is a pure string function (port as-is); the PDF becomes an `expo-print` HTML-to-PDF template, then `expo-sharing`. Add **whole-app JSON backup/restore** (decision 7): "Back up to file" / "Restore from file" via `expo-sharing` + `expo-document-picker`, covering builds + placements + care-marks. **Photos are excluded** (binary; documented gap), and the importer must **degrade gracefully** on missing photo files (placeholder hero, never crash). **Versioning = decision 17:** the export is a `{ schemaVersion, appVersion, exportedAt, data }` envelope (schemaVersion 1, no-op migrate in v2.0 — present *so v2.1 can migrate v2.0 files*). Import = **migrate (reusing the on-device DB's own `migrate_vN→vN+1` ladder) → validate against current zod → insert in one transaction**; a **newer-than-current** file is **refused** with a clear message; restore = **replace** (wipe + load, with a confirm; merge deferred to v2.1); any validation failure rejects the **whole file** (never a half-import). UUID build IDs (Phase 4) keep care-marks intact across the round-trip.
- **Planner shell** only: the stepper scaffold + the persistent preview pane, no interactions yet.

**Exit criteria:** dashboard, build-detail, and Browse render real seeded data; per-build export produces a TXT + PDF; **whole-app backup round-trips** (export → wipe → restore → identical, with care-marks still bound to their builds, and a missing photo degrading to a placeholder, not a crash); a **newer-version** backup and a **corrupt** file are each rejected cleanly with no half-import; Browse shows toxicity as a display-only indicator (never as a "safe" claim); tap-to-open and ⋮ overflow work; a deliberately broken build shows a diagnostic, not a grey badge.

**Risks / decisions:** respect safe-area insets from the first screen — forgetting them is the instant "web-wrapper" tell. Build the component library *before* the screens, not alongside them.

## Phase 6 — The planner: flow + 2-D placement + 2-D front-view preview (Option A)

**Goal:** the centerpiece overhaul — expand the stepper and add the one genuinely new interaction, drag-to-place, in 2-D, shown in the **2-D front-view preview** (the 3-D display is a v2.1 fast-follow, decision 5).

This replaces the 1,068-line `pages/planner.py`, which today is a **2-step** Container → Plants wizard (reversible via `?start=plants`). V2's §7.6 is a **5-step** flow:

- **Container** — port the builder from `components/container_builder.py`: shape, dimensions, opening, live volume readout, plus the plants-first `recommend_container_dimensions` path. Geometry is already pure (Phase 2).
- **Substrate** — the mixer's *entry point*; the mixer engine is the v2.1 fast-follow (Phase 8). v2.0 ships this step as **drainage + substrate depth seeded from `default_layer_depths` / `max_height_cm`** — *not* `root_depth_cm`, which is reference-only (decision 12) — with the **substrate-depth and drainage-depth overrides kept and persisted** to the build (decision 10); drainage *material* defaults to "pebbles or LECA" (the v2.1 mixer owns material). The ratio UI slots in later.
- **Hardscape** — place/scale supplied assets in the **2-D front view**, clamped to the container (never larger than the vessel). Whether the build guide lists a hardscape step is **derived** from whether anything is placed here (decision 10), not a manual toggle.
- **Plants** — the overhauled icon-first selector with tiered compatibility cards, live recommendations from the decoupled `recommend()`, and **drag-to-place**. The Eco-balance meter updates live (deep-green → warning-red); show primary conflicts only, full matrix behind Tier-3.
- **Final** — 2-D front-view overview, Eco-balance, plant list, name & save → lands on Build detail. The **build guide renders here as a static, read-only projection** of the saved build (and in the `expo-print` export) — decision 10; v1's interactive `pages/build_guide.py` is deleted.

**The interaction, concretely (Option A):**

- **Drag runs in 2-D on the UI thread** with Reanimated + Gesture Handler. A placement is a deterministic `(x, y, scale)` on the front plane, clamped to the container — directly testable, trivially 60fps. Writes to the `placements` field from Phase 4.
- **The preview is the 2-D front view — the only preview in v2.0.** Plants and hardscape render as sprites at their `(x, y, scale)` placements on the front plane; no toggle, no 3-D. The faux-3-D math (`container_profile` + the `Mesh3d` box/cylinder builders `_add_box`, `_add_cylinder`, `_visualizer_figure_3d`) still ports as pure geometry in Phase 2, but it **renders nothing in v2.0** — it feeds the **v2.1** 3-D display (`react-three-fiber` via `expo-gl`), which will be display-only (no raycast, no orbit-vs-drag conflict; that conflict is what Option B's in-3-D *drag* forces, which is later still).

**Exit criteria:** create + edit a build end-to-end through all five steps; placements persist and re-render identically on the dashboard and the planner's 2-D front view; the drag holds **60fps on every device** — it runs transform/opacity-only on the UI thread, so low-end is no exception (decision 14); the *measured* gate is 60fps on the owner's iPhone (Android fps stays unverified — no device owned, emulator fps not trusted); Eco-balance updates live.

**Risks / decisions:** highest-risk phase, precisely because the interaction is net-new. v2.0 has **no 3-D at all** (decision 5) — keep placements as pure data so the v2.1 3-D display drops in as a clean add-on, and resist any in-3-D drag (that is Option B, later still). The faux-3-D shell math is reusable; the plant/hardscape models are not (they do not exist yet).

## Phase 7 — Care reminders + photo timeline

**Goal:** give reminders a home (the new Care tab) so the app earns repeat opens, and add the date-grouped photo timeline.

**Work**

- **Care scheduler (net-new engine).** `engine/care.py` emits *static tip text*, not a schedule. Add a `careSchedule.ts` whose intervals come from a **provisional, curator-tunable lookup table** (task type × coarse bucket → interval) — *not* a "smart" function implying false precision; the numbers exist nowhere in v1, so treat them like the scoring constants: provisional and easy to retune (decision 13). The buckets: trimming (when growth rates are mixed — reuse the existing detection), lid-opening (by opening type + volume), watering-**inspection** (by moisture profile — "look, don't pour," never a fixed timer). First occurrence is due **one interval after build creation** (don't nag on save). Reuse `generate_care_guide`'s text as the notification body.
- **Care tab** (§7.8): per-terrarium schedule, three task types, mark-done-per-task (writes the care-marks table from Phase 4), fully disable-able per terrarium.
- **`expo-notifications`**, local only. Ask permission **after the first build**, when the benefit is obvious — not on launch. **Scheduling = decision 16:** each (terrarium × enabled task) is **one native *repeating* trigger** (`TIME_INTERVAL { repeats:true }` / `WEEKLY`) = one permanent pending slot that fires without the app open — so pending = 3 × enabled terrariums. Respect iOS's **64-pending cap** with a **soonest-due ~50-slot budget guard** (prioritize nearest-due across all (terrarium, task); refill on app-open + on each fire; disclose overflow gracefully in the Care tab — never silently drop the 65th). Mark-done = cancel + reschedule one interval from the mark-done timestamp. Android has no cap (guard never trips). The per-terrarium **digest** model (1 slot/terrarium) is the **v2.1** escape hatch, not v2.0.
- **Photo timeline** on Build detail: date-grouped, `expo-image-picker` / `expo-camera` in, primary-photo invariants from Phase 4.

**Exit criteria:** a saved build generates a schedule; marking a task done persists and reschedules; a local notification fires; permission is requested post-first-build; scheduling uses repeating triggers and stays within the ~50-slot budget guard (a synthetic 25-terrarium account never exceeds 64 pending and surfaces the Care-tab overflow notice instead of silently dropping); photos add, group by date, and set/replace the thumbnail correctly.

**Risks / decisions:** watering is an *inspection* reminder, not a watering timer — the plan is emphatic, and the engine already encodes moisture as a profile, not a clock.

## Phase 8 — Substrate mixer (parallel to Phase 7)

**Goal:** the component-ratio mixer — a satisfying differentiator, but net-new data + engine + UI, so it runs as its own track.

**Work**

- `substrateMixer.ts`: roll a component ratio into derived stats — aeration, water retention, nutrient level, buffering. **The per-component property matrix is authored here, in v2.1** (decision 12 deferred it from Phase 3 — it is co-located with the mixer, its only consumer). A depth refinement can now draw on the `root_depth_min_cm` / `root_depth_max_cm` range authored back in Phase 3 (decision 12 left it reference-only for exactly this). Pure and unit-testable from day one.
- Wire its output into the planner's Substrate step (entry point built in Phase 6) and into the static build guide's substrate line (decision 10).

**Exit criteria:** mixer logic has its own green test module; the Substrate step shows live derived stats as ratios change; saved builds persist the mix.

**Risks / decisions:** the one phase I'd treat as explicitly optional for v2.0. It has no dependency on Phase 7, so it parallelizes cleanly — and if v2.0 slips, it is the cut that costs the least.

## Phase 9 — Premium polish

**Goal:** make the §9 non-negotiables acceptance criteria, not aspirations.

**Work:** empty + skeleton states everywhere; spring/ease-out transitions (~200–350ms, nothing snaps or lags past ~400ms); semantic haptics via `expo-haptics` (plant added, compatibility warning, step done — never decorative); every tappable >= 44x44pt / 48x48dp; respect reduce-motion and OS dynamic text; **colorblind mode and never-color-alone** (every red/green pairs with an icon or label — which also retires the v1 grey-"⚠"-as-only-signal pattern); a "start from a preset" onboarding path to first value in < 60s.

**Exit criteria:** §9 list passes as a checklist (measured on the owner's iPhone — Android fps is a design budget, not a gate, per decision 14); first-build-from-preset measured under 60s; no meaning encoded in color alone anywhere.

# Critical path, parallelism, and the one gate

- **Critical path:** Phases 1 → 2 → 3 → 4 → 5 → 6 → 9. That is the load-bearing line; everything hangs off the tested engine and the store.
- **Parallel track:** Phase 8 (mixer) runs alongside Phase 7. Within Phase 2, the engine port and the test translation interleave, but the tests lead. The **v2.1 fast-follows** — the substrate mixer and the **3-D display** (decision 5) — sit outside the v2.0 critical path entirely.
- **The one true gate:** lock **Option A** in Phase 1 — 2-D drag, placements-as-data, **3-D display deferred to v2.1**. It shapes the `placements` schema (Phase 4) and the entire interaction model (Phase 6). Decide it consciously, not by drift.

# Decisions the grill resolved — all of them

The grill session is **complete** — decisions 1–18 are locked; see `Terrarium_V2_Grill_Decisions.md`. The build-guide question closed as a static projection (decision 10); the device-acquisition logistics call **resolved — declined** (decision 14: 60fps drag everywhere via the UI-thread rule, Android fps an unverified design budget). Closing decision 14 reopened the queue with four further soft spots — the primary/secondary **scoring algorithm** (decision 15: best-pair min-adjacency, distance-0-via-secondary capped to caution, **survival on primaries only**), the **notification cap** (decision 16: per-task repeating triggers under a soonest-due ~50-slot budget guard), **backup versioning** (decision 17: versioned envelope + reused migration ladder + refuse-newer + replace + UUID build IDs), and the **content pipeline** (decision 18: CC/PD photos accuracy-first, license hygiene + attribution, 3–5 bundled presets) — and **all four are now resolved.** The queue is exhausted; the V2 plan is fully amended.

- **Substrate mixer → fast-follow, not v2.0** (confirmed). It is the only feature net-new across all three layers (data + engine + UI) and it has zero dependency on the rest of the app. Ship Phase 6's Substrate step as drainage + seeded depth, prove the loop end-to-end, then land the mixer as 2.1. It is the cheapest thing to cut if v2.0 slips, and cutting it costs nothing structurally. Decision 12 confirms the corollary: the per-component **property matrix is not authored in v2.0** either — it is co-located with the mixer in v2.1; v2.0 only freezes the component vocabulary and splits `wood` / `rock` out as hardscape.
- **Build guide → static projection (RESOLVED — decision 10).** The guide is a **static, read-only projection of saved build data**, rendered in the planner's Final step and the `expo-print` export; v1's interactive 298-line `pages/build_guide.py` is **deleted**. The four override inputs are re-homed, not carried onto the guide: `substrate_depth` + `drainage_depth` → the Substrate step (kept and **persisted**, Phase 4 schema); `drainage_material` dropped (defaults to "pebbles or LECA"; the v2.1 mixer owns it); `include_hardscape` **derived** from whether the Hardscape step placed anything. `generate_build_guide` is already pure and ported in Phase 2, so the engine was ready either way.
- **Identity/accounts → none.** Single-user local app; revisit only if cloud backup or multi-device sync appears — and then it is background sync, never in a core flow. This is also what keeps the scrapped `LOCAL_AUTHOR` issue dead.
- **Also locked by the grill (reflected throughout this doc):** desktop **cut** — iOS + Android only (decision 1); the **3-D display deferred to v2.1**, leaving the 2-D front view as v2.0's only preview (decision 5); toxicity as a **free-text, display-only** field authored where botanically real, no Browse filter (decision 8); **manual JSON backup/restore** (decision 7); curator-owned DB with **out-of-band** suggestions (decision 3); and the port treated as a **faithful starting reference**, with the carried-over tests — not a parity harness — as the safety net (decisions 6 + 9); the **build guide as a static projection** with its overrides re-homed (decision 10); v1's `plant_photos` table **dropped** for a single static seed `image` path per plant (decision 11); and the substrate **property matrix deferred to v2.1**, with the component vocabulary frozen, `wood` / `rock` split out as hardscape, and root depth authored as a reference-only range (decision 12).

Net change from the plan's §6: same nine-step spine, but with the file-level port map made explicit, the `placements` schema pulled forward into Phase 4 (so no later phase touches the DB shape), the silent score-failure turned into a real diagnostic, the parity harness dropped in favor of the carried-over tests, the substrate-mixer and build-guide questions both closed (the guide is a static projection — decision 10), v1's `plant_photos` table struck for a static seed `image` per plant (decision 11), and the substrate property matrix deferred to v2.1 with the vocabulary frozen (decision 12).
