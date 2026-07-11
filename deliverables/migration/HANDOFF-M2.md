# Terrarium Migration — Ladder Handoff (next: Pass 2 · M2; M0 owner-gates open)

*The one living ladder doc. A single `HANDOFF-*.md` exists at any time; each wrap deletes it and writes the successor named for what comes next. This is the file a new session reads first; it points at everything else.*

---

## ⚠ Read first: M0 is solo-complete but NOT formally closed

All solo-executable M0 work is done and committed on `verdict-overhaul`. **Three owner-gated items** are the entire gap to M0 close — they do **not** block starting M2 planning, but M0's App. C checklist can't all go ☑ until the owner does them:

1. **R2 offsite move** — move the R2 tar + `.sha256` (+ R4 JS-bundle tar) off-machine; record the destination in `BASELINE.md`'s R2 section.
2. **R6 device capture** — real backup JSON + `terrarium.db` + media manifest (runbook §5). *Not a blocker:* R5's `backup` golden fixture already characterizes export/restore/migrate on a §5-mirroring synthetic DB.
3. **R8 acceptance flip** — review `docs/adr/0018`–`0029` and flip `status: proposed` → `accepted` (App. C "approved decision records").

Full detail + the owner queue live in **`deliverables/m0-baseline/BASELINE.md`** (read it before touching M0).

## Where the ladder is

| Pass | Scope | Status | Output |
|------|-------|--------|--------|
| **Pass 1** | Conceptual outline (M0–M13 skeleton) | **DONE** (2026-07-10) | `deliverables/migration/00-conceptual-outline.md` |
| **Pass 2** | One phase per session → file-level plan | **M0 DONE**; **M2 NEXT** | `deliverables/migration/M0-preserve-characterize.md` |
| Implementation | Build phase by phase | **M0 solo-complete** (R0–R9 done; 3 owner gates open) | evidence: `deliverables/m0-baseline/BASELINE.md` |

## M0 execution — final state (sessions 1–2, 2026-07-11)

Per-step evidence lives in `BASELINE.md`; don't re-verify what it records. Commits on `verdict-overhaul`: `8370b7d` (R5), `4a68f14` (R7), `9347189` (R8), `e76559e` (R9), on top of session-1's `318d738`.

- **R0–R4 DONE** (session 1) — offsite push; worktree snapshot (branch `m0/worktree-snapshot` + tag `baseline/worktree-2026-07-11`); R2 archive created (**owner move pending**); tag `baseline/pre-migration` → `49f834f`; fresh-clone boot verified (screenshot in `deliverables/m0-baseline/`).
- **R5 DONE** — golden suite in `src/logic/__tests__/golden/`: 9 fixture families, `golden.test.ts`, `README.md`, captured via `UPDATE_GOLDEN=1`, **green twice** (422 tests / 38 files). Pins throws, ADR 0017 clamp/split, settle-in strict-`<` gate, notification caps, byte-exact TXT export, substrate matrix constants, backup envelope (exportedAt normalized, photos excluded) + restore/migrate.
- **R7 DONE** — `corpus-201.csv` + re-runnable `corpus-extract.mjs`; coverage + 465-link domain tally in `BASELINE.md` (POWO/Wikipedia/NCSU carry 396). Images-on-disk 129/201 (slug-resolved).
- **R8 DONE (authored)** — ADRs 0018–0029 as *proposed* (owner flips to accepted).
- **R9 DONE** — iNat spike in `tools/spike-inat/` (throwaway) → `inat-spike-findings.md`. Headline: name resolution 11/20 raw → **19/20 after strip-to-binomial**; licensing per-photo (mostly cc-by-nc/ARR); CV `score_image` → 401 (needs auth); v2 needs explicit `fields`.
- **R6, R10-close** — R6 owner-gated; R10 fully closes once the 3 owner gates are done.

## Next: Pass 2 · M2 (normalized schema + migration harness — plan on paper)

Per the outline's recommended order. M2 designs the normalized store schema + migration harness and settles Open Q **A2** (`src/db/migrate.ts` is the backup-payload ladder, *not* schema migration — two mechanisms) and **A4** (builds' scalar `real` depths vs `substrateMix`/`careOverrides` JSON objects). It is a **planning pass** (a file-level plan like `M0-preserve-characterize.md`), not a build — so it's solo-executable and independent of the M0 owner gates. The R5 golden fixtures are M2's regression net: **any** M2-adjacent code change must pass them **unchanged** (ADR 0029 regeneration policy).

## Canonical sources (read in this order)

1. `deliverables/Terrarium master plan.docx` — intent; cite §/App., don't restate.
2. `deliverables/migration/00-conceptual-outline.md` — phase skeleton + Open Questions (see § M2).
3. `deliverables/migration/M0-preserve-characterize.md` — the M0 runbook (now executed) + the §4 fixture spec M2 must not break.
4. `deliverables/m0-baseline/BASELINE.md` — M0 execution evidence + the owner queue.
5. The code — reality; re-verify what you touch.

## Ratified constraints every pass must honor (carried forward)

- **Tenets:** safety-first · extraction-first · bridge-first (delete **last**) · riskiest external unknown early · platform (M11–M13) deferred.
- **First-PR boundary (§9):** for M0 this meant no deletion/refactor/new-UI/algorithm-change. M2 is a **planning pass** — still no engine behavior change; golden fixtures stay green + unchanged.
- **A1** slug→profileId is a coordinated M4 reforge (first legitimate fixture regen); **A2** `src/db/migrate.ts` = backup-payload ladder, NOT schema migration (M2 treats as two mechanisms); **A3** App. A omits 4 live components (M5/M10); **A4** builds layer depths scalar `real`, `substrateMix`/`careOverrides` JSON (M2/M9 mapping); **A5/A6** sparse weak-licensed data (M3/M4 must not assume coverage — R7 confirms: toxicity 78/201, imageCredit/License 5/201); **B2** in-flight vibes/canopy vs M10 RETIRE — owner decides before M10 (ADR 0029 queues it); **B3** supersession records (0016←0017, 0007 mismatch) belong to M1/M4 (ADR 0029 only *notes* them).
- **Golden-fixture policy (ADR 0029):** hermetic (frozen catalog, pinned dates, injected labels); regeneration only as a recorded decision; M1 must pass with fixtures **unchanged**; first legitimate regen = M4's re-key. `copy.json` deliberately **not** frozen.

## R9 findings that shape later phases (don't re-derive)

- **M4 (name reconciliation):** normalize the corpus `scientificName` before querying iNat (strip `'Cultivar'`/`(parenthetical)`/`×`, fall back to genus+species); treat cultivar→species as **matched-with-loss** keeping our cultivar string; store the **returned canonical** name (synonyms real: Calathea→Goeppertia); expect an unmatched tail needing manual curation. Detail: `deliverables/m0-baseline/inat-spike-findings.md`.
- **M3 (licensing/media):** iNat photo licenses are **per-photo**, mostly cc-by-nc / ARR — commercial reuse largely blocked; filter on `license_code` per photo, never per taxon; surface attribution.
- **M5 (CV):** `computervision/score_image` needs auth — CV stays gated **off** by default (ADR 0025).

## Owner-blocked (§14 + M0-local)

- §14: **C1** backend (gates M11) · **C2** offline depth (shapes M3) · **C3** free/premium (before M6/M7) · **C4** overlay authorship (M4/M10) · **C5** naming (M4/M7).
- **M0-local (the three that close M0):** R2 offsite move + destination note · R6 device capture · R8 acceptance flip. Pause vibe/canopy edits until M0 closes (else re-run R1 before R10).

## Doc discipline

- Ladder artifacts live in `deliverables/migration/`; numbered files are stable references; this handoff is the only living ladder doc — delete + rename on each wrap.
- Session-start read stays under ~30 KB; evict finished-pass narrative to `deliverables/migration/archive/` (never delete to hit the cap). *(Not yet needed — the live set is small.)*
- **Git:** commit **only** `deliverables/migration/`, `deliverables/m0-baseline/`, `src/logic/__tests__/golden/`, `docs/adr/00NN`, `tools/spike-inat/` on `verdict-overhaul`. **Never `git add -A`** — the working tree carries the owner's uncommitted vibes/canopy work (preserved on the snapshot branch, must stay uncommitted).

## Kickoff prompt for the next chat (Pass 2 · M2)

> Read CLAUDE.md, then `deliverables/migration/HANDOFF-M2.md`, then the `## ⚠ Read first` + Owner-action queue in `deliverables/m0-baseline/BASELINE.md`, then § M2 of `deliverables/migration/00-conceptual-outline.md`. M0's solo work is done; **start Pass 2 · M2** — produce the M2 file-level plan (normalized schema + migration harness) mirroring the shape of `M0-preserve-characterize.md`, settling Open Q A2 (payload ladder ≠ schema migration) and A4 (scalar depths vs JSON objects) on paper. Keep the golden fixtures green + **unchanged** (ADR 0029). Don't touch the owner's in-flight vibes/canopy files; never `git add -A`. If the owner is present, get the three M0 gates done (R2 move, R6 capture, R8 accept-flip) to formally close M0. Wrap per /phase — delete this handoff and write the successor named for what comes next.

*If the owner is present this session: closing the three M0 gates (R2 destination, R6 capture, R8 acceptance) is the only thing a solo session can't finish — everything else on M0 is done.*
