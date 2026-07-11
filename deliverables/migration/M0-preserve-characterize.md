# M0 · Preserve & characterize — Pass 2 plan (runbook + decision records)

**Status:** planned (Pass 2 complete, 2026-07-11). Not yet executed.
**Phase ID:** M0 (see `00-conceptual-outline.md` § M0 for the ratified scope; this file expands it, it does not re-derive it).
**Intent sources:** master plan §3 (baseline table + demolition baseline), §9 (First-PR boundary), §15 items 1–3 and 6, App. B (founding decisions), App. C (Phase 0 evidence).
**Reality source:** working tree on `verdict-overhaul` @ `49f834f`, re-verified 2026-07-11 (all `path:line` cites below are from that verification).

M0 is the exception phase: **a runbook, not a code plan.** Its only code artifact is the golden-fixture test harness (additive, characterization-only). Per §9's First-PR boundary: *no deletion, no new UI, no algorithm change* — anything that would alter an engine output is out of scope until M1+.

---

## 1. Restated scope

Make the current app fully reproducible and losslessly recoverable before anything is moved or deleted, and record the founding decisions the rebuild will be checked against (§3, §9, §15 items 1–3, App. B, App. C Phase 0). In: protected baseline tag; snapshot of the dirty worktree **first**; representative DB + backup + media capture; golden fixtures over every retained engine; the 201-name migration corpus; founding decision records; a throwaway iNaturalist spike to feed M3. Out: any deletion, any refactor, any new UI, any §14 owner decision not yet needed. Depends on nothing. Size M.

## 2. Pass-2 verification results (2026-07-11)

Run during planning so the runbook starts from facts, not the outline's assumptions:

| Item | Result |
|---|---|
| **D1 — type-check** | **GREEN.** `npm run typecheck` exits 0. |
| **D2 — copy/guide test failure** | **STALE — no failure exists.** Full suite: `npm run test:run` → **37 files, 413 tests, 0 failures** (outline said "~364 across 38 files"; both copy.test.ts and guide.test.ts pass). The remembered failure has been fixed sometime since; golden fixtures start from an all-green suite. |
| Lint baseline | `npm run lint` → **19 errors, 7 warnings** (concentrated in UI/hooks, consistent with §3's "do not carry the UI forward"). Recorded as baseline; fixing is M2's job. |
| Dirty tree | Matches Open Q B4 exactly: 5 modified files (`assets/plants/IMAGE_SOURCING.md`, `docs/adr/0007-vibe-atmospheres.md` +69 lines, `src/components/vibes/art.ts`, `conservatory-background.tsx` ~+100, `src/data/plants.json` ~19 lines), plus untracked: `Web/` (52K), Facebook scrape (`(2) Facebook.html` 3.7M + `_files/` 24M), `assets/plants/Images/` (2.4M), 5 loose PNGs (~37M total, largest 14M), `deliverables/` (incl. **the master plan docx itself — untracked**), `docs/design-system.md`, `src/components/vibes/canopy.ts` + its test. |
| **NEW — offsite gap** | **`main` is 14 commits ahead of `origin/main`; `verdict-overhaul` (1 further commit) has no remote branch; the repo has zero tags.** Essentially all recent work exists on one machine. This is now the single most urgent M0 item — before the worktree snapshot, even. |
| Ignored-but-valuable | `Skill docs/` (28K: `domain-modeling`, `grill-with-docs`) shows `!!` in `git status --ignored` yet `git check-ignore -v` matches no rule — resolve the anomaly during execution; the tar archive (R2) catches it regardless. `/ios`, `/android`, `expo-env.d.ts` are generated (regenerable — do not preserve). No `.env*` files exist. |
| Reproducibility | `package-lock.json` exists → `npm ci` works. **No hosted CI** (`.github/workflows/` absent): every "green" in this plan means a **local** run; a required-checks gate is M2 scope (§11). |
| User tables | Exactly three: `builds`, `build_photos`, `care_marks` (`src/db/schema.ts:35,92,111`). Backup envelope `STORE_SCHEMA_VERSION = 2` (`src/db/migrate.ts:23`); photos excluded from backup by design (`src/db/backup.ts:6-11`). SQLite file: `terrarium.db` (`src/db/client.expo.ts:21`). |
| Corpus stats | `plants.json` = `{schemaVersion, plants[201]}`. Coverage verified: `slug`/`scientificName`/`sources`/`image` 201/201, `plantType` 200, `substrateTags` 200, `toxicity` **78**, `imageCredit`/`imageLicense` **5**. (Confirms Open Q A5/A6.) |

## 3. Runbook — sequenced steps

Each step is independently checkable and leaves the suite green. Order is load-bearing: R0–R3 are pure preservation (after them nothing can be lost), R4 proves reproducibility, R5 freezes behavior, R6–R7 capture data, R8 records decisions, R9 is the spike (parallelizable with R5–R8).

**Ground rule for the whole phase:** the owner should pause in-flight vibe/canopy edits until R1 lands — the snapshot is point-in-time. If work continues after R1, re-run R1 before R10.

### R0 · Push existing history offsite (do this first, it's one command)

```bash
git push origin main verdict-overhaul
```

Closes the 14-unpushed-commits gap. Non-destructive, no tree changes. Verify: `git log origin/main..main` and `git log origin/verdict-overhaul..verdict-overhaul` both empty.

### R1 · Worktree snapshot — without disturbing the working tree

The owner is mid-work; the snapshot must not clean, stash, or checkout anything. Use a temporary index so the working tree and real index are untouched:

```bash
cd "$(git rev-parse --show-toplevel)"
export GIT_INDEX_FILE="$(git rev-parse --git-dir)/m0-snapshot-index"
cp "$(git rev-parse --git-dir)/index" "$GIT_INDEX_FILE"
git add -A                      # everything untracked + modified, per .gitignore
git add -f "Skill docs"         # force the ignored-by-status dir (see §2 anomaly)
git status --ignored --porcelain | grep '^!!'   # review: anything valuable still excluded?
TREE=$(git write-tree)
SNAP=$(git commit-tree "$TREE" -p HEAD -m "m0: worktree snapshot 2026-07-11 — in-flight vibes/canopy work, plants.json edits, sourcing scrape, deliverables (see ADR 0029)")
git branch m0/worktree-snapshot "$SNAP"
git tag -a baseline/worktree-2026-07-11 -m "M0 worktree snapshot" "$SNAP"
unset GIT_INDEX_FILE; rm -f "$(git rev-parse --git-dir)/m0-snapshot-index"
git push origin m0/worktree-snapshot baseline/worktree-2026-07-11
```

Notes:
- `git add -A` under a temp index stages the Facebook scrape (~28M) and the 5 PNGs (~37M). Largest single file is 14M — under GitHub's 100M hard limit; the push is ~70M once. This is deliberate: the snapshot must be *lossless*, and a snapshot branch that never merges keeps the noise out of `main`'s history. If the owner objects to repo weight, the fallback is: exclude `assets/plants/(2) Facebook*` + `Images/` from `git add` and rely on the R2 tar for those — record whichever was chosen in ADR 0029.
- Porcelain fallback (if the plumbing feels risky): `git checkout -b m0/worktree-snapshot && git add -A && git add -f "Skill docs" && git commit && git checkout verdict-overhaul && git cherry-pick -n m0/worktree-snapshot && git reset` — restores the dirty state exactly (modified files re-modified, untracked back to untracked). The temp-index route is preferred because it never moves HEAD.
- Verify: `git show --stat m0/worktree-snapshot` lists every file from §2's dirty-tree row; working tree still shows the same `git status` as before R1.

### R2 · Belt-and-braces filesystem archive (catches what git rules exclude)

```bash
cd "$(git rev-parse --show-toplevel)/.."
tar --exclude='terrarium-v2/node_modules' --exclude='terrarium-v2/ios' \
    --exclude='terrarium-v2/android' --exclude='terrarium-v2/.expo' \
    -czf terrarium-v2-m0-archive-2026-07-11.tar.gz terrarium-v2
shasum -a 256 terrarium-v2-m0-archive-2026-07-11.tar.gz > terrarium-v2-m0-archive-2026-07-11.sha256
```

Includes `.git` (history, both branches, tags) and every ignored-but-real file (`Skill docs/`, `.claude/settings.local.json`). **The owner moves both files somewhere off this machine** (cloud drive / external disk) — that placement is the "protected recovery point" living in a second failure domain. Record the destination in `deliverables/m0-baseline/BASELINE.md`.

### R3 · Protected baseline tags

```bash
git tag -a baseline/pre-migration -m "M0 protected baseline: last committed state before migration work (suite 413 green, typecheck green)" 49f834f
git push origin baseline/pre-migration
```

Two tags now exist with distinct meanings — record both in ADR 0029:
- `baseline/pre-migration` → `49f834f`, the last *committed, suite-green* state ("the current app" as far as git history knows).
- `baseline/worktree-2026-07-11` → the snapshot commit (R1), the *actual* machine state including in-flight work.

Optionally create a private GitHub Release on `baseline/pre-migration` and attach the R2 tarball — gives the archive a second offsite home. (Owner's call; releases are visible to repo collaborators.)

### R4 · Runnable-build evidence (App. C "runnable archived build")

From a **fresh clone** at the tag (proves nothing depends on this machine's state):

```bash
git clone --branch baseline/pre-migration https://github.com/Pankernaught/terrarium-v2.git /tmp/m0-verify
cd /tmp/m0-verify && npm ci
npm run typecheck && npm run test:run     # expect: green, 413 tests
npx expo prebuild --platform ios && npx expo run:ios   # boots on simulator
```

Evidence: paste command outputs + a simulator screenshot into `deliverables/m0-baseline/BASELINE.md`. Also archive the JS bundle: `npx expo export --platform ios --output-dir /tmp/m0-export` → tar into the R2 archive location. (A signed .ipa via EAS is *not* required — the plan's bar is "runnable archived build", and clone+`npm ci`+boot is the reproducible form of that; note this interpretation in BASELINE.md.)

### R5 · Golden fixtures — see §4 for the full spec

Additive only: new files under `src/logic/__tests__/golden/` + one script. Exit: `npm run test:run` green **including** the new golden suite, twice in a row (determinism check).

### R6 · Representative DB + backup + media — see §5

### R7 · 201-name migration corpus — see §6

### R8 · Founding decision records — see §7

### R9 · iNaturalist adapter spike (throwaway) — see §8

### R10 · Close out

Fill the exit checklist (§9 below) in `deliverables/m0-baseline/BASELINE.md`, get the owner's sign-off on the ADRs (App. C "approved decision records"), update the migration handoff, and commit the M0 artifacts (`deliverables/m0-baseline/`, `src/logic/__tests__/golden/`, `docs/adr/00{18..29}-*.md`) on `verdict-overhaul` — still no deletion, no behavior change.

## 4. Golden-fixture capture spec (R5)

**Purpose:** freeze the engines' *observed* behavior so M1's extraction and every later phase can prove "zero behavior change" mechanically (§15 item 2). These are characterization tests: they assert what the code *does*, not what it should do.

**Where they live:** `src/logic/__tests__/golden/` —
- `catalog.snapshot.json` — a **frozen copy** of `src/data/plants.json` taken at capture time. Fixtures resolve slugs against this copy, never the live catalog, so a future catalog edit cannot silently shift fixtures (hermeticity is the point). ~10.7k lines; committed.
- `scenarios.ts` — the input matrix (§4.2), built with plain object literals + slugs into the snapshot catalog. All dates pinned (`createdAt = 2026-01-15T12:00:00Z`, `now = 2026-02-01T12:00:00Z`); `buildCareSchedule`'s `now` parameter is always passed explicitly (`careSchedule.ts:242` defaults to real `new Date()` — never rely on it).
- `fixtures/<engine>.json` — captured outputs, one file per engine, keyed by scenario id. JSON (not inline vitest snapshots) so they are diffable in review and survive the M1 file moves as plain data.
- `golden.test.ts` — for each engine × scenario: run the entry point, deep-equal against the fixture. When `UPDATE_GOLDEN=1` is set, (re)write the fixture files instead of asserting.

**Regeneration policy (goes in ADR 0029):** `UPDATE_GOLDEN=1` is legitimate exactly once — at M0 capture. Afterward any regeneration is a *recorded decision* (ADR or plan-cited commit explaining which behavior changed and why); M1 must pass with fixtures **unchanged**. The first intended regeneration point is M4's slug→profileId reforge (Open Q A1).

### 4.1 Engines and exact entry points to capture

| # | Engine (§15 name) | Entry points (verified) | Output captured |
|---|---|---|---|
| 1 | Compatibility | `checkGroup(plants, container)` (`compatibility.ts:366`); `deriveConsensus(plants)` (`:153`); `scorePlantVsConsensus(plant, consensus, container?)` (`:308`) | full `GroupReport`; consensus profile; per-plant score for 3 representative plants per scenario |
| 2 | Verdict + eco | `summarizeVerdict(report, plantCount)` (`verdict.ts:33`); `scoreBuild(build, plants)` (`score-build.ts:49`); `ecoBand`/`ecoBandLabel` (`eco.ts:27,34`) | `VerdictSummary`; full `ScoredBuild` incl. `diagnostic`/`empty` paths; band boundaries at scores 0/19/20/49/50/79/80/100 |
| 3 | Container math | `computeVolumeL`, `floorAreaCm2`, `dimensionsToStr`+`parseDimensionsStr` round-trip, `defaultLayerDepths(plants, volumeL)`, `containerProfile(...)`, `recommendContainerDimensions(plants)` (`containers.ts:51,81,111,129,214,260,310`) | numeric outputs + thrown-error messages for the invalid-shape/dimension cases (errors are behavior too) |
| 4 | Substrate | `mixSubstrate(mix)`, `perchedWaterTable(...)`, `describeMix(stats)`, `formatMixRecipe(...)` (`substrateMixer.ts:111,163,204,230`); `SUBSTRATE_PROPERTIES`/size-class constants (`substrate-matrix.ts:30,131`) | `MixStats` (incl. `null` for empty mix); PWT verdicts incl. a triggering layering; recipe strings; a hash/copy of the matrix constants (they are data-as-code — ADR 0015) |
| 5 | Care | `generateCareGuide(plants, container)` (`care.ts:34`); `buildCareSchedule(plants, container, createdAt, overrides?, now)` (`careSchedule.ts:237`); `volumeBucket` (`:189`); `nextDueAfter` (`:312`); `planNotificationBudget(...)` (`:357`) | `CareTip[]`; full `CareTask[]` (cadences, settle-in one-time task per ADR 0014); bucket boundaries; budget plan at/over `PENDING_BUDGET`/`IOS_PENDING_CAP` |
| 6 | Build guide | `generateBuildGuide(plants, container, opts)` (`guide.ts:93`) | `BuildStep[]` in **both** unit systems (opts carry units — `guide.ts:85`); empty-plants throw message |
| 7 | Export | `resolveBuildSummary(build, plants)` (`export-txt.ts:61`); `generateTextSummary(data)` (`:85`); `formatExportDate` edge values (`:43`) | resolved summary; the **byte-exact** text block (doc comment promises v1 layout parity — that string is the contract) |
| 8 | Recommend + environment + placement | `recommend(...)` (`recommend.ts:15`), `plantFitScore(...)` (`:65`), `deriveEnvelope(plants)` (`environment.ts:30`), placement clamp/move/scale/upsert/default (`placement.ts:56-119`) | second tier — cheap, and all sit on the A1 slug blast-radius, so freeze them too |
| 9 | Backup payload | `exportBackup(db, appVersion)` (`backup.ts:123`) against a node-driver DB seeded with the §5 representative content; `migratePayload` v1→v2 (`migrate.ts`) | envelope with `exportedAt` **normalized** (the one non-deterministic field, `backup.ts:132`); migrated-payload shape for a hand-written v1 envelope |

Not captured: `browse-filter`/`glossary-*`/`plant-glyphs`/`units` — already property-tested, UI-facing, and slated for M5/M10 rework; the six §15 engine families above are the contract. (`substrate-matrix` has no test file today — the fixture in row 4 closes that gap.)

### 4.2 Scenario matrix (minimum set)

Deterministic, built from `catalog.snapshot.json` slugs. At minimum:

1. **closed-tropical-rect** — 4 compatible humid plants, `rectangular` 30×20×25, closed; the happy path.
2. **open-arid-cyl** — 3 arid plants, `cylindrical` ⌀25×20, open.
3. **tall-cylinder** — tall/narrow ⌀12×40 (volume-vs-floor-area divergence, `containers.ts:74-77`).
4. **single-plant** — one plant (consensus-of-one edge).
5. **survival-clamp** — one plant whose survival fails the consensus (score ≤20 clamp + dominant-trait listing, ADR 0017).
6. **split-tie** — a group engineered to tie → split warning (ADR 0017).
7. **crowded** — enough plants to trip footprint/capacity warnings.
8. **sparse-fields** — plants lacking `toxicity`/`plantType` (78/201 + 200/201 coverage, Open Q A6).
9. **empty-build** — `plantSlugs: []` → score 100 + `empty: true` (v1 parity, `score-build.ts:59-64`).
10. **broken-build** — unknown slug; missing container → each `diagnostic` path (`score-build.ts:44-47`).
11. **substrate-pwt** — mix + layering that triggers the perched-water-table warning (ADR 0015); plus an akadama-bearing mix and an empty mix.
12. **care-overrides** — custom `intervalDays` + a muted task + settle-in evaluated both before and after the age gate (two `now` values).
13. **notification-cap** — enough builds/tasks that `planNotificationBudget` must drop/fold past the iOS 64 cap.
14. **export-roundtrip** — a full build (tags, placements, mix, overrides, charcoal) through `resolveBuildSummary` → `generateTextSummary`, pinned dates.

Execution may add scenarios; it must not remove these. Each gets a one-line comment stating what behavior it pins.

## 5. Representative DB + backup + media capture (R6)

**What the sample must exercise** (content requirements, so restore/migration tests in M2/M9 have something real to chew on): ≥6 builds spanning both shapes; ≥1 with custom `substrateMix` + `charcoalDepth`; ≥1 with `careOverrides` (a custom interval *and* a muted task); placements on ≥2 builds; tags + description; ≥8 photos across ≥2 builds with a `primaryPhotoId` set; care history with completed marks, a future-due mark, a done settle-in, and ≥1 plant-scoped mark (`plantSlug` set); ≥1 build containing a no-image plant and ≥1 with a toxicity-flagged plant.

**Capture procedure:**
1. On the owner's device/simulator, create or verify the content above in the app.
2. **Backup JSON:** in-app export (share flow, `src/lib/backup-io.ts`) → save as `deliverables/m0-baseline/backup-representative-v2.json`. Contains no photo binaries by design (`backup.ts:6-11`) — that gap is *the* §3 finding M8 exists to fix; state it in BASELINE.md rather than papering over it.
3. **Raw SQLite:** simulator: `xcrun simctl get_app_container booted <bundleId> data`, copy `Documents/SQLite/terrarium.db` (`client.expo.ts:21`; Expo Go instead keeps it under `ExponentExperienceData`). Physical device without a simulator copy: acceptable gap — the validated JSON export is the restore path; record which was captured.
4. **Media:** copy the `build_photos` originals out of the sandbox into the R2 archive location (not committed — private photos). Commit only `deliverables/m0-baseline/media-manifest.json`: `{photoId, buildId, filename, bytes, sha256}` per photo.
5. **Verify the capture:** one-off node script (or test) that runs `restoreBackup` (`backup.ts:163`) on the captured JSON against a fresh node-driver DB and asserts the returned `{builds, careMarks}` counts match the manifest. Output pasted into BASELINE.md.

## 6. The 201-name migration corpus (R7)

The corpus is the reconciliation ground truth for M4 and the licensing reality-check for M3.

1. `catalog.snapshot.json` (R5) already freezes the full records.
2. Generate `deliverables/m0-baseline/corpus-201.csv` — one row per record: `slug, commonName, scientificName, sources (|-joined), image, imageCredit, imageLicense, toxicity, plantType`. Small node script committed next to it (`corpus-extract.mjs`) so it's re-runnable.
3. Append the coverage block (from §2: images 124/201 files on disk, credit/license 5/201, toxicity 78/201, plantType 200/201, substrateTags 200/201) + a `sources`-domain tally (which sites the 201 records actually cite) to BASELINE.md — M3's licensing design should start from that tally.

## 7. Founding decision records (R8) — App. B → ADRs

Project convention: decisions live in `docs/adr/`, sequential (owner feedback; next free number is 0018). Author all twelve as **proposed**, then the owner flips to **accepted** — that flip is App. C's "approved decision records" evidence. Use the existing ADR format (docs:ADR-FORMAT skill / 0008+ house style). Each cites App. B and stays one page: context → decision (App. B's recommended answer) → consequences. Where an App. B row overlaps a §14 owner decision (backend, offline depth), the ADR records the *deferral and its gate*, not a premature choice.

| ADR | Title (App. B row) | Decision to record (App. B recommended answer) |
|---|---|---|
| 0018 | Launch category | Botanical terrariums, mosses, fungi, springtails, isopods; animal types disabled (hooks per §6.3) |
| 0019 | Client platform | Stay on Expo SDK 56 this increment; upgrades only as explicit work |
| 0020 | Offline strategy | SQLite local-first + outbox; server authoritative only for shared/public policy (gate: §14/C2) |
| 0021 | Backend | Typed BFF + managed relational DB + object storage + durable jobs — **when Phase 4 (M11) needs it**, not before (gate: §14/C1) |
| 0022 | External taxonomy | Provider adapter; an external id is a reference, **never** the internal primary key |
| 0023 | Care data | Sourced trait assertions + versioned rules; never occurrence-derived |
| 0024 | Media | User originals in controlled storage; remote media only under an explicit license policy |
| 0025 | Computer vision | Candidate suggestions only; benchmark-gated (M5), feature-gate off on failure |
| 0026 | Community | Structured build snapshots + diagnosis templates before any generic feed |
| 0027 | Marketplace | Deferred until trust/moderation/legal/shipping controls exist (M13) |
| 0028 | Legacy code | Extraction-first; delete only after migration + vertical-slice gates (M9/M10) |
| **0029** | **Demolition baseline & fixture policy** (M0's own record) | What the two baseline tags protect and where the archives live; the golden-fixture regeneration policy (§4); the R1 scope choice (scrape in/out of git); **the queued owner decision on the in-flight vibes/canopy work** (Open Q B2 — keep vs abandon, decide before M10; both options preserved by the snapshot); note ADR 0007's status/body mismatch (Open Q B1) without editing 0007 itself — it is mid-edit and captured by the snapshot. |

Explicitly **not** here: the B3 supersession records (0016←0017, 0007 status) — outline assigns those to M1/M4; 0029 only *notes* the facts.

## 8. iNaturalist adapter spike brief (R9 — throwaway, feeds M3)

**Form:** standalone scripts under `tools/spike-inat/` (committed, clearly headed "M0 spike — throwaway; do not import from app code"). No app wiring, no new dependencies beyond fetch. API v2 per App. D refs [6]–[9]; identify with a UA string; stay well under ~1 rps / a few hundred requests total.

**Questions it must answer** (findings → `deliverables/m0-baseline/inat-spike-findings.md`):
1. **Name resolution:** for a stratified 20-name sample from `corpus-201.csv` (plain species / cultivar-suffixed / trade names / mosses), what does `taxa/autocomplete` + `taxa/{id}` return — hit rate, rank/ancestry shape, where cultivars land? (Feeds M4's matched/ambiguous/cultivar/unmatched report design.)
2. **Licensing reality:** license distribution (CC0/BY/BY-NC/ARR) across default + top photos for those taxa; what attribution fields come back. (Feeds M3's license filter and the §7 landmine assessment.)
3. **Observations aggregate:** response shape and cost of one `observations` histogram/aggregate call per taxon.
4. **CV access:** what `computervision/score_image` actually requires (auth/token/approval) — *answer, don't assume*; if inaccessible without special access, that is an M3/M5 design input.
5. **Rate behavior:** measured latency, rate headers, and one deliberate 429 (if cheaply reachable) — is backoff-and-retry viable at our budget?
6. **Cacheability:** ETag/Cache-Control presence per endpoint (informs §7 TTLs).

## 9. Exit-criterion checklist (App. C Phase 0)

| App. C item | Satisfied by | Evidence lives at |
|---|---|---|
| ☐ Protected recovery point | R0 push; R1 snapshot branch+tag pushed; R2 tar + sha256 offsite; R3 `baseline/pre-migration` | `git ls-remote --tags origin`; BASELINE.md archive-location note |
| ☐ Runnable archived build | R4 fresh-clone: `npm ci` + typecheck + 413 tests green + simulator boot; exported JS bundle archived | BASELINE.md (logs + screenshot) |
| ☐ Representative DB, backup, media set | R6 JSON export + `terrarium.db` copy + media originals w/ manifest; restore-verified counts | `deliverables/m0-baseline/` + R2 archive |
| ☐ Golden fixtures | R5 suite green twice consecutively, incl. all §4.1 rows and §4.2 scenarios | `src/logic/__tests__/golden/`; `npm run test:run` output in BASELINE.md |
| ☐ Approved disposition & decision records | R8 ADRs 0018–0029 flipped to accepted by owner | `docs/adr/`; sign-off note in BASELINE.md |
| *(M0 extra)* corpus + spike | R7 corpus-201.csv + coverage; R9 findings memo | `deliverables/m0-baseline/` |
| *(M0 extra)* no user work lost | R1 verified lossless; working tree undisturbed; owner confirms | BASELINE.md |

## 10. Risks & unknowns for execution

- **The tree keeps moving.** In-flight vibe work during M0 invalidates the snapshot's "current state" claim — pause it or re-snapshot before R10 (cheap: R1 is rerunnable with a new date suffix).
- **`Skill docs/` ignore anomaly** (§2): if `git add -f` still won't stage it, find the rule (`git config core.excludesFile`, `.git/info/exclude`) during R1; the R2 tar covers it either way.
- **Push size:** ~70M once. If origin rejects or the owner balks, use the R1 fallback scope (scrape via tar only) — decision goes in ADR 0029.
- **Device data access:** raw `terrarium.db` capture assumes a simulator install; if the real data is device-only, the JSON export is the capture and the gap is recorded (§5.3).
- **iNat CV endpoint access** may require credentials we don't have — the spike's job is to report that, not work around it.
- **Owner availability** gates the App. C "approved" checkbox (R8) and the archive-destination choice (R2). Everything else is executable solo.
- **Fixture flakiness risk is low but real:** any hidden `Date.now()`/locale dependence in engines will show up as the R5 "green twice" check failing — treat as a determinism bug to *pin* (inject the value), never as license to loosen an assertion (First-PR boundary: no algorithm change).

---

*Next after M0 executes: Pass 2 · M2 (normalized schema + migration harness — settle Open Q A2/A4 on paper), per the outline's recommended order.*
