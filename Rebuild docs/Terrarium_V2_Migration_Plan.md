# Terrarium V2 — React Native + Expo

*The migration plan: what we’re building. Codebase-verified against the v1 source.*

*Amended by the V2 grill session (decisions 1–18, now complete) — see `Terrarium_V2_Grill_Decisions.md`. Where this doc and the grill conflict, the grill wins.*

v2.0 is an evolvable **foundation, not a public release** — audience is terrarium hobbyists *and* beginners; platforms are **iOS + Android only** (desktop is cut entirely, so any “left-rail / desktop” language below is vestigial Dash-web thinking — ignore it). The v1 scoring engine is pure-Python standard library — no numpy, pandas, or scipy anywhere — so the logic port is mechanical and low-risk. v1 is a **faithful starting reference, not a permanent contract**: port it exactly, carry its ~91 engine pytest cases over to Vitest as the safety net, then refine the scoring freely (there is no separate parity harness). React Native + Expo is the framework. The signature interaction, drag-to-place, runs in **2-D — the only preview in v2.0**; the 3-D display is **deferred to v2.1** (Option A: 2-D drag, placements-as-data, no 3-D drag). Social is scrapped. Several data-model facts already hold in v1 (native_biome on every plant, categorical pH); the one rule-level divergence is splitting survival conditions into primary/secondary.

## 1.  The codebase, mapped for the port

Every Python module falls into one of three buckets.

### 1.1  Port verbatim (pure — the logic is the product)

| **Python module** | **What it is** | **TS target** |
| --- | --- | --- |
| engine/compatibility.py | check_pair / check_group; the ordered light/moisture/pH scales + penalty tiers live here as module constants — they ARE the rules. | logic/compatibility.ts + logic/constants.ts |
| engine/environment.py | derive_envelope — range-intersection. | logic/environment.ts |
| engine/care.py | Static care-tip text (watering / humidity / light / substrate / trimming). | logic/care.ts |
| engine/guide.py | Step-by-step setup guide generator. | logic/guide.ts |
| engine/containers.py (math) | compute_volume_l, container_profile, recommend_container_dimensions, default_layer_depths, parse_dimensions_str — stdlib math only. | logic/containers.ts |
| engine/models/* (Pydantic) | Plant / Container / result schemas + the controlled vocabularies. | types/*.ts (+ zod schemas) |

### 1.2  Refactor while porting (DB-coupled — pass data in)

- **engine/recommend.py** — currently calls s.query(PlantModel).all() itself (line 13). The TS recommend() takes the candidate list as an argument.
- **engine/containers.resolve_build_container** — falls back to a preset lookup via the DB. In V2 the build carries its own container snapshot, so this mostly collapses into a pure constructor.
- **engine/builds.py, engine/photos.py** — CRUD against SQLAlchemy. Rewrite against the local store.

### 1.3  Discard and rebuild in RN (Dash-only)

- **All of pages/* and components/*, and every @callback.** Plotly/Dash plumbing with zero portable value — the UI is a clean-sheet rebuild.
- **engine/social.py and engine/models/social.py.** Dropped entirely. This is also where the LOCAL_AUTHOR surface disappears — it lived only in the social layer.

## 2.  Data-model changes to make during the port

You touch every plant record and every scoring rule during the port — make these changes then, not later.

### 2.1  Primary / secondary survival conditions (the real change)

Today light and soil_moisture are single values. V2 gives each a primary (happiest) and an optional secondary (tolerable, adjacent) condition. This **ships live at launch** and is the **only rule-level divergence from v1** (decision 4).

- **Schema:** light: {primary, secondary?}, soil_moisture: {primary, secondary?}. Secondary conditions are **authored only where botanically real** — NOT forced on all 67 — and **primary-only is intentional and must be documented** as such (folded into the Step 3 authoring pass), not treated as missing data.
- **Scoring rule (keeps the existing −15 / −30 ladder; precise mechanics = decision 15):** compute the adjacency distance for the best-matching pair across {a.primary, a.secondary} × {b.primary, b.secondary} and score it on the v1 ladder. A best pair at **distance 0 reached only via a secondary** does not score a free 100 — it deducts the one-step caution penalty (−15 light / −7 moisture), capping at “caution,” never “compatible”; a secondary rescues a pairing, it doesn’t bless it. The **survival/lethal tier (light direct+shade; moisture dry+wet) is judged on primaries only** — a secondary rescues within the graduated tier but never downgrades a lethal primary conflict (decision 15b). pH is unchanged (no secondary).
- **Ripple:** derive_envelope unions primary ∪ secondary per plant; recommend and the compatibility cards surface “via secondary” so the trade-off is visible.

### 2.2  Toxicity note (free-text)

Promote toxicity to a **top-level, nullable free-text field** — *toxicity?: string* — *not* nested in special_notes and *not* a typed enum. **Hand-authored by the curator for toxic/irritant species only** — NOT forced on all 67; blank/absent is the expected default. It is **display-only**: an icon + label indicator on the plant card when non-empty (per never-color-alone), plus a line in the Tier-3 plant view. Free text can’t be faceted, so the structured **Browse toxicity *filter* is deferred** (decision 8). Critically, **blank ≠ safe** — a null/empty value means “no note authored,” and the UI must **never** render it as a safety claim (“Non-toxic ✓”). The owner is the source of record; ASPCA et al. are research references, not a gate. *(Supersedes the earlier typed-enum + Browse-filter plan.)*

### 2.3  Native environment + native context

Keep native_biome as the scored/filterable categorical. Author a short free-text “native context” sentence per plant for the Tier-3 plant view — net-new content across all 67 plants, written alongside the toxicity pass.

### 2.4  Substrate components (vocabulary hygiene now; property matrix deferred to v2.1)

Today substrate is only substrate_tags: list[str] (e.g. peat, perlite, coco coir). The rich per-component property matrix (aeration, water retention, nutrient level, buffering, particle size) is **deferred to v2.1**, co-located with the mixer that is its only consumer — authoring it now, against an unbuilt consumer, is premature (decision 12). v2.0 keeps two pieces of hygiene only: **freeze the component vocabulary** — the ~9 real materials (perlite, peat, sphagnum, sand, coco coir, grit, orchid bark, pumice, mud) become a canonical list (stable id + label) — and **split wood/rock out as hardscape, not substrate** (they only ever fed the build guide’s hardscape grep; decision 10 makes hardscape placement-driven). v2.0’s depth path consumes only max_height_cm + soil_moisture + container volume_l, so it never needs the property matrix.

**Root depth** is reshaped from v1’s single nullable root_depth_cm float to a sortable root_depth_min_cm / root_depth_max_cm range — authored for all plants in the Step 3 pass, but **marked reference-only** (decision 12): it is *not* wired into the depth math (that stays max_height_cm-driven, preserving parity with the v1 oracle); it is display data and a ready input for a future v2.1+ depth refinement.

### 2.5  Care schedule (net-new)

care.py emits static tip text, not a schedule. Add a scheduler that derives cadences from the build: trimming (when growth rates are mixed), lid-opening (by opening type + volume), and watering-inspection (by moisture profile — never a fixed watering timer). It feeds expo-notifications; reuse care.py’s text as the reminder body.

## 3.  The interaction model (Option A) — 2-D in v2.0, 3-D in v2.1

The “wow” is interaction, not display. v1’s “3D” is faux-3D — a rotatable Plotly Mesh3d of the empty container shell (Dash-only, discarded) — so a 3-D *render* is net-new and buys nothing for free. Decision 5 therefore **defers the 3-D display to v2.1** and ships the **2-D front view as the only preview in v2.0**:

- **2-D placement, placements-as-data (the v2.0 gate).** Plants and hardscape are dragged in the 2-D front view, where a position is a simple (x, y, scale) on a plane, clamped to the container; the placements are persisted as build data (see §5.6). Deterministic, testable, trivially 60fps with Reanimated + Gesture Handler. The 2-D front view is the *only* preview surface in v2.0 — there is **no 2-D⇄3-D toggle**.
- **3-D display is a v2.1 fast-follow.** Only the **geometry math** (container_profile, the box/cylinder builders) ports for free; nothing *renders*. When 3-D lands in v2.1 it is **display-only**, reflecting the same placements data — react-three-fiber (via expo-gl) joins the stack then, not in v2.0.
- **Full 3-D drag is later still.** Placing/dragging inside the 3-D scene (raycast-to-surface, occlusion, orbit-vs-drag gesture conflicts) is a multi-week research feature; neither v2.0 nor the v2.1 display is gated on it.
- **Framework fit.** Reanimated + Gesture Handler make 2-D physics-drag trivial; Expo’s notifications / camera / filesystem / haptics are first-class.

## 4.  Migration sequence

The full, phase-by-phase expansion lives in the companion Migration Sequence document. In brief:

1. **Lock decisions.** Freeze the v1 Dash app at a tagged commit — it never ships, but stays runnable as a faithful reference (there is **no** side-by-side parity harness; see §6).
2. **Port the pure engine, test-first.** Translate the ~91 engine pytest tests to the TS runner (Vitest), then port compatibility / environment / care / guide / containers-math until green. Do the primary/secondary data-model change here. Decouple recommend() to take plants as an argument.
3. **Ship the data.** Emit versioned plants.json + containers.json from the YAML; seed expo-sqlite on first launch. Author toxicity, native-context sentences, the static plant `image` paths (decision 11), and the root-depth ranges here. The substrate-component **property matrix is *not* authored in v2.0** — it is deferred to v2.1 with the mixer (decision 12).
4. **Local store + repositories.** Builds, build-photos, care-marks, placements — three persisted entities plus placements; v1’s `plant_photos` table is dropped (decision 11). The local DB is the single source of truth; the UI never waits on a network call.
5. **Core screens.** Dashboard (tap-to-open + ⋮ overflow), Build detail (read-only + Edit), Browse, the planner shell, per-build export (TXT as a pure string; PDF via expo-print), and **whole-app JSON backup/restore** (expo-sharing + expo-document-picker).
6. The planner flow + 2-D placement + the 2-D front-view preview (Option A; the 3-D display is deferred to v2.1).
7. **Care reminders** (expo-notifications, permission asked after the first build) + the photo timeline.
8. **v2.1 fast-follows.** The **substrate mixer** runs as its own parallel track (the v2.0 Substrate step ships as drainage + seeded depth); the **3-D display** lands here too — v2.0’s only preview is the 2-D front view.
9. **Premium polish.** Empty + skeleton states, semantic haptics, reduce-motion, colorblind mode + never-color-alone, and a “start from a preset” onboarding to first value < 60s.

## 5.  Recommended app flow

This honors the three principles — tiered information, premium space + motion, and reused (not rebuilt) components — and adds a Care tab so reminders have a home and the app earns repeat opens.

### 5.1  Global navigation

- Bottom tab bar (iOS + Android), human-drawn icons. Four destinations: Terrariums (dashboard) · Browse (plant DB) · Care (schedule & reminders) · Settings. Desktop is cut — there is no left rail.
- The tab bar sits above the home indicator / gesture bar; content respects the notch and safe-area insets. (Forgetting safe-area insets is the instant “web-wrapper” tell.)

### 5.2  Lock the component library before screens

Define these once; every screen pulls from them — this is the mechanism behind page continuity:

- Stat strip (label-over-value grid) · section label · glance header (name + one signal chip) · verdict band (Eco-balance meter + one plain-English sentence) · chip/pill (removable plant tags) · bottom sheet (plant inspection) · reusable meter (Eco-balance, humidity, light, pH).
- Spacing scale 4 / 8 / 16 / 24 / 32 — never an off-scale value. Inconsistent spacing is the #1 thing that reads as “bootstrap.”

### 5.3  Make the tier system physical

| **Tier** | **Reveal gesture** | **Build example** | **Plant example** |
| --- | --- | --- | --- |
| 1 — At a glance | None (always visible) | Name + “Mostly healthy” verdict sentence | Common name + plant type |
| 2 — Surface | One gesture (tap / expand) | Shape, dimensions, volume, opening; care summary | Humidity / light / temp / size (stat strip + meters) |
| 3 — Nitty-gritty | Deliberate navigation | Full pairwise compatibility matrix | pH, root depth, native context, toxicity note (display-only) |

The rule that keeps it from collapsing into a wall of text: Tier 2 and Tier 3 must be separated by a real gesture. If they share one scroll, users read everything as Tier 1.

### 5.4  Dashboard (Terrariums)

- Responsive grid that scales and centers (today’s cards are left-aligned with dead whitespace).
- Card = hero photo + name + Eco-balance chip (Tier-1: is it healthy, in plain English) + a single ⋮ overflow (Duplicate, Export TXT/PDF, Delete). Tap the card to open — this kills the 7-button overload of v1’s build_card.py. “Post to Forum” is gone with social.
- Empty state: “Nothing here yet — create your first build.” A + / FAB starts the planner.

### 5.5  Build detail (read-only by default)

- Opens clean, static, read-only. Glance header (name + verdict chip) → verdict band (Eco-balance meter + one sentence) → Tier-2 expanders for container facts and the plant list (icon chips; tapping one opens the plant bottom sheet).
- Photo timeline, date-grouped; the newest photo is the dashboard thumbnail.
- Full pairwise matrix lives behind a Tier-3 expander. A per-terrarium Care toggle sits here.
- “Edit” re-opens the planner on this build. (Replaces the 728-line tabbed v1 build_detail.py.)

### 5.6  The planner (the overhaul)

A persistent split: the build preview is docked / peekable, showing the **2-D front view — the only preview in v2.0** (no 2-D⇄3-D toggle; the 3-D display is a v2.1 fast-follow). The stepper mirrors how someone actually builds a terrarium:

1. **Container** — shape (incl. fishbowl & other vessels), dimensions, opening; minimal, non-intrusive presets; live volume readout.
2. **Substrate** — drainage layer + substrate depth, seeded from each plant’s max_height_cm (**not** root depth — decision 12). The substrate-depth and drainage-depth overrides survive in this step and are **persisted** to the build record (decision 10); drainage *material* defaults to “pebbles or LECA” (the v2.1 mixer owns material choice). The full component-ratio mixer is the v2.1 fast-follow; the ratio UI slots into this step then.
3. **Hardscape** — place and scale supplied assets in the 2D front view, clamped to the container (never larger than the vessel).
4. **Plants** — the overhauled icon-first selector with tiered compatibility cards and drag-to-place. Smart recommendations: replacements when an incompatible plant is chosen, size/height warnings, substrate-depth advice from max_height_cm (root depth is reference-only — decision 12). The Eco-balance meter updates live (deep-green → warning-red); show primary conflicts only, with the full matrix as a Tier-3 expand.
5. **Final build** — overview: 2-D front view, Eco-balance, all plants, name & save. Lands on Build detail. The assembly **build guide is a static, read-only projection of the saved build data**, rendered here in Final and in the `expo-print` export (decision 10) — not an interactive page.

| **Persist placements — and the substrate/drainage overrides — in the data model.**<br>Plant and hardscape positions (x, y + scale) belong to the build’s data, not the rendering layer — so a build survives restarts and renders identically on the dashboard, in the planner’s 2-D front view, and (once it ships in v2.1) in the 3-D preview. The persisted substrate_depth and drainage_depth overrides (decision 10) ride along the same way, so the static build guide and the container diagram read one source of truth. |
| --- |

### 5.7  Browse (plant database)

- Search + filter (type, biome, light, difficulty). **Toxicity is display-only, not a filter** in v2.0 — free text can’t be faceted (decision 8); it surfaces as a card indicator and in the Tier-3 view. A plant opens its profile: Tier-1 name/type → Tier-2 humidity/light/temp/size as a stat strip with visual meters → Tier-3 pH / root depth / native context / toxicity note.
- Render humidity / light / pH as meters and glow/dim icons — “recognizable visuals, not reading.”
- The plant DB is **curator-owned**, edited by re-authoring the seed. A “Suggest a plant” affordance is **out-of-band** (mailto / an owner-controlled web form) — no in-app community, backend, or moderation queue (decision 3).

### 5.8  Care (the retention engine)

- A per-terrarium schedule with three task types: trimming (**build-level** — one task per terrarium, nudged on mixed growth; one care-mark stream per build, per decision 13), watering-inspection (look, don’t pour — with what to look for), and lid-opening (airflow cadence). Mark-done per task.
- Fully disable-able per terrarium; notifications are local (expo-notifications) and the permission prompt comes after the first build, when the benefit is obvious.

## 6.  Decisions (locked for v2.0)

The grill session (decisions 1–18 in `Terrarium_V2_Grill_Decisions.md`) is the system of record; this table reflects it.

| **Decision** | **Resolution** |
| --- | --- |
| Scope & platforms | v2.0 is an evolvable **foundation, not a public release**; audience is hobbyists + beginners. **iOS + Android only — desktop is cut.** (decision 1) |
| Interaction model | Option A — **2-D drag-placement, placements-as-data, no 3-D drag.** v2.0’s only preview is the **2-D front view**; the **3-D display is deferred to v2.1** (no 2-D⇄3-D toggle). (decision 5) |
| Port fidelity / parity | v1 is a **faithful starting reference, not a permanent contract**: port exactly, then refine the scoring freely. Safety net = the ~91 v1 engine tests carried over to Vitest (updated as the logic changes). **No dedicated parity harness** — no build corpus, golden master, side-by-side run, or Python-in-CI. (decisions 6 + 9) |
| Local store | expo-sqlite + a light typed query layer (Drizzle). Closest to v1’s SQLite/SQLAlchemy; data is tiny (67 plants, 16 containers). No WatermelonDB/Realm until sync is real. |
| Primary/secondary scoring | Min-adjacency across the condition cross-product; a match that relies on a secondary caps the pair at “caution.” Ships live; secondary authored **where botanically real** (not all 67); primary-only is intentional and documented. The only rule-level divergence from v1. (decision 4) |
| Toxicity | A nullable **top-level free-text field** (*toxicity?: string*), hand-authored **where botanically real** (not all 67). **Display-only** (card indicator + Tier-3 line, per never-color-alone); the **Browse filter is deferred** (free text can’t be faceted). **Blank ≠ safe** — never render absence as a safety claim. (decision 8) |
| Native context | Author a per-plant free-text sentence for the Tier-3 view (alongside the toxicity pass). |
| Plant imagery | v1’s `plant_photos` table is **dropped** (no write path, never seeded, read once — always “No photos yet”). Replaced by a single static `image` path on the plant record in the seed, serving both the selector thumbnail and the profile hero, bundled as a static asset. **Source = CC / public-domain photographs** (accuracy first; AI ruled out as default), normalized with a consistent card treatment; **license hygiene** (CC0/PD → CC-BY → CC-BY-SA, no `-NC`/`-ND`) with per-plant **`image_credit`/`image_license`** seed fields; the ~67 images gate Phase 3 exit (decision 18). A distinct stylized `icon` and a multi-photo gallery are deferred. (decisions 11 + 18) |
| Substrate mixer | v2.1 fast-follow. v2.0 ships the Substrate step as drainage + max_height_cm-seeded depth, with persisted depth/drainage overrides (decision 10). The component **property matrix is deferred to v2.1** — v2.0 only freezes the component vocabulary and splits wood/rock out as hardscape (decision 12). |
| Data durability / backup | Manual **JSON backup/restore** (“Back up to file” / “Restore from file”) via expo-sharing + expo-document-picker, covering builds + placements + care-marks. A **versioned envelope** (`schemaVersion` + reused migration ladder → validate → one transaction; **refuse newer-than-current**; **restore = replace**, merge deferred to v2.1) and **UUID build IDs** keep restores durable across updates (decision 17). **Photos excluded** (documented gap); the importer **degrades gracefully** on missing photos (placeholder hero, never crash). Not cloud, not accounts. (decisions 7 + 17) |
| Plant-DB governance | **Curator-owned**, edited by re-authoring the seed. Suggestions are **out-of-band** (mailto / owner-controlled web form) — no in-app community, backend, or moderation. engine/social.py stays scrapped. (decision 3) |
| Build guide | **Static, read-only projection** of saved build data, rendered in the planner’s Final step and the `expo-print` export; v1’s interactive `pages/build_guide.py` is deleted. The four override inputs are re-homed: substrate_depth + drainage_depth → the Substrate step (kept and **persisted**); drainage_material dropped (defaults to “pebbles or LECA”; the v2.1 mixer owns it); include_hardscape **derived** from whether the Hardscape step placed anything. (decision 10) |
| Care as a 4th nav tab | Yes — gives reminders a home and drives repeat opens. |
| Identity / accounts | None. Single-user local app; revisit only if cloud backup or multi-device sync appears — then it’s background sync, never in a core flow. |

## 7.  Premium-feel non-negotiables

Pin these as acceptance criteria — “premium” is mostly motion and response, not just looks:

- Spring / ease-out transitions, ~200–350ms; nothing snaps, nothing lags past ~400ms.
- Every tappable element ≥ 44×44pt (iOS) / 48×48dp (Android) — add invisible padding to small icons.
- Subtle, semantic haptics: plant added, compatibility warning, build-step done. Never decorative.
- 60fps drag on **every** device (decision 14). The signature interaction runs transform/opacity-only on the UI thread (Reanimated), never blocks on JS/layout, so it must not drop below 60fps even on low-end. The *measured* gate is 60fps on the owner's iPhone (≥ iPhone X / A11); 30fps is the floor for JS-thread work (transitions, scroll, recompute) on a low-end Redmi-10-class reference — a design budget, not a measured gate (no device owned, emulator fps not trusted).
- Respect safe areas, OS dynamic text sizing, and reduce-motion. Never encode meaning in color alone — pair every red/green with an icon or label.

The detailed token system and per-screen application live in the companion Premium Design document.
