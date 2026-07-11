# Terrarium Migration — Pass 1: Conceptual Outline

**Status:** skeleton (Pass 1, complete). This is the top of a planning ladder. Live ladder state, per-phase progress, and the next-chat kickoff live in the single `deliverables/migration/HANDOFF-*.md` file (renamed each wrap for what comes next) — read that first.
**Source of intent:** `deliverables/Terrarium master plan.docx` (cited below as §1–§15, App. A–D).
**Source of reality:** the codebase on branch `verdict-overhaul`, verified by six read-only sweeps (src/logic, src/data, src/db, src/components + src/app, docs/adr, platform/tests/tools) on 2026-07-10.
**Scope of this file:** phase skeleton with stable IDs (M0…), ordering rationale, a master-plan cross-check, and open questions. No code, no app changes. Where doc and code disagree, the disagreement is recorded in [Open Questions](#open-questions), never silently resolved.

**How later passes use this:** Pass 2 expands exactly one phase into a file-level implementation plan (one session per phase). Each phase section below is written to be expandable without rereading the others. Then implementation, phase by phase.

---

## Orientation

The migration is one idea executed in a fixed order (§1, §5): **keep the reasoning brain, rebuild the body, defer the platform nervous system.** The sequence is forced by four plan tenets:

- **Safety first** — protected baseline + golden fixtures before any deletion (§0/§9, App. C).
- **Extraction-first** — move the tested engines into new boundaries with zero behavior change before the schema churns (§9, risk table).
- **Bridge-first** — new tables beside old; migrate; cut over once; delete last (§9).
- **Riskiest external unknown as early as the dependency graph allows** — the iNaturalist adapter and the normalized data model carry the most design risk, so they land as soon as their prerequisites exist, not later (§10, §12).

Active migration phases are **M0–M10**. The platform layer (§5 layer E, §10 phases 4–6) is **Deferred as M11–M13** and is explicitly out of the core migration's scope.

---

## Phases

### M0 · Preserve & characterize
- **Goal:** Make the current app fully reproducible and losslessly recoverable before anything is moved or deleted, and record the founding decisions the rebuild will be checked against. This is the reversibility guarantee for everything downstream (§3, §9 "First-PR boundary", §15 items 1–3, App. B, App. C Phase 0).
- **Scope — in:** tag a protected baseline; **snapshot the dirty worktree first** (see Open Q B4 — uncommitted vibe/canopy work, modified `plants.json`, untracked `docs/design-system.md`, and a Facebook scrape under `assets/plants/` are all at risk); capture a representative DB + backup + media set (multiple builds, photos, care history, placements, custom substrate, overrides); promote engine outputs to golden fixtures (container recommendations, compatibility reports, care schedules, substrate mix, build guide, exports); record the 201 names / scientific names / source links / attribution as a migration corpus; write the founding decision records (App. B). Run an **iNaturalist adapter spike** (throwaway) here to inform M3's design — the plan lists it early (§15 item 6) precisely to de-risk before commitment.
- **Scope — out:** any deletion, any new UI, any algorithm change, any owner-only call from §14 not yet needed.
- **Subsystems touched:** git baseline; `src/logic` (fixture capture only); `src/db/backup.ts` (sample export); `docs/adr` (new founding decision records); `deliverables/`.
- **Depends on:** nothing.
- **Exit criterion:** current app builds and runs from the tagged baseline; a representative DB + backup + media set is archived; golden fixtures for every retained engine pass; founding decision records (App. B) are written and owner-approved; no user work lost.
- **Size:** M.
- **Placement rationale:** first because every later phase is destructive or irreversible, and because in-flight uncommitted work is already colliding with a RETIRE decision (Open Q B4).

### M1 · Extract engines behind stable contracts
- **Goal:** Relocate the 21 pure logic modules into their new domain boundaries with **zero behavior change**, and introduce rule-set version metadata so results become explainable later (§4.1, §4.2, §6.2, App. A `src/logic`, §15 item 5).
- **Scope — in:** move the modules verified import-isolated (they import nothing from `src/components`, `src/app`, `src/db`, React, or even `src/data` — plant/container records arrive as parameters, `score-build.ts:7-10`); keep the existing suite green as the characterization net; scaffold rule-set version stamping on compatibility/care/verdict outputs (the *value* field, not yet the sourced trait provenance). **Defer the slug→profileId reforge to M4** — see Open Q A1; it is not a one-line loader swap and cannot happen before the overlay exists.
- **Scope — out:** the plant-key change; new algorithms; substrate material-catalog split (M4); care occurrence-model change (M6).
- **Subsystems touched:** `src/logic/*` (all 21 modules), `src/logic/__tests__`.
- **Depends on:** M0 (golden fixtures are the safety net for "zero behavior change").
- **Exit criterion:** engines live in their new package boundary; the full existing logic suite plus M0 golden fixtures pass unchanged; rule-set version metadata is emitted on engine results.
- **Size:** M.
- **Placement rationale:** extraction-first tenet (§9) — carry the brain forward intact and independently verifiable before the schema work destabilizes anything. Low risk, high leverage, so it precedes the data-model churn.

### M2 · Foundation — normalized schema + ordered migration harness
- **Goal:** Stand up the normalized local data model beside the legacy tables and install a *real* ordered, transactional, rollback-tested SQLite migration mechanism — replacing today's create-if-not-exists + presence-guarded `ALTER`s — plus repository/use-case interfaces and the outbox seam (§5, §5.1, §6, §9, §15 item 4, App. A `src/db`).
- **Scope — in:** ordered migrations with a real version axis (today there is **no `PRAGMA user_version`**; schema state is inferred from live column presence via `ensureSubstrateMixColumn`/`ensureCharcoalDepthColumn`/`ensureCareOverridesColumn` in `schema.ts:223-268` — see Open Q A2); normalized tables beside the old three (terrariums, designs/revisions, enclosures, layers/materials, residents, tasks/occurrences, interventions, events, measurements, media assets, provider snapshots, outbox); repository/use-case interfaces with a sync-neutral local implementation; new route groups/feature boundaries **without recreating old screens**; **animal-ready-without-scope** design applied here (§6.3 — neutral organism/resident kinds, typed trait namespaces, welfare-policy hooks, animal kinds disabled); fix the SDK 56 lint/compiler baseline and make lint + type-check + unit + migration tests **required checks** (§11).
- **Scope — out:** importing legacy *data* into the new tables (harness + empty tables only here; the dogfood import is M9); the organism profile/overlay content (M4); any new screen composition (M6/M7).
- **Subsystems touched:** `src/db` (new `schema`, `migrate` — note `migrate.ts` today is the backup-*payload* ladder, not schema migrations, Open Q A2), repositories, `src/app` (route-group scaffolding), CI config (`eslint.config.js`, test scripts).
- **Depends on:** M1 (engines in their boundary so repository contracts can target them).
- **Exit criterion:** offline CRUD against the new tables works; migration tests prove ordering, idempotency, referential integrity, and rollback/recovery; new tables coexist with the legacy three; zero-error lint + type-check on the new surface; required-checks gate is live.
- **Size:** L.
- **Placement rationale:** the data-model spine every later phase hangs off, and a sequential gate the plan calls out (§10). Highest-leverage *design* risk, so it is planned carefully and early — but after M1, because you cannot safely refactor engine boundaries and rewrite the schema simultaneously.

### M3 · Identity & media layer — iNaturalist adapter + cache
- **Goal:** Build the typed iNaturalist adapter plus an on-device cache: the whole external-identity surface, behind an interface a backend proxy can later front without changing callers (§4.4, §5 layer A, §7, §15 item 6).
- **Scope — in:** exact response schemas for `taxa/autocomplete`, `taxa/{id}`, `observations`, `computervision/score_image`, `places`; field selection, retries with jittered backoff, rate budget (~1 rps, <~10k/day, 429 as recoverable), user-agent, metrics; on-device cache with the §7 TTLs and negative-caching; circuit-breaker + offline-profile fallback; **media license + attribution capture** on every photo (the licensing landmine, §7) — store license/attribution, filter permitted licenses per use. Bundle a snapshot + one hero photo per vetted species so the app still opens offline (§5).
- **Scope — out:** the editorial profile/overlay model and reconciliation (M4); the CV *benchmark* and organism UI (M5); iNaturalist OAuth / user contribution (Deferred, M11).
- **Subsystems touched:** new adapter package; `src/db` provider-snapshot cache tables (from M2); media metadata storage.
- **Depends on:** M2 (provider-snapshot tables, repository seam). Design informed by the M0 spike.
- **Exit criterion:** API contract tests (recorded/redacted fixtures + strict-budget live smoke) pass; provider-outage and offline-fallback behavior demonstrated; cache TTLs and license/attribution capture enforced; measured traffic stays inside external limits.
- **Size:** L.
- **Placement rationale:** the biggest *external* unknown (rate limits, CC BY-NC licensing, CV accuracy). Placed as early as the dependency graph allows — it needs only M2's cache tables, not the overlay — so its unknowns resolve before the product shell commits to them.

### M4 · Organism model + 201-record reconciliation
- **Goal:** Build the taxon/profile/cultivar/alias model with sourced trait assertions, reconcile the 201 legacy records into draft editorial profiles against external taxa, and perform the **plant-record three-way split** that re-anchors the curated overlay away from the legacy catalog (§2, §6, §6.1, §6.2, §7 boundary, §15 item 7).
- **Scope — in:** `OrganismProfile` + `ExternalTaxonRef` + `Cultivar/Alias` + `TraitAssertion` model (external ids are references, never keys, §6); the §6.1 split into **curated overlay** (bundled, authoritative for care), **identity snapshot** (sourced, cached), **outcome log** (owned); reconciliation tool producing matched / ambiguous / cultivar / duplicate / unmatched reports over the 201; import the 201 as **draft** profiles + trait assertions retaining sources and marking confidence + review state; admin review queue (unmatched, cultivars, taxonomy changes, duplicates, license failures, stale assertions); split the substrate **material catalog** from the mixer math (§4.2). **This is where the slug→profileId reforge lands** (Open Q A1): the engine's plant key swaps from `slug` to `profileId`, touching the `Plant` type, `build.plantSlugs`, the ≥4 `p.slug` lookups (`score-build.ts:75`, `export-txt.ts:67`, `compatibility.ts:334`/`:374`, `recommend.ts:21`, `placement.ts`), and the backup payload — a coordinated change, not a one-liner.
- **Scope — out:** organism search/profile *screens* and the CV benchmark (M5); the private-lifecycle surfaces (M6/M7).
- **Subsystems touched:** new organism/content model in `src/db`; `src/logic` plant-key swap; `src/data/plants.json` → migration corpus (reconciled, not runtime); `src/data/substrate-components.ts` (material catalog); Zod boundaries for the overlay.
- **Depends on:** M3 (adapter resolves taxa/media), M2 (profile/assertion tables), M1 (engines extracted so the key-swap is contained).
- **Exit criterion:** 201-record reconciliation report with **no silent unmatched identities**; overlay validates via Zod at the data boundary; engines read the overlay by `profileId` with M0 golden fixtures still green; trait assertions carry source, confidence, and review state.
- **Size:** L.
- **Placement rationale:** enforces the strategic seam (§2) and depends on both M2 and M3, so it cannot precede them; it is the master plan's Phase 2 data half and the point where the moat data is re-keyed.

### M5 · Organism search/profile UI + CV benchmark
- **Goal:** Ship organism search and profile screens from the new repository, and gate computer-vision identification on a real benchmark before it is trusted (§7 CV, App. A `app/plant/[slug]` → `organism/[profileId]`, §15 item ships organism UI).
- **Scope — in:** organism search/profile UI reading the cached organism-profile index (apply the tested `browse-filter.ts` semantics to that index, §4.2); the `organism/[profileId]` surface that supersedes the already-dead `plant/[slug]` redirect stub **and** the live `plant-sheet.tsx` detail surface the ledger omits (Open Q A3); offline fallback + provider-outage behavior; run the CV benchmark on the launch set (plants, mosses, fungi, pests, springtails, isopods), define "unknown" behavior, record model/provider version, require confirmation, and **ship CV only if false-positive performance is acceptable** — otherwise feature-gate it off.
- **Scope — out:** the builder, dashboard, care, journal (M6/M7); account-linked contribution (M11).
- **Subsystems touched:** new `src/app/organism/[profileId]`; retire/replace `src/components/plant-sheet.tsx` + `term-sheet.tsx` paths; `browse-filter.ts` adapted to the cached index.
- **Depends on:** M4 (profiles/overlay), M3 (adapter + CV).
- **Exit criterion:** search survives provider outage from cache and stale state never blocks adding a resident; CV benchmark meets its acceptance rule or CV is gated off; M4+M5 together satisfy the master plan's **Phase 2 exit gate** (201-record reconciliation + API contract tests + CV benchmark).
- **Size:** M.
- **Placement rationale:** presentation + ML-gating layer over M4's model; split from M4 so each is a clean one-session Pass-2 expansion, while jointly closing the plan's Phase 2 gate.

### M6 · Care occurrence engine + journal
- **Goal:** Replace the overloaded single "care mark" concept with the four-part care model and unify the timeline, ending OS-repeating-trigger drift (§8, §4.4, §6, App. A `careSchedule`/`care`, §15).
- **Scope — in:** split into **CarePlan** (derived, versioned policy) / **TaskOccurrence** (one due action + status) / **Intervention** (what was done: amounts, notes, photos) / **Outcome** (result feeding cadence calibration); replace OS repeating-interval triggers with scheduled occurrences that never re-anchor on app open and keep skipped tasks historically visible; support complete/skip/snooze/mute/reassign/customize without erasing the recommendation or history; "nothing needs doing" as a **computed** dashboard state; unified journal timeline (photos, notes, measurements, interventions, milestones); reconcile local notifications against app state (§11 SDK 56 constraint). Preserve the container-openness-first hypothesis as a *calibrated* input, not hard truth (§8).
- **Scope — out:** the builder/dashboard shell (M7); media *upload/export* mechanics (M8); diagnosis (Deferred, M12).
- **Subsystems touched:** `src/logic/care.ts` + `careSchedule.ts` (occurrence-model reforge); new care/journal tables + repos (from M2); `src/lib/notifications`.
- **Depends on:** M2 (occurrence/intervention/event/measurement tables), M1 (care engine extracted).
- **Exit criterion:** care creates explicit occurrences; skip/snooze/customize preserve auditable history; no notification drift from app open; the journal renders one unified timeline; care Outcomes are recorded for calibration.
- **Size:** L.
- **Placement rationale:** the adaptive-care spine and the outcome feedstock of the moat; depends only on the M2 tables, so it can proceed in parallel with M7 once the schema exists.

### M7 · Rebuilt builder + dashboard
- **Goal:** Rebuild the planner as an adaptive flow over the retained engines and the new profile repositories, and give the dashboard a first-screenful answer to attention / recent change / overall state (§4.3 planner REBUILD, §6, App. A `components/planner` REBUILD + `app/*` REBUILD, §15 item 10).
- **Scope — in:** replace the 4-step wizard (`planner.tsx:76-80`, currently coupled to one draft + the static `loadPlants()` seed, `planner.tsx:171`) with an adaptive flow producing a **versioned viability report**, quantities, shopping list, and build guide generated from a normalized design revision + inventory (`guide.ts`, §4.2); "mark as built" creates `Terrarium` + `Resident` records from a design revision **without losing provenance**; extend containers math for more shapes/ventilation/planting-volume/confidence (§4.2); dashboard warm-local render; replace the personal `mailto` feedback flow with in-app feedback + a moderated content-proposal workflow (§4.3); extract the pure cross-section scene math and rewrite the large component + art (§4.2, deferring the *art* itself to M10 retire).
- **Scope — out:** care/journal internals (M6); media upload/export (M8); community publishing (Deferred, M11).
- **Subsystems touched:** `src/app/planner` + `index` (dashboard) + `build/[id]` REBUILD; `src/components/planner/*` REBUILD; `src/components/build-card.tsx` (ledger-omitted, Open Q A3); `guide.ts`/`containers.ts` refactor.
- **Depends on:** M4 (overlay/profiles the builder reads), M1 (engines). Consumes records that M6 operates on, but the two can be built concurrently against the shared M2 schema.
- **Exit criterion:** builder produces a versioned viability report + quantities + shopping list + build guide; "mark as built" creates Terrarium/Resident with provenance intact; dashboard answers attention/recent/state without a network for cached terrariums; every compatibility warning explains input, rule version, affected residents, and remedy (§11).
- **Size:** L.
- **Placement rationale:** the product-shell rewrite; needs M4's re-keyed overlay before it can read organisms by profile.

### M8 · Media upload + relational export/restore
- **Goal:** Make photos durable and the backup complete: app-owned originals with upload state, and a relational export with a media manifest and a transactional, tested restore (§3 "backup excludes photo binaries", §4.2 `photos-repo`/`backup`, §11 media tests, §15 item 9).
- **Scope — in:** replace path-only photo records with media assets + upload state; app-owned original + preview + checksum + attribution (per M3's license capture); SDK 56 `File`/`Directory`/`Paths` media handling (§11); backup/export that includes relational data **plus a media manifest**, with transactional restore (today `backup.ts:6-11` explicitly drops photo binaries and wipes `build_photos` on restore); media tests for file loss, duplicate photo, checksum mismatch, upload retry, attribution rendering, revoked license, full export/restore.
- **Scope — out:** remote/cloud upload destination and sync (Deferred, M11 — the outbox seam exists from M2 but the server is deferred).
- **Subsystems touched:** `src/db/backup.ts` REFACTOR, `src/db/photos-repo.ts` REPLACE, new media-asset tables/storage.
- **Depends on:** M2 (media-asset tables), M3 (attribution/license fields), M6/M7 (journal + build surfaces that own media).
- **Exit criterion:** originals + metadata survive reinstall/restore; attribution renders accurately; a complete export/restore round-trips transactionally with a human-readable manifest.
- **Size:** M.
- **Placement rationale:** depends on the media model (M2/M3) and the surfaces that produce media (M6/M7); it is the durability guarantee the journal needs before dogfooding real user data.

### M9 · Dogfood migration + cutover prep
- **Goal:** Migrate real legacy data into the new model, prove no silent drops, and prepare a single reversible cutover (§9 field-mapping table + dual-read, §11 migration targets, §15 item 11, App. C migration report).
- **Scope — in:** complete the legacy→new field mapping (§9 table) including `plantSlugs → residents via the profile map` (needs M4's reconciliation); run **dual-read** in development comparing old vs new dashboard/build summaries and engine outputs on the same fixtures; produce a **per-user migration report** (builds, residents, tasks, photos, unmapped names, warnings — no silent drops); migrate real local data, record exceptions, fix the importer; retain legacy tables **read-only** for one release; note the mapping precision fixes from Open Q A4 (layer depths are scalar `real` columns, `substrateMix`/`careOverrides` are JSON *objects* not arrays).
- **Scope — out:** deleting legacy code/tables (M10); server-side migration (Deferred).
- **Subsystems touched:** the M2 importers, `src/db` legacy tables (read-only retention), reporting.
- **Depends on:** M2 (harness), M4 (profile map), M6/M7/M8 (new surfaces that must read migrated data).
- **Exit criterion:** 100% entity-count reconciliation with every exception surfaced in the report; a dogfood migration of real local data passes; legacy tables retained read-only; the end-to-end private loop (create → build → journal → care → restart offline) works on migrated data — satisfying the master plan **Phase 3 exit gate**.
- **Size:** M.
- **Placement rationale:** "cut over once" (§9); it needs every new surface (M6–M8) to exist so dual-read can compare, and it must precede any deletion.

### M10 · Legacy demolition (isolated cleanup)
- **Goal:** Remove the legacy surface in a dedicated, reviewable change — never mixed into the functional rewrite (§9 "delete last", §4.3, App. A RETIRE/REPLACE rows, §15 item 12, App. C cleanup evidence).
- **Scope — in:** delete legacy routes and old screens (`index`/`browse`/`care`/`settings`/`build/[id]`/`planner` legacy versions, the `plant/[slug]` redirect stub, `glyph-lab`); retire `plants.json` as a runtime catalog (keep as corpus), `plant-images.ts` + copied images, `vibes`/glyphs/cross-section **art** (keep the extracted math from M7), the standalone glossary subsystem (carry definitions forward as sourced content), `tools/plant-admin` (repurpose as provenance-aware content ops), `Web/` scratch prototype; retire the old flattened schema after cutover; reconcile the ledger-omitted components (`plant-sheet.tsx`, `term-sheet.tsx`, `build-card.tsx`, `glossary-text.tsx`, Open Q A3) — retheme or retire each explicitly; resolve the in-flight vibe/canopy work (Open Q B4).
- **Scope — out:** any behavior change or new feature; regenerating native `ios/`/`android/` (they are gitignored/generated — regenerate from Expo config as needed, not a deletion).
- **Subsystems touched:** `src/app`, `src/components/vibes` + planner art, `src/data`, `tools/plant-admin`, `Web/`, `assets/plants`.
- **Depends on:** M9 (cutover complete) and all rebuilt surfaces.
- **Exit criterion:** App. C cleanup evidence satisfied — owner sign-off, recovery export, **no legacy imports**, isolated removal PR, post-cleanup tests + migration verification pass; a complete data export remains possible after cleanup.
- **Size:** M.
- **Placement rationale:** last, per §9 — delete only after the vertical slice, migration, and recovery export prove the replacements read the migrated data.

---

## Deferred / Out-of-scope (platform layer E — §5, §10 phases 4–6)

Built only when the private loop earns trust; the adapter/outbox seams are drawn now (M2/M3), the build is deferred.

- **M11 · Shared data & publishing** (§10 Phase 4) — accounts, sync (activate the M2 outbox with idempotency/conflict handling per §5.1), households/roles, structured build publishing, moderation; plus iNaturalist **OAuth (PKCE) account-linking / observation contribution** (§7). Gated by the backend-vendor decision (§14). **Size: L.**
- **M12 · Retention intelligence** (§10 Phase 5) — constrained diagnosis (symptom intake → ranked causes with confidence → safe actions → checkpoint, not a conversational oracle, §4.4), comparison/time-lapse, outcome analytics, advanced planning. Safety review gate. **Size: L.**
- **M13 · Ecosystem expansion** (§10 Phase 6) — sensors, clubs/events, marketplace, **animals** (the §6.3 hooks exist; animals stay disabled until welfare rules + content are approved). Each is a separate program with its own policy/business gate. **Size: XL / separate programs.**

---

## Cross-cutting workstreams (not standalone phases)

These span multiple phases; they are scoped into the phases named rather than given their own M-ID, so completeness is preserved without double-counting.

- **Quality gates (§11):** the required-checks CI gate is established in **M2** (lint/type/unit/migration); each later phase adds its domain suite to exit criteria — API contract tests (M3), reconciliation report (M4), CV benchmark (M5), sync tests (M11), media tests (M8), accessibility/safety tests (M6/M7). Beta acceptance targets (§11) map to M6–M9 exit criteria.
- **Metrics & learning system (§13):** analytics scaffolding for activation/build/care/journal/health lands in **M6/M7** (opt-in, minimal collection); community/retention signals are **M11+**. Outcome-data policy (opt-in, failure-without-stigma) is a constraint on M6's Outcome model.
- **Animal-ready without animal scope (§6.3):** a *design constraint* applied in **M2/M4** (neutral organism/resident kinds, typed trait namespaces, welfare hooks, animal kinds disabled). Animals as a *feature* are **M13**.
- **Offline-first as a product promise (§5):** a constraint on M3 (bundle overlay + cached taxon + hero photo per vetted species; network only for search beyond the vetted set, fresh media, photo-ID) and M6–M9 (owned data fully offline). Owner ratification pending (§14 → Open Q C2).

---

## Master-plan cross-check (completeness)

Every workstream in the master plan lands in exactly one active phase or the Deferred list. Verified section by section:

| Master-plan element | Lands in |
|---|---|
| §1 Executive decision; §2 Strategic seam | Framing — enforced by M4 (overlay split) |
| §3 Current-state baseline | M0 |
| §4.1 KEEP (crown jewels) | M1 (extract as-is) |
| §4.2 REFACTOR (each row) | compatibility/score-build rule-versioning → M1 scaffold + M4 provenance; substrateMixer material-catalog split → M4; care split → M6; guide from design revision + containers shapes → M7; photos-repo → M8; backup+migrate → M2; browse-filter → M5; UI primitives retheme → M2/M7; cross-section geometry → M7 (math) + M10 (art) |
| §4.3 REPLACE / RETIRE (each row) | concept-replacements in their rebuild phase (planner → M7; plant schema/plants.json → M4; builds row → M2/M6; care_marks → M6; mailto → M7); physical retirement → M10 |
| §4.4 BUILD NEW | identity/media → M3; organism/outcome model → M4; care occurrence engine + journal → M6; diagnosis → M12; accounts/sync/community → M11 |
| §5 Target architecture (layers A–E) | A → M3; B → M4; C → M1; D → M2/M6; E → M11–M13 |
| §5.1 Local-first sync model / outbox | seam in M2; activated in M11 |
| §6 Target data model; §6.1 three-way split; §6.2 provenance/rule versioning | M2 (tables) + M4 (profiles/assertions); §6.2 also M1 (rule-set version scaffold) |
| §6.3 Animal-ready without scope | Cross-cutting → M2/M4; feature → M13 |
| §7 iNaturalist integration | M3 (adapter/cache/rate/resilience/licensing) + M5 (CV benchmark); OAuth → M11 |
| §8 Care model | M6 |
| §9 Migration & demolition safety | M2 (harness/bridge) + M9 (dogfood/report/cutover) + M10 (delete last) |
| §10 Phased delivery | Phase 0 → M0; Phase 1 → M1+M2; Phase 2 → M3+M4+M5; Phase 3 → M6+M7+M8+M9; Phases 4–6 → M11–M13 |
| §11 Quality gates | Cross-cutting → M2 gate + per-phase exit criteria |
| §12 Risks & mitigations | Informs ordering rationale (safety-first, extraction-first, riskiest-early, delete-last) |
| §13 Metrics & learning | Cross-cutting → M6/M7 + M11 |
| §14 Open decisions for the owner | Open Questions §C (deferred to their gates) |
| §15 First implementation backlog | items 1–3 → M0; 4 → M2; 5 → M1; 6 → M3 (spike in M0); 7 → M4; 8 → M6/M7 slice; 9 → M8; 10 → M7; 11 → M9; 12 → M10 |
| App. A File-level disposition | M1 (KEEP/REFACTOR relocation) + rebuild phases + M10 (RETIRE) |
| App. B Founding decisions | M0 |
| App. C Phase-gate evidence | Exit criteria of M0–M9 |
| App. D Technical references | Implementation-time reference (re-check at each phase) |
| Definition of done (§end) | Distributed across exit criteria; final closure at M9 (migration) + M10 (cleanup) |

**Result:** complete — nothing missing, nothing duplicated. Every §/appendix element is assigned to exactly one active phase, one cross-cutting owner, or the Deferred list.

---

## Open Questions

Recorded, not resolved. Each names the affected phase so a later pass can settle it.

### A. Doc ↔ code mismatches (found by verification)

- **A1 — "swap the plant loader's key from slug to profileId" is understated (§6.1).** Slug identity is threaded through the type system and persistence, not a single loader: `Plant.slug`, the persisted `build.plantSlugs` array, and ≥4 independent lookups/maps (`score-build.ts:75`, `export-txt.ts:67`, `compatibility.ts:334`/`:374`, `recommend.ts:21`, `placement.ts`), plus the backup payload. **Treat the reforge as a coordinated M4 change across types + DB + logic + migration, not a one-liner.**
- **A2 — `migrate.ts` is not a schema-migration engine (§9, App. A "db/migrate.ts REPLACE").** It is the backup-*payload* version ladder (`STORE_SCHEMA_VERSION=2`, currently an identity migration; "Pure — no I/O, no DB", `migrate.ts:44`). The real (and absent) schema-migration story is `SCHEMA_DDL` (`CREATE TABLE IF NOT EXISTS`) + three presence-guarded `ALTER`s (`ensureSubstrateMixColumn`/`ensureCharcoalDepthColumn`/`ensureCareOverridesColumn`, `schema.ts:223-268`), with **no `PRAGMA user_version`**, no ordering, no transactional DDL, no rollback. The plan's underlying claim (no real ordered migrations) holds, but **M2 must treat payload migration and schema migration as two distinct mechanisms.** *[Resolved 2026-07-11, Pass 2 M2 §3.1: two mechanisms, two version axes — `migrate.ts` keeps the backup-payload ladder (`STORE_SCHEMA_VERSION`, envelope-shape changes only); a new `src/db/schema-migrations/` harness owns DDL on `PRAGMA user_version` (ordered, transactional, rollback-tested; step 0001 absorbs `SCHEMA_DDL` + the three `ensure*` guards). See `M2-foundation-schema-harness.md`.]*
- **A3 — the disposition ledger (App. A) omits four live top-level components.** `src/components/plant-sheet.tsx`, `term-sheet.tsx`, `build-card.tsx`, `glossary-text.tsx` are unaccounted for. Most important: **`plant-sheet.tsx` is the live plant-detail surface that already replaced `plant/[slug]`** (`plant-sheet.tsx:2-4`), so the plan's "rename `plant/[slug]` → `organism/[profileId]`" targets a **dead redirect stub** (`plant/[slug].tsx:6-10`) while the real detail UI is unmentioned. **M5 must retarget the live sheet; M10 must give all four an explicit verdict.**
- **A4 — `builds` "layer depths / mix" mapping is imprecise (§9 table, §4.3).** Layer depths are **scalar `real` columns** (`substrateDepth`/`drainageDepth`/`charcoalDepth`), not JSON; `substrateMix` and `careOverrides` are JSON **objects**, not arrays. **M9's field mapping should reflect this exactly.** *[Resolved 2026-07-11, Pass 2 M2 §3.2: exact mapping settled — the scalar `real` depths become per-`design_layers` rows (`depth_cm REAL`; `null` depth → no row); the `substrateMix` **object** rides the substrate layer's `recipe` JSON object; the `careOverrides` **object** maps to `care_policy_overrides` rows (columns specified in M2's plan, DDL owned by M6); `placements` stays a JSON array on immutable design revisions.]*
- **A5 — `plant-images.ts` description is off (App. A "copied PNGs").** It is auto-generated, **117 `.jpg` vs 8 `.png`**, **125 entries covering only 124 of 201 slugs** (77 plants have no image; one key is a non-slug name). Licensing is largely untracked: only **5 of 201** records carry `imageCredit`/`imageLicense`. **M3/M4 media policy and M10 retirement should assume sparse, mixed-format, weakly-licensed assets.**
- **A6 — overlay data is sparse in places.** `toxicity` (an overlay/safety field, §6.1) is present on only **78 of 201** records; `substrateTags`/`plantType` on ~200. **M4 reconciliation must handle missing overlay values, not assume full coverage.**
- **A7 — minor:** "400+ passing cases" (§3) is **~364 static** `test(`/`it(` across 38 files (matches "~38 suites"); and `build/[id]/guide.tsx` is a **separate route** not itemized in App. A (though §3 prose says "build detail/guide"). Low impact.

### B. Unratified / uncommitted decisions

- **B1 — ADR 0007 (vibes/atmospheres) is "accepted" in frontmatter but "planning only — nothing implemented" in its body,** and it is currently modified/uncommitted. The migration RETIREs vibes (§4.3), so 0007 is a decision-of-intent to supersede, not a shipped feature. **Flag for M0 (record) and M10 (retire).**
- **B2 — in-flight work is building *into* a to-be-retired subsystem.** `src/components/vibes/canopy.ts` is **untracked/new**, already wired into `conservatory-background.tsx:31` and unit-tested (`src/data/__tests__/canopy.test.ts`), with `art.ts` and `conservatory-background.tsx` also modified. This collides directly with the vibes RETIRE decision. **M0 must snapshot it and the owner must decide keep-vs-abandon before M10.**
- **B3 — supersession records missing (App. A "add superseding records").** ADR **0017 revises 0016's verdict logic** but **0016 is still marked `accepted`** with no link; **0011 is `rejected`/superseded by 0012** (recorded). ADRs **0001–0006 carry no `status` field** (older prose format). **M1/M4 should file the superseding records the plan calls for.**
- **B4 — broad uncommitted worktree at risk.** `plants.json` modified, `docs/design-system.md` untracked, plus a **Facebook scrape** under `assets/plants/` (`(2) Facebook.html` + ~100-file `_files/`, an `Images/` dir, and 5 untracked PNGs). **M0's protected baseline must capture all of this before any bulk movement (§3, §9).**

### C. Owner-only open decisions (§14 — deferred to their gate, not blockers now)

- **C1 — Backend vendor & timing** (managed vs custom) — decide before **M11**, not now.
- **C2 — Offline-first tenet** after the identity layer — drives how much M3 bundles/caches. Plan recommends keeping offline-first for owned data + vetted set.
- **C3 — Free vs premium line** — never paywall basic organism welfare; draw the line before **M6/M7** ship.
- **C4 — Overlay authorship** (curator-only vs reviewed community) — shapes the M4/M10 content tool.
- **C5 — Naming** (keep Eco-Balance / Fit-Score vs a broader "viability" framing) — affects M4/M7 copy.

### D. Not verified statically (a Pass 2 should confirm by running)

- **D1 — "type-check green" (§3)** was not executed. Confirm during M0/M2. *[Resolved 2026-07-11, Pass 2 M0 §2: typecheck green.]*
- **D2 — the "pre-existing copy/guide test fails unrelated"** (per project memory) — both `src/data/__tests__/copy.test.ts` and `src/logic/__tests__/guide.test.ts` exist; which one fails was not run. Resolve before M0 golden fixtures are trusted. *[Resolved 2026-07-11, Pass 2 M0 §2: stale — full suite green, 37 files / 413 tests, both pass.]*

---

## Summary table

| ID | Title | Depends on | Size | Exit criterion (short) |
|----|-------|-----------|------|------------------------|
| **M0** | Preserve & characterize | — | M | App reproducible from tagged baseline; golden fixtures pass; decision records approved; no user work lost |
| **M1** | Extract engines behind stable contracts | M0 | M | Engines relocated; existing suite + golden fixtures green (zero behavior change); rule-set versions emitted |
| **M2** | Foundation — normalized schema + migration harness | M1 | L | Offline CRUD + ordered/transactional/rollback migration tests pass; new tables beside old; zero-error lint/type; CI gate live |
| **M3** | Identity & media layer (iNaturalist adapter + cache) | M2 | L | API contract tests pass; outage/offline fallback proven; cache TTLs + license capture enforced; within API budget |
| **M4** | Organism model + 201-record reconciliation | M3, M2, M1 | L | Reconciliation report with no silent unmatched; overlay Zod-valid; engines read by profileId with fixtures green |
| **M5** | Organism search/profile UI + CV benchmark | M4, M3 | M | Search survives outage from cache; CV meets acceptance or is gated off; closes Phase 2 gate |
| **M6** | Care occurrence engine + journal | M2, M1 | L | Explicit occurrences; auditable skip/snooze history; no app-open drift; unified journal timeline; Outcomes recorded |
| **M7** | Rebuilt builder + dashboard | M4, M1 | L | Versioned viability report + shopping list + guide; mark-as-built creates Terrarium/Resident w/ provenance; dashboard warm-local |
| **M8** | Media upload + relational export/restore | M2, M3, M6, M7 | M | Originals+metadata survive reinstall; attribution accurate; transactional export/restore round-trips w/ manifest |
| **M9** | Dogfood migration + cutover prep | M2, M4, M6, M7, M8 | M | 100% entity-count reconciliation, no silent drops; real-data dogfood passes; end-to-end loop on migrated data (Phase 3 gate) |
| **M10** | Legacy demolition (isolated cleanup) | M9 | M | App. C cleanup evidence met; no legacy imports; isolated PR; post-cleanup tests + export still pass |
| **M11** | Shared data & publishing *(deferred)* | M9 + §14 backend | L | Conflict/permission/deletion/abuse tests pass (Phase 4 gate) |
| **M12** | Retention intelligence *(deferred)* | M11 | L | Safety review + quality benchmarks pass (Phase 5 gate) |
| **M13** | Ecosystem expansion *(deferred)* | M12 | XL | Each program passes its own policy/business gate |

---

## Recommended Pass 2 order

Expand one phase per session into a file-level plan. Recommended sequence and why:

1. **M0 — first and now.** It is the safety net and it is time-critical: uncommitted work (Open Q B2/B4) is already colliding with a retirement decision. Its Pass 2 should also settle D1/D2 (run type-check and the failing copy/guide test).
2. **M2 — next, before M1.** Even though M1 *executes* first, the normalized data model is the linchpin whose shape determines M1's extraction boundaries, M4's reconciliation, and M9's field mapping. Plan it carefully on paper early so downstream passes build on settled decisions. Its Pass 2 must resolve Open Q A2 (two distinct migration mechanisms) and A4 (exact column types).
3. **M3 — in parallel with M2 if a second session is available.** It is the largest *external* unknown (rate limits, CC BY-NC licensing, CV) and is largely independent of the schema, so its design can proceed alongside M2. The M0 spike feeds it.
4. **M1 — after M2's model is settled**, since extraction boundaries follow from the target model.
5. **M4 — then**, once M2 + M3 exist; its Pass 2 must scope the slug→profileId reforge (Open Q A1) and the ledger-omitted `plant-sheet.tsx` (A3) explicitly.
6. **Thereafter follow execution order:** M5 → (M6 ∥ M7) → M8 → M9 → M10. M6 and M7 can be expanded/built concurrently once M2's schema and M4's overlay exist.
7. **M11–M13** only when Release 1 proves the private loop earns them (§10, §12 "over-scoped launch") — do not expand them until the owner ratifies the §14 decisions their phases depend on.
