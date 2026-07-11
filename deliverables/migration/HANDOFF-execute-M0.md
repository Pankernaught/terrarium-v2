# Terrarium Migration — Ladder Handoff (next: EXECUTE M0)

*The one living ladder doc. Naming pattern: a single `HANDOFF-*.md` exists at any time; each wrap deletes it and writes the successor named for what comes next. Updated at the end of every pass. This is the file a new session reads first; it points at everything else.*

---

## Where the ladder is

| Pass | Scope | Status | Output |
|------|-------|--------|--------|
| **Pass 1** | Conceptual outline (phase skeleton M0–M13) | **DONE** (2026-07-10) | `deliverables/migration/00-conceptual-outline.md` |
| **Pass 2** | One phase per session → file-level plan | **M0 DONE** (2026-07-11); rest pending | `deliverables/migration/M0-preserve-characterize.md` |
| Implementation | Build phase by phase | **M0 execution is NEXT — time-critical** | — |

**Phase-expansion progress:**

- ☑ **M0 · Preserve & characterize — PLANNED** → `M0-preserve-characterize.md` (runbook R0–R10, golden-fixture spec, ADR 0018–0029 list, iNat spike brief, App. C exit checklist). **Not yet executed.**
- ☐ M2 · Foundation (schema + migration harness) — **expand next after M0 executes** (must settle Open Q A2/A4 on paper)
- ☐ M3 · Identity & media layer — can run parallel to M2 in a second session
- ☐ M1 · Extract engines — after M2's model is settled
- ☐ M4 · Organism model + reconciliation — after M2+M3
- ☐ M5–M10 — thereafter in execution order (M6 ∥ M7 possible)
- ☐ M11–M13 · Deferred platform layer — **do not expand** until Release 1 earns them and the owner ratifies §14

## What Pass 2 · M0 established (2026-07-11)

- **D1 RESOLVED:** `npm run typecheck` green. **D2 RESOLVED:** the remembered copy/guide test failure is **stale** — full suite green, **37 files / 413 tests / 0 failures**. Golden fixtures start from an all-green baseline.
- Lint baseline: **19 errors / 7 warnings** (UI-concentrated; fixing is M2). **No hosted CI exists** — every "green" is a local run; the required-checks gate is M2 scope.
- **Offsite gap found (the reason M0 execution can't wait):** `main` is **14 commits ahead of `origin/main`**; `verdict-overhaul` (1 further) has **no remote branch**; the repo has **zero tags**; ~70 MB of untracked material including the **master plan docx itself**. Runbook step R0 (one push command) closes most of the exposure.
- Facts pinned for later phases: 3 user tables (`schema.ts:35,92,111`), backup `STORE_SCHEMA_VERSION=2`, photos excluded from backup by design; SQLite file `terrarium.db`; `package-lock.json` present; container shapes are exactly `rectangular`/`cylindrical`; `buildCareSchedule` takes explicit `now` (deterministic capture OK); corpus coverage re-verified (images 124/201, credit 5/201, toxicity 78/201). `Skill docs/` (28K) is ignored-by-status but matches no ignore rule — anomaly; R1/R2 handle it.
- Outline updated: D1/D2 annotated resolved; its handoff pointer now names this file.

## Canonical sources (read in this order)

1. **`deliverables/Terrarium master plan.docx`** — intent. Cite by §1–§15 / App. A–D; don't restate.
2. **`deliverables/migration/00-conceptual-outline.md`** — the phase skeleton + Open Questions. Read the relevant phase's section before expanding it.
3. **`deliverables/migration/M0-preserve-characterize.md`** — the executable M0 runbook (this is what the next session runs).
4. **The code** — reality. Re-verify the files a phase touches; the tree moves.

## Ratified constraints every pass must honor

- **Tenets:** safety-first · extraction-first · bridge-first (delete **last**) · riskiest external unknown early · platform (M11–M13) deferred.
- **A1** — slug→profileId is a coordinated **M4** reforge (`Plant.slug`, `build.plantSlugs`, ≥4 lookups: `score-build.ts:75`, `export-txt.ts:67`, `compatibility.ts:334/:374`, `recommend.ts:21`, `placement.ts`, + backup payload), not a loader swap.
- **A2** — `src/db/migrate.ts` is the backup-*payload* ladder, NOT schema migration; the real mechanism is `SCHEMA_DDL` + guarded `ensure*Column` ALTERs (`schema.ts:223-268`), no `PRAGMA user_version`. M2 treats them as two mechanisms.
- **A3** — App. A omits 4 live components (`plant-sheet.tsx` — the real plant-detail surface, `term-sheet.tsx`, `build-card.tsx`, `glossary-text.tsx`). M5 retargets the live sheet; M10 gives all four explicit verdicts.
- **A4** — `builds` layer depths are scalar `real`; `substrateMix`/`careOverrides` are JSON **objects**. M9's mapping must match.
- **A5/A6** — sparse, weakly-licensed data (images 124/201, credit 5/201, toxicity 78/201). M3/M4 must not assume coverage.
- **B2** — in-flight vibes/canopy work collides with the M10 RETIRE decision. M0 R1 snapshots it; owner decides keep-vs-abandon before M10 (queued in ADR 0029).
- **B3** — supersession records (0016←0017; 0007 status/body mismatch) get filed in **M1/M4**; M0's ADR 0029 only notes the facts.
- **M0-plan additions:** golden fixtures are hermetic (frozen `catalog.snapshot.json`, pinned dates) and regenerate only as a recorded decision — M1 must pass with fixtures **unchanged**; first legitimate regeneration is M4's re-key.

## Owner-blocked (§14) — do not expand until ratified

- **C1** backend vendor/timing → gates M11. **C2** offline-first depth → shapes M3. **C3** free/premium line → before M6/M7 ship. **C4** overlay authorship → shapes M4/M10 tooling. **C5** naming (Eco-Balance/Fit-Score vs "viability") → M4/M7 copy.
- Within M0 itself, three steps need the owner: R2 archive destination, R6 on-device capture, R8 ADR sign-off (App. C "approved decision records").

## Doc discipline

- Ladder artifacts live in `deliverables/migration/` only; numbered/ID-named files are stable references; this handoff is the only living doc and gets deleted+renamed each wrap.
- Evict on growth: move finished-pass narrative to `deliverables/migration/archive/` (header: "*Split out, <date>. Do not read at session start.*"); keep the session-start read under ~30 KB; never delete to hit the cap — move.
- **Git state:** as of this pass, `deliverables/migration/` is committed on `verdict-overhaul`; the rest of the tree is deliberately dirty until M0 R1 snapshots it. If you commit before R1, commit **only** `deliverables/migration/` (plus, during M0 execution, the artifacts the runbook names: `deliverables/m0-baseline/`, `src/logic/__tests__/golden/`, `docs/adr/0018+`).

## Kickoff prompt for the next chat (Execute M0)

> Read CLAUDE.md, then `deliverables/migration/HANDOFF-execute-M0.md`, then `deliverables/migration/M0-preserve-characterize.md` (the runbook). **Execute M0** top to bottom: R0 (offsite push) immediately, then R1–R10 in order. R2's archive destination, R6's on-device capture, and R8's ADR sign-off need the owner — flag those and keep going on everything solo-executable (R0–R5, R7, R9). Honor the First-PR boundary: no deletion, no refactor, no algorithm change; golden fixtures are additive only, green twice consecutively. Stop after M0, fill the App. C checklist in `deliverables/m0-baseline/BASELINE.md`, and wrap per /phase — delete this handoff and write the next one (named for Pass 2 · M2 if M0 completed).

*If the owner is unavailable for a whole session, the fallback is Pass 2 · M2 planning (outline §M2; settle Open Q A2/A4 on paper) — but run R0 first regardless; it's one command and closes the 14-commit offsite gap.*
