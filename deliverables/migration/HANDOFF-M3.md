# Terrarium Migration — Ladder Handoff (next: Pass 2 · M3; M0 owner-gates open)

*The one living ladder doc. A single `HANDOFF-*.md` exists at any time; each wrap deletes it and writes the successor named for what comes next. This is the file a new session reads first; it points at everything else.*

---

## ⚠ Read first: M0 is solo-complete but NOT formally closed

Unchanged from the last wrap — **three owner-gated items** are the entire gap to M0 close. They block nothing on the planning ladder:

1. **R2 offsite move** — move the R2 tar + `.sha256` (+ R4 JS-bundle tar) off-machine; record the destination in `BASELINE.md`'s R2 section.
2. **R6 device capture** — real backup JSON + `terrarium.db` + media manifest (runbook §5). R5's synthetic `backup` fixture keeps M2 unblocked meanwhile.
3. **R8 acceptance flip** — review `docs/adr/0018`–`0029` and flip `status: proposed` → `accepted`.

Full detail + the owner queue live in **`deliverables/m0-baseline/BASELINE.md`**. Ground rule still in force: pause in-flight vibe/canopy edits until M0 closes, or re-run R1 (cheap) before close-out.

## Where the ladder is

| Pass | Scope | Status | Output |
|------|-------|--------|--------|
| **Pass 1** | Conceptual outline (M0–M13 skeleton) | **DONE** (2026-07-10) | `00-conceptual-outline.md` |
| **Pass 2** | One phase per session → file-level plan | **M0 DONE · M2 DONE (2026-07-11) · M3 NEXT**, then M1, then M4 | `M0-preserve-characterize.md`, `M2-foundation-schema-harness.md` |
| Implementation | Build phase by phase | **M0 solo-complete** (3 owner gates open); M1 next to *execute*; M2 execution waits on M1 | evidence: `deliverables/m0-baseline/BASELINE.md` |

## Pass 2 · M2 — done this session (2026-07-11, session 3)

**`deliverables/migration/M2-foundation-schema-harness.md`** is the file-level plan (normalized schema + ordered migration harness), mirroring the M0 plan's shape. Planning only — zero code changed; suite re-verified green (38 files / 422 tests), typecheck green, goldens byte-unchanged, working tree byte-identical to the session-2 wrap (owner's vibes/canopy files untouched). What it settled — don't re-litigate:

- **Open Q A2 resolved (§3.1):** two mechanisms, two version axes. `migrate.ts` stays the backup-payload ladder (`STORE_SCHEMA_VERSION`); a new `src/db/schema-migrations/` harness owns DDL on `PRAGMA user_version` — ordered steps, one transaction each (raw `BEGIN IMMEDIATE` through a dual-driver `SqlExecutor` seam, dodging `sqlite-proxy`'s missing `transaction()`), no down-migrations, refuse-newer both sides. Step 0001 idempotently absorbs `SCHEMA_DDL` + the three `ensure*` guards, so all four historical column states and fresh installs share one code path. ADR 0030 (proposed) lands at execution.
- **Open Q A4 resolved (§3.2):** exact mapping — scalar `real` depths → per-`design_layers` rows (`depth_cm REAL`, null → no row); `substrateMix` **object** → substrate layer `recipe` JSON; `careOverrides` **object** → `care_policy_overrides` rows (columns specified now, DDL owned by M6); `placements` stays a JSON array on immutable revisions. Both annotated `[Resolved]` in the outline.
- **Table boundary (§3.3):** M2 creates the harness + **13 tables** (terrariums, enclosures, designs, design_revisions, design_layers, residents, task_occurrences, interventions, journal_events, measurements, media_assets, provider_snapshots, outbox_ops); M4/M6/M11 author their own tables as later ordered steps. §5.1 sync columns via one `syncColumns()` helper; §6.3 animal-ready = `organism_kind` + `ENABLED_ORGANISM_KINDS = ['plant']`; FK policy: real FKs among new tables + `PRAGMA foreign_keys = ON`, cross-phase refs repo-enforced until their phase lands.
- **Repos/use-cases (§7):** house factory pattern, one repo per aggregate; `use-cases.ts` owns the §5.1 invariant (entity write + outbox append in one transaction), engine-free so M2 stays decoupled from M1's boundary choices.
- **CI gate (§9):** lint zero-error strategy — real fixes + per-file inventoried waivers for the 19 errors (all in 5 files; `cross-section.tsx`/`plants-step.tsx` are M7-REBUILD fated); new dirs never waived; `.github/workflows/checks.yml` runs lint+typecheck+test:run; the *required-checks* branch-protection flip is an **owner gate at M2 execution** (not due yet), as is a store-inspector device check.
- **drizzle-kit journal rejected** (§5.5) — dev-time sanity tool only; hand-written ordered steps match house precedent.

## Next: Pass 2 · M3 (iNaturalist adapter + on-device cache — plan on paper)

Per the outline's recommended order (M3 before M1: largest external unknown, schema-independent). It designs the typed adapter + cache against **M2's `provider_snapshots` table** (M2 plan §6.2) and must build on the R9 spike findings — name-resolution normalization, per-photo licensing, CV-auth gate, §7 TTLs/rate budget, offline/outage fallback, license-attribution capture. Solo-executable; independent of the M0 gates and of M1/M2 execution. After M3's plan: **M1's** extraction plan (against M2's settled model), then **M4**.

## Canonical sources (read in this order)

1. `deliverables/Terrarium master plan.docx` — intent; cite §/App., don't restate (§7 + §5 layer A are M3's sections).
2. `deliverables/migration/00-conceptual-outline.md` — phase skeleton + Open Questions (§ M3; A2/A4 now carry `[Resolved]` pointers).
3. `deliverables/migration/M2-foundation-schema-harness.md` — the settled data-model foundation (provider cache table, executor seam, CI gate).
4. `deliverables/migration/M0-preserve-characterize.md` — the M0 runbook + §4 fixture spec no phase may break.
5. `deliverables/m0-baseline/BASELINE.md` — M0 evidence + owner queue; `inat-spike-findings.md` — R9, M3's direct input.
6. The code — reality; re-verify what you touch.

## Ratified constraints every pass must honor (carried forward)

- **Tenets:** safety-first · extraction-first · bridge-first (delete **last**) · riskiest external unknown early · platform (M11–M13) deferred.
- **Boundaries:** M2 is the master plan's "second PR" (§9) — harness + tables beside legacy, no deletion, no engine change; planning passes change no code at all.
- **Open Qs:** **A1** slug→profileId = coordinated M4 reforge (first legitimate fixture regen); **A2/A4 RESOLVED** → M2 plan §3.1/§3.2; **A3** ledger omits 4 live components (M5/M10); **A5/A6** sparse weak-licensed data (M3/M4 must not assume coverage — toxicity 78/201, imageCredit/License 5/201); **B2** in-flight vibes/canopy vs M10 RETIRE — owner decides before M10 (ADR 0029 queues it); **B3** supersession records → M1/M4.
- **Golden-fixture policy (ADR 0029):** hermetic; regeneration only as a recorded decision; M1 must pass with fixtures **unchanged**; first legitimate regen = M4's re-key. `copy.json` deliberately not frozen.

## R9 findings that shape M3 (don't re-derive)

- **Name resolution:** 11/20 raw → **19/20 after strip-to-binomial** (strip `'Cultivar'`/`(parenthetical)`/`×`, fall back genus+species); cultivar→species = matched-with-loss keeping our cultivar string; store the returned canonical (synonyms real: Calathea→Goeppertia); expect a manual-curation tail. Detail: `deliverables/m0-baseline/inat-spike-findings.md`.
- **Licensing:** per-photo, mostly cc-by-nc/ARR — commercial reuse largely blocked; filter on `license_code` per photo, never per taxon; surface attribution.
- **CV:** `computervision/score_image` → 401 without auth — CV gated **off** by default (ADR 0025); v2 API needs explicit `fields`.
- **R7 tally (BASELINE):** POWO/Wikipedia/NCSU carry 396/465 source links — M3's licensing pass clears ~85% via three institutional hosts; 40-host hobbyist tail needs per-host handling.

## Owner-blocked

- **M0 close (the three above).**
- **Queued at M2 execution (not due):** branch-protection required-checks flip; store-inspector device check; UI-touching lint fixes device-verify.
- **§14:** C1 backend (M11) · C2 offline depth (shapes M3 — plan should note the dependency, not decide it) · C3 free/premium (before M6/M7) · C4 overlay authorship (M4/M10) · C5 naming (M4/M7).

## Doc discipline

- Ladder artifacts live in `deliverables/migration/`; numbered files are stable references; this handoff is the only living ladder doc — delete + rename each wrap.
- Session-start read stays under ~30 KB (this file + pointed-at sections); eviction to `archive/` not yet needed — re-check next wrap.
- **Git:** commit **only** `deliverables/migration/`, `deliverables/m0-baseline/`, `src/logic/__tests__/golden/`, `docs/adr/00NN`, `tools/spike-inat/` on `verdict-overhaul`. **Never `git add -A`** — the working tree carries the owner's uncommitted vibes/canopy work (preserved on the snapshot branch, must stay uncommitted).

## Kickoff prompt for the next chat (Pass 2 · M3)

> Read CLAUDE.md, then `deliverables/migration/HANDOFF-M3.md`, then § M3 + Open Questions of `deliverables/migration/00-conceptual-outline.md`, then `deliverables/m0-baseline/inat-spike-findings.md` (+ the R7 domain tally in `BASELINE.md`). Start **Pass 2 · M3** — produce the M3 file-level plan (typed iNaturalist adapter + on-device cache) mirroring `M2-foundation-schema-harness.md`'s shape: design against M2's `provider_snapshots` spec (M2 plan §6.2), fold in the R9 findings (strip-to-binomial resolution, per-photo licensing, CV 401 gate), and settle the §7 TTL/rate/licensing surface on paper. Golden fixtures stay green + **unchanged** (ADR 0029). Don't touch the owner's in-flight vibes/canopy files; never `git add -A`. If the owner is present, close the three M0 gates (R2 move, R6 capture, R8 accept-flip). Wrap per /phase — delete this handoff and write the successor named for what comes next.

*If the owner is present this session: the three M0 gates are still the only thing a solo session can't finish; everything on the planning ladder proceeds without them.*
