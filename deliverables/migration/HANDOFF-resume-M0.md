# Terrarium Migration — Ladder Handoff (next: RESUME M0 execution, mid-R5)

*The one living ladder doc. A single `HANDOFF-*.md` exists at any time; each wrap deletes it and writes the successor named for what comes next. This is the file a new session reads first; it points at everything else.*

---

## Where the ladder is

| Pass | Scope | Status | Output |
|------|-------|--------|--------|
| **Pass 1** | Conceptual outline (M0–M13 skeleton) | **DONE** (2026-07-10) | `deliverables/migration/00-conceptual-outline.md` |
| **Pass 2** | One phase per session → file-level plan | **M0 DONE** (2026-07-11); rest pending | `deliverables/migration/M0-preserve-characterize.md` |
| Implementation | Build phase by phase | **M0 EXECUTING — session 1 ended mid-R5 (~40% of M0)** | evidence: `deliverables/m0-baseline/BASELINE.md` |

## M0 execution state (session 1, 2026-07-11)

Per-step detail + hashes/counts live in **`deliverables/m0-baseline/BASELINE.md`** — read it before resuming; don't re-verify what it already records.

- **R0 DONE** — 14-commit gap closed; `verdict-overhaul` on origin.
- **R1 DONE** — snapshot `2f16517` (branch `m0/worktree-snapshot`, tag `baseline/worktree-2026-07-11`, pushed); working tree untouched & verified. `Skill docs/` anomaly **resolved** (only ignored `.DS_Store`s inside — nothing valuable; force-add skipped; note in ADR 0029).
- **R2 archive CREATED** (165 MB tar + sha256 in the repo's parent dir) — **owner move offsite still pending**.
- **R3 DONE** — `baseline/pre-migration` → `49f834f` on origin.
- **R4 DONE** — fresh clone: ci/typecheck green, **408/36 green** (413−408 = the 5 untracked canopy tests; explained in BASELINE.md); Release build 0 errors, booted on iPhone 17 Pro, screenshot in `deliverables/m0-baseline/`; JS bundle tar'd beside the R2 archive (rides the same owner move). Gotcha worth keeping: CocoaPods on this machine needs `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` or `pod install` dies with a unicode_normalize crash.
- **R5 ~30% — the resume point.** Done: `src/logic/__tests__/golden/catalog.snapshot.json` (frozen working-tree plants.json) and `scenarios.ts` (input matrix, committed clean & type-checked). **Very next action:** write `golden.test.ts` + `fixtures/` + `README.md` per the design decisions below, capture with `UPDATE_GOLDEN=1`, and get `npm run test:run` green **twice**.
- **R6–R10 not started.** R6 owner-gated; R7 (corpus csv), R8 (author twelve ADRs as *proposed*), R9 (iNat spike) all solo-executable; R10 closes out.

## R5 design decisions already settled (don't re-derive)

1. **Snapshot parse:** golden suite parses `catalog.snapshot.json` with the **base `plantSchema`** (engines' contract; identical output to the seed parse for valid data; keeps the suite off `src/data`).
2. **Labels frozen:** `formatMixRecipe`'s `labelOf` is injected from a **frozen label map in `scenarios.ts`** — hermetic against `src/data` label edits.
3. **copy.json is deliberately NOT frozen** — engine outputs embed `copy()` strings by design; a copy edit legitimately moves fixtures (characterization). Note in `golden/README.md` + ADR 0029.
4. **Scenario set:** the 14 runbook §4.2 scenarios + added `micro-sealed-gas` (fast grower, sealed 0.94 L → gas-exchange caution). Slugs chosen and annotated in `scenarios.ts` (survival-clamp = echeveria among 3 tropicals; split-tie = medium×2 vs low×2; crowded = 6 plants on 100 cm²).
5. **Fixture layout:** one JSON per engine family (9 files) under `golden/fixtures/`; `golden.test.ts` deep-equals `JSON.parse(JSON.stringify(actual))` against the fixture; `UPDATE_GOLDEN=1` rewrites instead of asserting. Regeneration is documented in `golden/README.md` (an env-var invocation, **no package.json edit** — package.json is outside the M0 commit set).
6. **Pinned instants** (in `scenarios.ts`): createdAt `2026-01-15T12:00:00Z`, now `2026-02-01T12:00:00Z`, early-now `+5 d`, settle-window boundary `+14 d` exact and −1 ms (gate is strict `<`). `buildCareSchedule` always gets `now` explicitly; `exportBackup.exportedAt` gets normalized before compare.
7. **Pinned as behavior:** `scoreBuild` **throws** on malformed geometry (`resolveBuildContainer` sits outside its try) — captured via `BROKEN_BUILD_BAD_DIMENSIONS`; engine `throw` messages are fixtures too.
8. **Backup fixture:** seed a `makeTestDb()` node DB (`src/db/__tests__/helpers.ts`) with §5-mirroring content (6 builds both shapes, mix+charcoal, overrides incl. mute, placements, tags, 4 care-mark kinds incl. plant-scoped, 2 photo rows to prove exclusion) → `exportBackup` → normalize → fixture; plus restore round-trip counts and `migratePayload` v1→v2 + refuse-newer + missing-step messages.
9. **Recommend capture is slimmed** to `{plant: slug, fitScore, reasons, cautions}` (full `Plant` payloads are already frozen in the snapshot).

All §4.1 entry points were re-verified this session against the cited files — signatures match the runbook table; no drift found.

## Canonical sources (read in this order)

1. `deliverables/Terrarium master plan.docx` — intent; cite §/App., don't restate.
2. `deliverables/migration/00-conceptual-outline.md` — phase skeleton + Open Questions.
3. `deliverables/migration/M0-preserve-characterize.md` — the M0 runbook being executed (§4 fixture spec, §5–§8 for R6–R9, §9 exit checklist).
4. `deliverables/m0-baseline/BASELINE.md` — execution evidence so far.
5. The code — reality; re-verify what you touch.

## Ratified constraints every pass must honor (carried forward)

- **Tenets:** safety-first · extraction-first · bridge-first (delete **last**) · riskiest external unknown early · platform (M11–M13) deferred.
- **First-PR boundary (§9), in force for all of M0:** no deletion, no refactor, no new UI, no algorithm change; golden fixtures additive only, green twice consecutively.
- **A1** slug→profileId is a coordinated M4 reforge; **A2** `src/db/migrate.ts` is the backup-payload ladder, NOT schema migration (M2 treats as two mechanisms); **A3** App. A omits 4 live components (M5/M10 handle); **A4** builds layer depths scalar `real`, `substrateMix`/`careOverrides` JSON objects (M9 mapping); **A5/A6** sparse weak-licensed data (M3/M4 must not assume coverage); **B2** in-flight vibes/canopy vs M10 RETIRE — owner decides before M10, queued in ADR 0029; **B3** supersession records (0016←0017, 0007 mismatch) belong to M1/M4 — ADR 0029 only *notes* them.
- **Golden-fixture policy:** hermetic (frozen catalog, pinned dates); regeneration only as a recorded decision; M1 must pass with fixtures **unchanged**; first legitimate regen = M4's re-key.

## Owner-blocked (§14 + M0-local)

- §14: **C1** backend (gates M11) · **C2** offline depth (shapes M3) · **C3** free/premium (before M6/M7) · **C4** overlay authorship (M4/M10) · **C5** naming (M4/M7).
- M0-local queue (also in BASELINE.md): R2 offsite move + destination note · R6 capture session · R8 ADR acceptance flip · pause vibe/canopy edits until M0 wraps (else re-run R1 before R10).

## Doc discipline

- Ladder artifacts live in `deliverables/migration/`; numbered files are stable references; this handoff is the only living doc — delete + rename on each wrap.
- Session-start read stays under ~30 KB; evict finished-pass narrative to `deliverables/migration/archive/` (never delete to hit the cap).
- **Git during M0:** commit **only** `deliverables/migration/`, `deliverables/m0-baseline/`, `src/logic/__tests__/golden/`, `docs/adr/0018+` (R9 adds `tools/spike-inat/`) on `verdict-overhaul`. Never `git add -A` — the working tree carries the owner's in-flight vibes/canopy work, which stays uncommitted (it's preserved on the snapshot branch).

## Kickoff prompt for the next chat (Resume M0)

> Read CLAUDE.md, then `deliverables/migration/HANDOFF-resume-M0.md`, then `deliverables/m0-baseline/BASELINE.md`, then runbook §3–§9 of `deliverables/migration/M0-preserve-characterize.md`. **Resume M0 mid-R5** (R0–R4 are done): write `golden.test.ts` + fixtures + README in `src/logic/__tests__/golden/` per the settled design decisions in the handoff, capture with `UPDATE_GOLDEN=1`, get the suite green twice. Then R7 (corpus), R8 (author ADRs 0018–0029 as proposed), R9 (iNat spike) solo; flag R2-move/R6/R8-acceptance for the owner. Honor the First-PR boundary: no deletion, no refactor, no algorithm change. Stop after M0, fill the App. C checklist in BASELINE.md, and wrap per /phase — delete this handoff and write the next one (named for Pass 2 · M2 if M0 completed).

*If the owner is present during that session: collect the R2 destination, run the R6 capture (runbook §5), and get the R8 acceptance flip — those are the only three things a solo session cannot finish.*
