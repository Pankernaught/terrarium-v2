# M0 baseline — evidence & exit checklist

*Living evidence doc for M0 execution (runbook: `deliverables/migration/M0-preserve-characterize.md`). Started 2026-07-11. **All solo-executable M0 work (R0–R5, R7–R9) is complete and committed.** Three owner-gated items remain before M0 formally closes — see the Owner-action queue at the bottom.*

## Session-2 wrap (2026-07-11) — solo execution complete

R5, R7, R8, R9 landed this session (R0–R4 were session 1). Commits on `verdict-overhaul`: `8370b7d` (R5 golden suite), `4a68f14` (R7 corpus), `9347189` (R8 ADRs 0018–0029), `e76559e` (R9 iNat spike). Full suite **422 tests / 38 files, green twice**; typecheck + eslint clean. Working tree verified **byte-identical** to session start — the owner's in-flight vibes/canopy work (5 modified + untracked items) is untouched, so the R1 snapshot still holds and no re-snapshot is needed. **The only things between here and M0 close are the three owner gates below.**

## App. C Phase-0 exit checklist (state as of 2026-07-11, session 2)

| App. C item | State | Evidence |
|---|---|---|
| Protected recovery point | **☑ git side done · ☐ owner move pending** | R0 push verified (0 unpushed on `main`, `verdict-overhaul`); R1 snapshot branch `m0/worktree-snapshot` + tag `baseline/worktree-2026-07-11` pushed; R3 tag `baseline/pre-migration` → `49f834f` pushed; R2 tar + sha256 created (below) — **owner must move both files off-machine and record the destination here** |
| Runnable archived build | **☑ DONE** | Fresh clone at tag: `npm ci` OK; typecheck green; **408 tests / 36 files, 0 failures**; Release build 0 errors, installed + launched on iPhone 17 Pro; boot screenshot `simulator-boot-2026-07-11.png`; JS bundle archived beside the R2 tar |
| Representative DB, backup, media set | ◐ **synthetic done · owner-gated for real data** | R5's `backup` golden fixture seeds a §5-mirroring node DB (6 builds both shapes, mix+charcoal, overrides incl. mute, placements, 4 care-mark kinds incl. plant-scoped, 2 photos proving exclusion) → export + restore round-trip verified in CI. Real on-device capture (backup JSON, `terrarium.db`, media manifest) still needs the owner (runbook §5/R6) |
| Golden fixtures | **☑ DONE** | `golden.test.ts` + 9 fixture files + `README.md`; captured via `UPDATE_GOLDEN=1`; suite **green twice** (38 files / 422 tests). Regeneration policy → ADR 0029 |
| Approved disposition & decision records | ☐ **authored (R8) · owner accept pending** | ADR 0018–0029 authored as *proposed*; owner flips to *accepted* (that flip is App. C's "approved" evidence) |
| *(M0 extra)* corpus + spike | **☑ R7 DONE · ◐ R9 spike** | R7: `corpus-201.csv` + `corpus-extract.mjs` + tally (below). R9: iNat spike scripts + `inat-spike-findings.md` |
| *(M0 extra)* no user work lost | **☑ verified at session-2 wrap** | R1 snapshot lossless; working tree **byte-identical** to session start after all R5–R9 commits (`git status --porcelain` unchanged — commits touched only golden/`deliverables`/`docs/adr/0018+`/`tools/spike-inat`). Owner's final confirmation still owed at close-out |

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

## R5 · Golden fixtures — DONE (session 2, 2026-07-11)

Suite: `src/logic/__tests__/golden/` — `catalog.snapshot.json` (frozen 2026-07-11 `plants.json`), `scenarios.ts` (input matrix), `golden.test.ts`, `README.md` (regeneration policy), and **9 fixture files** (one per engine family: compatibility, verdict, containers, substrate, care, guide, export, recommend, backup). Captured with `UPDATE_GOLDEN=1`; **suite green twice consecutively** (38 files / 422 tests / 0 failures — the +14 over R4's 408 = the 9 golden `it`s live in one file plus the 5 in-flight canopy tests present in the dirty tree). Typecheck + eslint green on the new files.

What's pinned (beyond happy-path outputs): every engine `throw` message (empty group, malformed geometry through `scoreBuild`, container dimension errors, `migratePayload` refuse-newer + missing-step); the ADR 0017 survival clamp (echeveria → 0, matching plants keep 100) and split-tie path; the crowding incompatible rung; the settle-in **strict-`<`** age gate at exactly +14 d and −1 ms; the notification budget at the 50/64 caps; the TXT export byte-exact block incl. the `N/A` render; the substrate matrix constants as data-as-code; and the backup envelope with `exportedAt` normalized + photos excluded, restore counts, and the v1→v2 identity migration. Committed `8370b7d`.

**Determinism note:** no hidden `Date.now()`/locale drift surfaced — the two consecutive green runs are byte-identical. `buildCareSchedule` always receives `now` explicitly; `exportBackup.exportedAt` is the only non-deterministic field and is normalized before compare.

## R7 · 201-name migration corpus — DONE (session 2, 2026-07-11)

- **`corpus-201.csv`** (this folder, 201 rows) generated by the committed, re-runnable **`corpus-extract.mjs`** — reads the **frozen** `catalog.snapshot.json` (not live `plants.json`) so the corpus is pinned to the M0 baseline. Columns per runbook §6: slug, commonName, scientificName, sources (|-joined urls), image, imageCredit, imageLicense, toxicity, plantType.
- **Coverage:** slug/commonName/scientificName/sources/image fields 201/201 · plantType 200/201 · toxicity 78/201 · imageCredit+imageLicense **5/201**.
- **Images on disk: 129/201** resolvable by the app (slug-keyed `assets/plants/<slug>.jpg|png` via the generated `PLANT_IMAGES` map — the `image` *field* is authored intent, not the resolution key). 129 = the runbook's 124 committed files + the 5 untracked owner-dropped PNGs in the worktree (preserved on the snapshot branch). 72 records render the placeholder.
- **Sources-domain tally (465 links, 43 hosts)** — M3's licensing design starts here:
  | Host | Links | Note |
  |---|---|---|
  | powo.science.kew.org | 200 | taxonomy authority; near-universal (200/201 records) |
  | en.wikipedia.org | 117 | article links |
  | plants.ces.ncsu.edu | 79 | NCSU extension care pages |
  | gardenia.net | 11 | |
  | terrariumtribe.com | 8 | |
  | ohiomosslichen.org / rhs.org.uk | 4 each | |
  | *36 further hosts* | ≤3 each (42 total) | hobby shops, orchid societies, aquarium sites |

  Three institutional hosts (POWO / Wikipedia / NCSU) carry **396/465** links; the long tail is 40 hobbyist/commercial/society hosts at ≤11 links each. **M3 takeaway:** a licensing pass that clears those three authorities covers ~85% of citations, and the tail needs per-host handling (many are shops/blogs with no clear reuse license). Note these are *care-source* citations, **not** image licenses — image reuse is a separate question the R9 iNat spike probes (only 5/201 records carry `imageCredit`/`imageLicense` today).
- **Re-runnable:** `node deliverables/m0-baseline/corpus-extract.mjs` (optionally pass an alternate catalog path); prints the coverage line + full domain tally to stdout.

## Owner-action queue (M0) — the only work remaining to close M0

These three are the entire gap between "solo M0 done" and "M0 closed." None is
solo-executable; all three need the owner.

1. **R2 offsite move.** Move `terrarium-v2-m0-archive-2026-07-11.tar.gz` + its `.sha256` (and the R4 JS-bundle tar beside them) to a second failure domain, and record the destination in the R2 section above (`<destination — fill in>`).
2. **R6 device capture** (runbook §5). Real on-device backup JSON + `terrarium.db` + media manifest. *Note:* R5's `backup` golden fixture already exercises the export/restore/migrate paths against a §5-mirroring **synthetic** node DB, so M2's restore work is unblocked; R6 supplies **real** data for confidence, not a blocker.
3. **R8 acceptance flip.** Review ADRs 0018–0029 (`docs/adr/`) and flip `status: proposed` → `accepted`. That flip is App. C's "approved decision records" evidence. ADR 0018/0027 also touch §14/C3 (free/premium) and §14/C1/C2 gates the owner may want to resolve alongside.

**Ground rule (still in force):** pause in-flight vibe/canopy edits until M0 closes, or R1 is re-run (cheap) before close-out. Verified untouched as of the session-2 wrap.
