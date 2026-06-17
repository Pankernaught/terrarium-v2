# Terrarium V2 — migration control doc

This file is the **cross-chat memory** for the v1 → v2 (React Native + Expo) rebuild. The
migration is split across many focused chats (one per phase) so no single chat has to hold the
whole thing. **Read this file + only the `Rebuild docs/` sections your phase brief points to —
do NOT read all four docs every time.**

- **Spec (source of truth):** `Rebuild docs/` (decisions 1–18, fully grilled).
- **v1 reference oracle:** the sibling repo `../terrarium-app`, frozen at tag `v1-oracle`
  (`engine/` = the pure logic to port, `tests/` = the safety-net suite).
- **Toolchain:** Expo SDK 56, Expo Router, RN 0.85, React 19.2, Reanimated 4, Drizzle +
  expo-sqlite, zod 4, Vitest. Node 22 LTS lives in `~/.local`.

## How to continue (paste into a NEW chat)

> You're continuing the Terrarium V2 RN+Expo migration in this repo (`terrarium-v2`). Read
> `MIGRATION.md` — the phase table + the distilled brief for the current phase — and only the
> `Rebuild docs/` sections that brief names. Do NOT read all four docs. You are doing **Phase N**.
> Use subagents for the self-contained chunks the brief lists (they keep this chat's context
> small). When the phase's Definition-of-Done passes: run the verification, commit, tag
> `v2-phase-N-complete`, update this file's phase table + session log, and **write the next
> phase's distilled brief + this same kickoff prompt** at the bottom. Then stop.

## Phase status

| Phase | Goal | Chats | Status |
|---|---|---|---|
| 1 | Lock decisions · freeze v1 · Expo skeleton | 1 | ✅ **done** |
| 2 | Port the pure engine, test-first (+ primary/secondary) | 1 | ⬜ **next** |
| 3 | Ship the data (versioned JSON, images, presets) | 1 | ⬜ |
| 4 | Local store (Drizzle/expo-sqlite) + repositories | 1 | ⬜ |
| 5 | Core screens + component library + export/backup | 2 | ⬜ |
| 6 | Planner: 5-step flow + 2-D drag + 2-D preview | 2 | ⬜ |
| 7 | Care reminders + photo timeline | 1 | ⬜ |
| 8 | Substrate mixer (parallel to 7) | 1 | ⬜ |
| 9 | Premium polish | 1 | ⬜ |

## Handoff protocol (every phase chat follows this)

1. Verify the phase **Definition of Done** (DoD).
2. `git add -A && git commit` with a clear message.
3. `git tag -a v2-phase-N-complete -m "..."`.
4. Update the **phase status** table above + append a **session log** entry below.
5. Write the **next phase's distilled brief** (goal · DoD · which doc sections to read · subagent
   plan · gotchas) at the bottom, followed by the kickoff prompt. Then stop.

**Subagents:** a subagent runs in its own context and returns only a summary, so use them for
self-contained chunks (one engine module + its test suite; one isolated screen/component). Keep
cross-cutting design (the scoring rule, the DB schema) in the orchestrating chat.

---

## ▶ NEXT — Phase 2 distilled brief: port the pure engine, test-first

**Goal.** Reproduce the entire v1 scoring/derivation engine in TypeScript under `src/logic/` +
`src/types/`, proven by the ~79 carried-over engine tests in Vitest, with the **one sanctioned
divergence** folded in: primary/secondary `light`/`soil_moisture`.

**Read only these:** `Rebuild docs/Terrarium_V2_Migration_Sequence.md` → "Phase 2"; 
`Terrarium_V2_Migration_Plan.md` → §1.1–1.2 + §2.1; 
`Terrarium_V2_Grill_Decisions.md` → decisions **6, 9, 15**. v1 source: `../terrarium-app/engine/*.py`
+ `../terrarium-app/tests/test_{compatibility,containers,guide,models,environment,care}.py`.

**Port map (module → target · test count):**
- `engine/compatibility.py` → `src/logic/compatibility.ts` + `src/logic/constants.ts` · **36**
- `engine/containers.py` (math only) → `src/logic/containers.ts` · **22**
- `engine/guide.py` → `src/logic/guide.ts` · **7**
- `engine/models/*` (Pydantic) → `src/types/*.ts` (+ zod) · **7**
- `engine/environment.py` → `src/logic/environment.ts` · **4**
- `engine/care.py` → `src/logic/care.ts` · **3**
- `engine/recommend.py` → `recommend(selected, container, candidates)` (candidates passed IN) +
  `makeContainer()` as a **pure** constructor. **Exclude:** `test_builds.py` (12, CRUD → Phase 4),
  `test_social.py` (9, scrapped).

**Constants are the rules — port verbatim into `constants.ts`:** `_LIGHT_ORDER` (note `direct:4`,
the deliberate gap), `_MOISTURE_ORDER`, `_PH_ORDER`; survival penalty 35; survival gaps
(moisture 3, pH 2); `_PH_CAUTION_PENALTY` 7; `_SURVIVAL_SCORE_CEILING` 40; crowding thresholds
(2.0 L, >2 / >4 plants); 1.0 L gas-exchange threshold; verdict bands (≥80 / ≥50).

**Primary/secondary (decision 15) — the ONLY divergence.** Only `light` + `soil_moisture` become
`{primary, secondary?}`; **pH untouched**. All leverage is in `check_pair` (`check_group` +
`recommend` delegate to it).
- *15a graduated:* score the **best-matching** pair across `{a.primary,a.secondary} × {b.primary,b.secondary}`
  on the v1 ladder (light 1→−15 / ≥2→−30; moisture 1→−7 / 2→−14). "via secondary" is a UI
  annotation, not an extra penalty.
- *15a distance-0 cap:* a best pair at distance 0 reached **only via a secondary** deducts the
  one-step caution penalty (−15 light / −7 moisture) → lands in caution, never a free 100.
  Both-secondary takes the same single deduction (escalation deferred to v2.1).
- *15b survival = primaries only:* lethal predicates (light `direct`+`low`/`medium`; moisture
  `dry`+`wet`, dist 3) evaluate `a.primary` vs `b.primary` **only**. A secondary never downgrades
  survival; suppress the "via secondary" annotation when survival-critical.
- *Ripples:* `recommend()` ~line 49 `candidate.light != sp.light` exact-equality → make
  primary/secondary-aware (cosmetic reason text); `derive_envelope` unions primary∪secondary for
  **display sets only** (recommender re-runs `check_pair`, never reads the envelope); add **two**
  net-new test families — the distance-0 secondary cap, and primaries-only survival (incl. an
  explicit "a secondary does NOT rescue a lethal pairing" assertion).

**Gotchas.** Keep `growth_rate` **unscored** in `check_pair` (intentional once-surfaced care
note — re-adding it as a per-pair penalty is the classic mistake). Preserve `check_group`'s
upper-triangle averaging, container-penalty tiers, and survival-clamp. The engine should **throw
cleanly** on bad input (the v1 `except Exception: pass` score-swallow at `home.py:189` is a bug to
NOT carry over; the diagnostic UI is Phase 5).

**Subagent plan.** (1) One **Explore** agent maps `../terrarium-app/engine` + `tests`: return the
exact constant values, function signatures, and each test's intent. (2) The orchestrator owns
`constants.ts` + `compatibility.ts` (the primary/secondary change lives here) + the 2 net-new test
families. (3) Delegate the mechanical modules to one general-purpose agent each — `containers.ts`,
`guide.ts`, `environment.ts`, `care.ts`, `types/*` — "port the module + translate its pytest
suite to `src/logic/__tests__/X.test.ts`, make `npx vitest run` green, report a summary."

**DoD (Phase 2 exit):** `npx vitest run` green on all ported cases (≈79 + the 2 net-new families);
`recommend()` and the container builder import nothing from `src/db`; `npx tsc --noEmit` clean.

**Verification:** `npm run typecheck` && `npm run test:run`.

---

## Session log

### Phase 1 — skeleton + orchestration scaffold (done)
- **Env:** Node 22.22.3 LTS installed to `~/.local` (symlinked into `~/.local/bin`, on PATH).
- **v1 frozen:** tag `v1-oracle` on `terrarium-app@3c1773e` (local; push blocked — no GitHub
  remote/auth yet, see follow-up). The uncommitted 1-line `planner.py` redirect was excluded
  (it diverged from the v2 plan).
- **Scaffold:** Expo SDK 56 (Expo Router) at `terrarium-v2`. Deps: zod 4, drizzle-orm, vitest,
  drizzle-kit, expo-sqlite/notifications/image-picker/camera/print/sharing/document-picker/haptics,
  @expo/vector-icons. `expo-gl`/`react-three-fiber` deliberately omitted (v2.1).
- **Structure:** `src/{logic,types,data,db}` created; example cruft pruned; **4-tab shell**
  (Terrariums · Browse · Care · Settings) via classic `expo-router` `Tabs` + `GestureHandlerRootView`.
- **Decisions made this chat:**
  - Used the **stable classic `Tabs`** (not the template's `unstable-native-tabs`) for the
    skeleton; the premium native tab bar + human-drawn icons are Phase 9.
  - **"screens/" → `src/app/`** (Expo Router file-based routing). See `src/README.md`.
  - Added `src/global.d.ts` (`declare module '*.css'`) so the template's web CSS import typechecks.
- **Verified:** `tsc --noEmit` clean · `vitest run` green (sanity test) · `expo start` boots Metro.
- **Tag:** `v2-phase-1-complete`.
