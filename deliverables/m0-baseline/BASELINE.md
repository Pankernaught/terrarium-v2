# M0 baseline — evidence & exit checklist

*Living evidence doc for M0 execution (runbook: `deliverables/migration/M0-preserve-characterize.md`). Started 2026-07-11; M0 execution is **in progress** — checklist states below are current, not final.*

## App. C Phase-0 exit checklist (state as of 2026-07-11, session 1)

| App. C item | State | Evidence |
|---|---|---|
| Protected recovery point | **☑ git side done · ☐ owner move pending** | R0 push verified (0 unpushed on `main`, `verdict-overhaul`); R1 snapshot branch `m0/worktree-snapshot` + tag `baseline/worktree-2026-07-11` pushed; R3 tag `baseline/pre-migration` → `49f834f` pushed; R2 tar + sha256 created (below) — **owner must move both files off-machine and record the destination here** |
| Runnable archived build | **☑ DONE** | Fresh clone at tag: `npm ci` OK; typecheck green; **408 tests / 36 files, 0 failures**; Release build 0 errors, installed + launched on iPhone 17 Pro; boot screenshot `simulator-boot-2026-07-11.png`; JS bundle archived beside the R2 tar |
| Representative DB, backup, media set | ☐ **owner-gated** | R6 needs the owner's device/simulator content (runbook §5) |
| Golden fixtures | ◐ in progress (~30%) | `catalog.snapshot.json` frozen + `scenarios.ts` written; fixtures/, `golden.test.ts`, capture + green-twice still to do |
| Approved disposition & decision records | ☐ not started | R8 authors ADR 0018–0029 as *proposed*; owner flips to *accepted* |
| *(M0 extra)* corpus + spike | ☐ not started | R7, R9 |
| *(M0 extra)* no user work lost | **☑ so far** | R1 verified: `git status` byte-identical before/after snapshot; owner confirmation still owed at close-out |

## R0 · Offsite push (2026-07-11) — DONE

`git push origin main verdict-overhaul` → `main` 43b2fc5..9e853a0 (the 14 held-back commits), `verdict-overhaul` created on origin. Verified: `git log origin/…..…` empty for both.

## R1 · Worktree snapshot — DONE

- Snapshot commit **`2f165174d4f2717a523d4c29776ba187471db55f`**, parent `98a092b`, via the runbook's temp-index route (HEAD, real index, working tree all untouched — `git status --porcelain` identical before/after).
- Branch `m0/worktree-snapshot` + annotated tag `baseline/worktree-2026-07-11`, both pushed (~70 MB).
- **120 files, 16,321 insertions**: all 5 modified files + every untracked item from runbook §2 verified present (spot-checked: master-plan docx 39,952 B, canopy.ts, canopy.test.ts, design-system.md, 5 loose PNGs, Images/, Facebook scrape, Web/).
- **Deviation (recorded for ADR 0029):** skipped `git add -f "Skill docs"`. Anomaly **resolved**: `Skill docs/` contains only `.DS_Store` files (zero other files; `.gitignore` ignores `.DS_Store` at lines 30/47; git prints a directory as `!!` when *everything inside* is ignored, while `check-ignore` on the dir itself matches no rule). Nothing of value to stage; the R2 tar carries it regardless.
- Full-scrape scope was used (Facebook scrape + PNGs in git, ~70 MB one-time push) — the runbook's default, not the fallback. Record in ADR 0029.
- Still-excluded after `add -A` (reviewed, all regenerable/junk): `node_modules/`, `ios/`, `android/`, `.expo/`, `.idea/`, `expo-env.d.ts`, `.DS_Store`s, `.claude/settings.local.json` (captured by R2 tar).

## R2 · Filesystem archive — created; owner move PENDING

- `"/Users/temp/Documents/My developed apps/terrarium-v2-m0-archive-2026-07-11.tar.gz"` — **165 MB**, 1,890 entries, excludes node_modules/ios/android/.expo, **includes `.git`** (both branches + all three tags), the master-plan docx, `Skill docs/`, `.claude/settings.local.json`.
- sha256 `04093869fbd95fc5d11ed263dd257e1389d1e3cd8db18ce49330ffdee1f22578` (sidecar `.sha256` file next to it).
- **OWNER ACTION:** move both files to a second failure domain (cloud drive / external disk) and record the destination here: `<destination — fill in>`.

## R3 · Protected baseline tags — DONE

| Tag | Points at | Meaning |
|---|---|---|
| `baseline/pre-migration` | `49f834f` | last committed, suite-green state before migration work |
| `baseline/worktree-2026-07-11` | `2f16517` | the actual machine state incl. in-flight vibes/canopy work |

Both verified on origin via `git ls-remote --tags`.

## R4 · Runnable-build evidence — DONE

From a fresh clone of `baseline/pre-migration` (detached at `49f834f`; the clone-time warning `refs/tags/baseline/pre-migration … is not a commit!` is benign — annotated-tag object vs commit):

- `npm ci` clean; `npm run typecheck` **green**; `npm run test:run` → **36 files / 408 tests / 0 failures**.
- **408 vs the runbook's 413 explained:** the runbook's count was taken in the dirty working tree, which vitest supplements with the *untracked* `src/data/__tests__/canopy.test.ts` (5 tests, in-flight vibes/canopy work). The committed tag legitimately has 36/408; the worktree-snapshot branch carries the other 5.
- **Simulator boot verified:** first attempt failed — `pod install` crashed during `expo run:ios` prebuild with `Encoding::CompatibilityError: Unicode Normalization not appropriate for ASCII-8BIT` (CocoaPods 1.16.2 / Ruby 4.0.5 under a non-UTF-8 shell locale; **environment quirk, not a repo defect** — fix is `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`). Retry: pods installed, Release build **0 errors**, app installed + launched on the iPhone 17 Pro simulator (`com.pankernaught.terrarium-v2`). Screenshot: **`simulator-boot-2026-07-11.png`** (this folder) — home screen renders the "No terrariums yet" empty state + all four tabs. The checkerboard bands are the **known placeholder vibe art** at this baseline (real-art swap is a recorded post-M0 item), not corruption. Toolchain: Xcode 26.5 (17F42), CocoaPods 1.16.2, Node v22.22.3.
- JS bundle: `npx expo export --platform ios` → 26 MB (`entry-3d0a0b305e0bafbb579ea6a20e35e58f.hbc`, 6.1 MB), archived as `terrarium-v2-m0-jsbundle-2026-07-11.tar.gz` (20 MB) + `.sha256` (`d474ab30…1699`) **beside the R2 tar** — rides the same owner offsite move.
- Interpretation note (per runbook): "runnable archived build" = fresh clone + `npm ci` + green checks + simulator boot + archived JS bundle; no signed .ipa required.

## R5 · Golden fixtures — IN PROGRESS (~30%)

Done: `src/logic/__tests__/golden/catalog.snapshot.json` (10,652-line frozen copy of working-tree `plants.json`, including the ~19 lines of in-flight edits — deliberately matches the R1 snapshot state); `scenarios.ts` (input matrix). Remaining: `golden.test.ts`, `fixtures/*.json` capture via `UPDATE_GOLDEN=1`, `README.md` (regeneration policy), suite green **twice**. Design decisions settled this session are recorded in the migration handoff to avoid re-derivation.

## Corpus coverage (re-verified 2026-07-11 in-session, matches runbook §2)

`plants.json` = `{schemaVersion: 1, plants[201]}`; slug/scientificName/sources/image 201/201; plantType 200; substrateTags 200; toxicity **78**; imageCredit/imageLicense **5**.

## Owner-action queue (M0)

1. **R2:** move the tar + sha256 offsite; record destination above.
2. **R6:** on-device capture session (runbook §5) — backup JSON, `terrarium.db`, media + manifest.
3. **R8:** review ADRs 0018–0029 once authored; flip *proposed* → *accepted*.
4. **Ground rule:** please pause in-flight vibe/canopy edits until M0 wraps — or R1 gets re-run (cheap) before R10.
