# Terrarium V2 — migration control doc

This file is the **cross-chat memory** for the v1 → v2 (React Native + Expo) rebuild. The
migration is split across many focused chats (one per phase) so no single chat has to hold the
whole thing. **Read this file + only the `Rebuild docs/` sections your phase brief points to —
do NOT read all four docs every time.** The detailed phase history lives in `CHANGELOG.md`;
**do NOT read it for forward work** — only when you need the *why* behind a specific past decision.

- **Spec (source of truth):** `Rebuild docs/` (decisions 1–18, fully grilled).
- **v1 reference oracle:** the sibling repo `../terrarium-app`, frozen at tag `v1-oracle`
  (`engine/` = the pure logic to port, `tests/` = the safety-net suite).
- **Toolchain:** Expo SDK 56, Expo Router, RN 0.85, React 19.2, Reanimated 4, Drizzle +
  expo-sqlite, zod 4, Vitest. Node 22 LTS lives in `~/.local`.

## How to continue (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). Read
> `MIGRATION.md` — the phase table + the carry-forward items + the distilled brief for the current
> phase — and only the `Rebuild docs/` rm -rf iossections that brief names. Do NOT read all four docs, and do
> NOT read `CHANGELOG.md` unless you need the *why* behind a past decision. You are doing **Phase N**.
> Use subagents for the self-contained chunks the brief lists (they keep this chat's context
> small). When the phase's Definition-of-Done passes: run the verification, commit, tag
> `v2-phase-N-complete`, update the phase table + refresh the last-completed-phase digest here +
> append the full session-log entry to `CHANGELOG.md`, and **write the next phase's distilled brief +
> this same kickoff prompt** at the bottom (move the superseded brief into `CHANGELOG.md`). Then stop.

## Phase status

| Phase | Goal | Chats | Status |
|---|---|---|---|
| 1 | Lock decisions · freeze v1 · Expo skeleton | 1 | ✅ **done** |
| 2 | Port the pure engine, test-first (+ primary/secondary) | 1 | ✅ **done** |
| 3 | Ship the data (versioned JSON, images, presets) | 1 | ✅ **done** |
| 4 | Local store (Drizzle/expo-sqlite) + repositories | 1 | ✅ **done** |
| 5 | Core screens + component library + export/backup | 2 | ✅ **done** — chat 1 (component library + 4 read-mostly screens) + chat 2 (TXT/PDF export + JSON backup/restore + planner shell) |
| 6 | Planner: 5-step flow + 2-D drag + 2-D preview | 2 | ✅ **done** — chat 1 (placement core + draft + Container/Substrate) + chat 2 (drag-to-place + Hardscape/Plants/Final + live Eco + end-to-end save) |
| 7 | Care reminders + photo timeline | 1 | ✅ **done** — careSchedule + slot-budget guard (pure) · care-marks repo · Care tab (per-terrarium toggle + mark-done) · local repeating notifications · date-grouped photo timeline |
| 8 | Substrate mixer (parallel to 7) | 1 | ✅ **done** — authored property matrix + pure parts-weighted mixer + `describeMix` · `substrateMix` column (+ schema-v2 identity migrate + guarded live-DB ALTER) · opt-in add-then-tune Substrate-step UI w/ live bars · build-guide recipe line |
| 9 | Premium polish | 1 | ⬜ **next** |

## Handoff protocol (every phase chat follows this)

1. Verify the phase **Definition of Done** (DoD).
2. `git add -A && git commit` with a clear message.
3. `git tag -a v2-phase-N-complete -m "..."`.
4. Update the **phase status** table above, refresh the **"Last completed phase" digest** here, and
   append the full **session-log entry** to **`CHANGELOG.md`**.
5. Write the **next phase's distilled brief** (goal · DoD · which doc sections to read · subagent
   plan · gotchas) at the bottom, followed by the kickoff prompt; move the now-superseded current
   brief into **`CHANGELOG.md`** (under "Archived phase briefs"). Then stop.

**Subagents:** a subagent runs in its own context and returns only a summary, so use them for
self-contained chunks (one engine module + its test suite; one isolated screen/component). Keep
cross-cutting design (the scoring rule, the DB schema) in the orchestrating chat.

---

## Where the full history lives

The detailed per-phase **session log** and the archived **distilled briefs** for completed phases
now live in **`CHANGELOG.md`**. That file is reference-only: **do NOT read it for forward work.**
Everything a new phase chat needs is here in `MIGRATION.md` — the phase table, the current phase
brief + kickoff, the carry-forward items below, and a one-paragraph digest of the last completed
phase. Open `CHANGELOG.md` only when you need the *why* behind a specific past decision.

## Carry-forward / open items (live across phases)

These outlive the phase that raised them — keep them in view regardless of the current phase.

- **Real plant photos = owner long-pole, NOT done (Phase 3, decision 18).** The accuracy-first
  CC/PD species-photo curation is owner work. Only the *scaffolding* shipped: every plant carries an
  `image: "plants/<slug>.png"` path; 67 clearly-marked placeholder SVGs in
  `assets/plants/_placeholders/`; a 67-row `assets/plants/IMAGE_SOURCING.md` worklist (all
  `Pending`); a CI guard on the path convention + license→credit + no `-NC`/`-ND`.
  `imageCredit`/`imageLicense` are authored **empty** — no attribution was fabricated. Plant heroes
  show the 🌿 fallback until real photos land (the one place to wire them in).
- **Toxicity notes are first-pass drafts (Phase 3, decision 8).** Drafted from standard references
  for the **owner to verify** (owner is source of record). Display-only; a blank note is never
  rendered as "safe."
- **v2.1 open question — via-secondary hard-cap (Phase 2, decision 15).** A single via-secondary
  distance-0 match currently scores 85 light / 93 moisture (inside the ≥80 "compatible" band) —
  faithful to the frozen −15/−7 penalty + the ≥80 band. Whether to **hard-cap the verdict at
  "caution"** for any via-secondary match is deliberately deferred to v2.1 (not forced by changing a
  frozen constant during the faithful port).
- **Device-verification backlog (every UI phase so far).** No iOS simulator in the build env and no
  RN component-test harness in v2.0, so the **on-device visual render** + the **measured 60fps drag**
  remain owner-iPhone tasks: dashboard, build-detail, Browse, plant view, the 5 planner steps + the
  drag, Care tab, photo timeline, a real notification firing, the camera/picker, and (**Phase 8**) the
  **Substrate-step mixer UI** — add-ingredient chips, the parts steppers, the four live bars, and the
  persisted mix flowing into the Final-step build-guide recipe line. Android fps is an unverified
  design budget.
- **Phase 6 top device check.** The per-sprite pan runs inside the planner's vertical `ScrollView` —
  confirm the drag claims the gesture cleanly (no scroll-steal); if it fights, add
  `blocksExternalGesture`/`simultaneousHandlers` (localized tuning, not a redesign).
- **Pre-existing template lint (out of scope, untouched).** 1 error in the Phase-1
  `use-color-scheme.web.ts` + a `guide.ts`/`_layout` warning predate the recent phases.

## Last completed phase — Phase 8 (digest)

**Phase 8 COMPLETE — tagged `v2-phase-8-complete`.** The opt-in **component-ratio substrate mixer** —
net-new data + engine + UI, the one phase explicitly optional for v2.0. New: the authored, provisional
**property matrix** `src/logic/substrate-matrix.ts` (4 ordinal-0–4 properties — aeration / waterRetention
/ nutrient / buffering, ⚠️ `particleSize` dropped — for all 9 components; co-located so `src/logic` stays
import-pure, drift-guarded by test); the pure **`src/logic/substrateMixer.ts`** (integer parts map →
parts-weighted-mean ÷4 → 0–1 bars; empty → null; single = its row; plus soft `describeMix` and an
injected-label `formatMixRecipe`). Persistence: a **nullish `substrateMix` JSON column** on `builds`
(Drizzle + DDL + draft + builds-repo + backup schema/mapper), **`STORE_SCHEMA_VERSION` → 2** with
`MIGRATIONS[1]` = identity (additive), and a **guarded live-DB `ALTER TABLE`** on open
(`ensureSubstrateMixColumn`, mirrored in the node test helper — `CREATE TABLE IF NOT EXISTS` can't add a
column). UI: the **add-then-tune, opt-in** Substrate step (ingredient chips → parts steppers + remove →
4 live bars, separate from the Eco meter) and the build-guide **recipe line** (`BuildGuideOptions.substrateMix`
→ "…2 parts coco coir, 1 part perlite… — an airy, moisture-retentive blend"; no recipe → unchanged).
**279 tests green** (+24); tsc/iOS-bundle clean, lint baseline unchanged; Phase-4 store/backup round-trip
still green. Device-only (not CI'd): the live Substrate-step render + the mix reaching the Final-step guide
on a phone. Full detail → `CHANGELOG.md` (§ Phase 8).

---

## ▶ NEXT — Phase 9 distilled brief: Premium polish (the v2.0 finish line)

**Goal.** Turn the Premium Design **§9 non-negotiables** from aspirations into **acceptance criteria**. This is the
**critical-path closer** (Phases 1→2→3→4→5→6→**9**); the app is feature-complete, so Phase 9 is a **cross-cutting
quality pass over the screens that already exist**, not new features. **1-chat** phase.

**What already exists (do NOT rebuild).**
- **The full app surface** — 4 tabs + planner (5 steps + 2-D drag) + build detail + Browse + plant view + Care +
  Settings/export/backup, all shipped Phases 5–8. Phase 9 **refines** these in place.
- **The component library + tokens** — `@/components/ui` (Card/Chip/Meter/EcoMeter/VerdictBand/StatStrip/Screen/…),
  `src/constants/theme.ts` (light+dark scales), `useTokens()`. Premium §3 tokens are already the single source — polish
  pulls from here, never a raw value.
- **`expo-haptics`** is wired (`@/components/ui/haptics`, used by steppers/planner). Phase 9 makes the haptic vocabulary
  **semantic + complete**, not decorative.
- **Never-color-alone is already partly honored** (Chip pairs tone with text/icon; VerdictBand has labels). Phase 9
  audits it **everywhere** and adds the colorblind-safe guarantee.
- **Presets exist** (`src/data/presets.ts`, decision 18) — the "start from a preset" onboarding path builds on them.

**Read only these:** `Terrarium_V2_Premium_Design.md` → **§9 (the non-negotiables list)** + §2 (never-color-alone) +
§5 (onboarding / <60s-to-first-value); `Terrarium_V2_Migration_Sequence.md` → **"Phase 9 — Premium polish"**;
`Terrarium_V2_Grill_Decisions.md` → **14** (60fps drag via the UI-thread rule; **Android fps is a design budget, not a
gate**; device-acquisition declined — measured on the **owner's iPhone**). Skip the rest.

**Work (the §9 checklist, as acceptance criteria).**
1. **Empty + skeleton states everywhere** — every list/detail screen has a calm empty state and a loading skeleton (no
   raw spinners, no blank flashes).
2. **Motion** — spring / ease-out transitions ~200–350ms; nothing snaps or lags past ~400ms; **respect reduce-motion**.
3. **Semantic haptics** — plant added, compatibility warning, step done — never decorative; audit existing calls.
4. **Touch targets** — every tappable ≥ 44×44pt / 48×48dp.
5. **Dynamic type** — respect OS dynamic text sizing (no clipped/overflowing labels at large sizes).
6. **Colorblind mode + never-color-alone** — every red/green pairs with an icon or label (retires v1's grey-"⚠"-only
   pattern); **no meaning encoded in color alone anywhere**.
7. **Onboarding** — a "start from a preset" path to first value in **< 60s** (measured).

**Gotchas.** This is the **one true gate phase** for v2.0 ship quality. **Measured on the owner's iPhone** (no
simulator here; Android fps is a budget, not a gate — decision 14) — so be **honest about the CI-vs-device split** as
every UI phase has been: lint/typecheck/tests/iOS-export are CI; the 60fps drag, the <60s onboarding timing, reduce-
motion, dynamic-type, and the colorblind render are **device checks**. Don't regress the 279-test suite or the
import-purity invariants. Clear the **device-verification backlog** (carry-forward) as part of the §9 pass where it
overlaps.

**Subagent plan.** The §9 list is naturally parallelizable into **self-contained screen passes** — e.g. empty/skeleton
states across the read-mostly screens, or the never-color-alone audit — each a reasonable subagent once the shared
polish primitives (a `Skeleton`/`EmptyState` component, the semantic-haptic map) are pinned in the orchestrating chat.
Keep those shared primitives + the token/motion decisions in the main chat.

**DoD (Phase 9 exit — tag `v2-phase-9-complete`, the v2.0 finish line):** the §9 list passes as a checklist (measured
on the owner's iPhone); first-build-from-preset measured **< 60s**; **no meaning encoded in color alone anywhere**;
empty/skeleton states everywhere; reduce-motion + dynamic-type respected. `npm run typecheck` clean; full Vitest suite
green (Phases 2–8 untouched); `expo export -p ios` clean — **plus the device pass** for the measured criteria.

**Verification:** `npm run typecheck` && `npm run test:run` && `expo export -p ios` clean; **plus the device pass**
(60fps drag, <60s onboarding, reduce-motion, dynamic type, colorblind render). Then **commit + `git tag -a
v2-phase-9-complete`** + update the phase table + refresh the "Last completed phase" digest + append the full Phase-9
session-log entry to `CHANGELOG.md`. Phase 9 is the **last v2.0 phase** — there is no "next brief" to write (the v2.1
fast-follows are the substrate mixer's siblings: the 3-D display, the via-secondary hard-cap, merge-on-restore).

### Kickoff prompt (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in `terrarium-v2`. You are doing **Phase 9 — Premium polish**
> (a **1-chat**, **critical-path-closing**, **v2.0-finish-line** phase). Read `MIGRATION.md` (the phase table + this
> brief + the carry-forward items + the **"Last completed phase — Phase 8"** digest) and ONLY: Premium Design **§9**
> (the non-negotiables) + §2 (never-color-alone) + §5 (onboarding/<60s); Sequence **"Phase 9 — Premium polish"**;
> Decision **14** (60fps via the UI-thread rule; Android fps a budget not a gate; measured on the owner's iPhone). Do
> NOT read all four docs or `CHANGELOG.md` (only for the *why* behind a past decision). **Phase 8 is committed +
> tagged `v2-phase-8-complete`:** the substrate mixer (matrix + pure mixer + `substrateMix` column w/ schema-v2
> migrate + guarded live-DB ALTER + opt-in Substrate-step UI + build-guide recipe line) is live; **279 tests green**,
> tsc/iOS-bundle clean, lint baseline unchanged. **Your job:** turn the §9 list into **acceptance criteria** across the
> screens that already exist (this is a quality pass, not new features) — (1) empty + skeleton states everywhere;
> (2) motion (spring/ease-out ~200–350ms, reduce-motion respected); (3) semantic haptics (audit, never decorative);
> (4) ≥44×44pt touch targets; (5) OS dynamic-type; (6) **colorblind mode + never-color-alone** (no meaning in color
> alone anywhere — retires v1's grey-⚠ pattern); (7) a "start from a preset" onboarding path to first value **< 60s**.
> Keep the shared polish primitives (a `Skeleton`/`EmptyState`, the semantic-haptic map, the token/motion decisions) in
> the main chat; the per-screen passes are subagent candidates once those are pinned. CI tests the suite + typecheck +
> iOS export; the **60fps drag, the <60s onboarding timing, reduce-motion, dynamic-type, and the colorblind render are
> device-verified** — be honest about the split (no simulator here), and clear the device-verification backlog where
> it overlaps. When the **full** Phase-9 DoD passes (`npm run typecheck` + `npm run test:run` + `expo export -p ios`;
> device pass), **commit + tag `v2-phase-9-complete`** (the v2.0 finish line), update the phase table + the digest +
> append the full entry to `CHANGELOG.md`. There is **no next brief** — Phase 9 closes v2.0 (the v2.1 fast-follows are
> the 3-D display, the via-secondary hard-cap, and merge-on-restore). Then stop.
