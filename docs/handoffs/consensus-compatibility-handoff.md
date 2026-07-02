# Consensus compatibility — handoff

Handoff for whoever implements [ADR 0017](../adr/0017-consensus-compatibility.md).
The decisions are made (one grilling round with the owner); this doc is the context
to start cold without re-deriving them. Read the ADR first — this adds the code map,
the open judgement calls, and the constraints.

## Kickoff prompt (paste into the next chat)

> Implement ADR 0017 (`docs/adr/0017-consensus-compatibility.md`) using the handoff
> at `docs/handoffs/consensus-compatibility-handoff.md`. Restructure group
> compatibility from pairwise-average to a per-build **consensus** model: derive a
> dominant level per stat (plurality for light/moisture/pH, max-overlap zone for
> humidity/temp), score each plant against the consensus on the existing penalty
> ladder, build score = `min(per-plant) − build-level penalties`, survival clamps a
> plant to ≤20 (not the whole build), ties become a distance-scaled build-level
> "split" warning, and the dominant trait is shown live on the planner's
> `EcoVerdictCard`. Catalog fit (`recommend` / `plantFitScore`) scores candidates
> against the consensus of selected plants. Retire `checkPair`'s pairwise path, the
> average-of-pairs, `WORST_PAIR_FLOOR_BUFFER`, and `GroupReport.pairMatrix` (Build
> Detail's `PairwiseMatrix` goes with it). Ponytail is active — share the penalty
> ladder via one `scorePlantVsConsensus` helper, don't fork it. Engines stay pure
> (node-runner testable, no `src/db`/`src/data` imports). Rewrite the affected unit
> tests; all user-facing strings go in `copy.json`. Start by confirming the
> `GroupReport` reshape, then work engine → consumers → tests.

## The ask (verbatim intent)

> One plant that is off shouldn't bring down two that were at 100% before in the
> plant compatibility. This is going to be a restructure, but each build should get
> a level of each stat based off of which is the majority. This way, plants that
> match all those stats and are in the majority won't lose score when one mismatched
> plant is added. Once an ecosystem trait becomes dominant in the build, it will be
> switched out as the one listed on the build.

Then, when asked which stats: majority should also cover the numeric ranges via
**optimal overlap for most plants**; survival clamp lowered from 40 to **≤20**;
exact ties get a **distance-scaled warning** rather than an arbitrary tiebreak.

## The flaw this fixes

`checkGroup` ([compatibility.ts:360](../../src/logic/compatibility.ts)) scores
`overallScore = average(upper-triangle pair scores)`, then `min(avg, worstPair +
WORST_PAIR_FLOOR_BUFFER)`, then clamps to 40 if any pair is survival-critical. Every
one of those three steps lets one off plant pull down plants it has no real quarrel
with. The consensus model scores each plant against the build's majority instead, so
the majority plants are untouched and the deviant alone pays.

## DECIDED (owner-confirmed; don't re-litigate unless you disagree)

- **Consensus replaces pairwise entirely** — not both side by side.
- **All five environmental stats get a consensus.** Categorical (light, moisture,
  pH) by **plurality of primaries**; numeric (humidity, temp) by **max-overlap
  zone** (the sub-interval the most ranges cover). Secondaries do **not** vote.
- **Penalty ladder is reused verbatim**, measured plant→consensus. A deviant whose
  **secondary** covers the consensus pays only the caution (today's `viaSecondary`).
- **Per-plant score** `= 100 − Σ(its stat + container + gas penalties)`, clamped
  **≤20** if any are survival-critical. Container-fit and gas-exchange are
  **per-plant**; crowding is **build-level**.
- **Build score = `min(per-plant scores) − Σ(build-level penalties)`**, clamped ≥0
  (Option B — weakest link). Matching plants keep their 100 in the roster. No
  worst-pair floor, no band override — the number and the band agree.
- **Ties** (no plurality) → no consensus, **no per-plant penalty** on that stat;
  one **build-level split warning** scaled by tied-camp distance: 1 step → caution
  (−5), 2 → incompatible (−20), survival gap → clamp build ≤20. Listed trait shows
  "split."
- **Dominant trait listed live on the planner `EcoVerdictCard`** (replaces the
  under-used pieces of the old surface). No biome-name taxonomy.
- **Catalog fit** = candidate vs consensus of already-selected plants (candidate
  doesn't vote on its own measuring stick).

## OPEN / judgement calls for the implementer

1. **`GroupReport` shape.** Confirm this first — everything downstream keys off it.
   Suggested: drop `pairMatrix`; add `plantScores: { slug; score; conflicts:
   Conflict[]; survivalCritical: boolean }[]`, `consensus` (the per-stat dominant
   levels / zones, each value-or-`'split'`), and `buildWarnings: Conflict[]` (ties +
   crowding). `containerFitIssues` largely dissolves into `plantScores[].conflicts`
   (per-plant) + `buildWarnings` (crowding) — keep the field only if a consumer
   still needs the split. `envEnvelope` **stays** (Build Detail's StatStrip uses it;
   it answers "shared survivable range," not "dominant trait").
2. **Max-overlap zone algorithm.** Sweep the interval endpoints, take the
   coverage-maximising point, intersect the ranges covering it → the consensus zone.
   A plant overlapping the zone scores 0; disjoint → survival. Binary (the 25/15
   humidity/temp penalty constants are subsumed by the ≤20 clamp — leave them or
   delete, your call; they no longer graduate anything).
3. **Tie detection for ranges.** Two equal-coverage disjoint zones = a split; scale
   by the gap (non-overlapping numeric ranges are survival per ADR 0008, so a range
   split is generally the clamp case).
4. **Where the consensus profile renders on the card.** A compact line
   (`Light medium · Moist · Neutral · 18–24°C · 70–85%`) under the status line reads
   well; "split" values need a distinct token. All labels via `copy.json`.
5. **Build Detail's retired matrix.** `PairwiseMatrix` ([build/[id]/index.tsx:562](../../src/app/build/%5Bid%5D/index.tsx))
   must go (it reads `pairMatrix`). Replace with the per-plant roster, or reuse the
   `EcoVerdictCard` shape, or drop the section — owner only specified the planner, so
   match the planner's per-plant treatment and keep it minimal.

## Code map (the anchors you'll touch)

- **`src/logic/compatibility.ts`** — the core rewrite. Add `deriveConsensus(plants)`
  and `scorePlantVsConsensus(plant, consensus, container)`; rewrite `checkGroup` to
  consensus → per-plant → `min` − build penalties. Retire the pairwise `checkPair`
  scoring path (or reduce it to the shared per-stat distance helpers the consensus
  scorer also calls). `candidateContainerPenalty` stays (recommender reuses it; its
  survival branch now means "clamp the plant to ≤20").
- **`src/logic/constants.ts`** — delete `WORST_PAIR_FLOOR_BUFFER`; replace
  `SURVIVAL_SCORE_CEILING = 40` with `PLANT_SURVIVAL_CEILING = 20`. Ladder values
  (`LIGHT_*`, `MOISTURE_*`, `PH_*`) unchanged; `*_ORDER`, `SHADE_LIGHTS`,
  `*_SURVIVAL_GAP` reused by the consensus distance + tie-severity logic.
- **`src/types/results.ts`** — `GroupReport` reshape (open item 1).
- **`src/logic/recommend.ts`** — `recommend()` + `plantFitScore()` → score candidate
  vs `deriveConsensus(selected)`. Drop the `WORST_PAIR_FLOOR_BUFFER` /
  `SURVIVAL_SCORE_CEILING` imports and the average-of-pairs.
- **`src/logic/verdict.ts`** — `allConflicts` walks `report.pairMatrix` (lines
  17–25); switch to `plantScores[].conflicts` + `buildWarnings`. The survival/
  caution-ranking logic below it is fine as-is once it's reading the new lists.
- **`src/components/planner/plants-step.tsx`** — `getConflicts` (uses `checkPair`,
  ~76–80), `fitScores` (`plantFitScore`, ~160), `hasSurvival` (`pairMatrix`, ~61–64),
  and the `EcoRosterRow` assembly (~207). Build the rows from the new per-plant list
  and pass the consensus profile to the card.
- **`src/components/planner/eco-verdict-card.tsx`** — add the consensus profile line
  (open item 4); rows already render per-plant conflicts, so they mostly carry over.
- **`src/app/build/[id]/index.tsx`** — retire `PairwiseMatrix` (~562–600, open item
  5); the StatStrip at ~283 (envEnvelope) stays.
- **`src/data/copy.json`** — new keys: split-warning messages
  (`compat.split.<stat>` × 1-step/2-step/survival), consensus profile labels
  (`eco.trait.*`, a "split" token). Owner rule: **all user-facing prose lives here**,
  never hardcoded in components or the engine.
- **Tests** — `src/logic/__tests__/compatibility.test.ts` and `verdict.test.ts` are
  rewritten around the new shapes/numbers; add cases for consensus derivation,
  per-plant deviation, the ≤20 clamp, the weakest-link min, and the tie/split ladder.
  `environment.test.ts` only needs touching if `deriveEnvelope`'s contract changes
  (it shouldn't).

## Constraints / notes

- **Ponytail active.** One `scorePlantVsConsensus` helper shared by the engine and
  the recommender — don't fork the ladder. No new dependency, no new table/route. If
  the diff starts sprawling past the code map above, stop and re-check against the
  ADR's Consequences.
- **Engine purity invariant.** `compatibility.ts`, `recommend.ts`, `verdict.ts`,
  `eco.ts`, `score-build.ts` import nothing from `src/db` or `src/data` and must
  keep unit-testing in the node Vitest runner. `scoreBuild` already passes seed
  `plants` in — keep it that way.
- **This branch is `feat/eco-verdict-card`** — ADR 0016 (the verdict card) shipped
  here; build on it, don't rebuild it. The card's roster/expand/empty-state logic is
  done; you're changing what feeds it, not the presentation shell.
- **Behaviour will move.** Scores shift by design (good plants stop being dragged;
  lethal plants pin harder). Don't try to preserve old test numbers — rewrite the
  expectations to the new model and sanity-check a few builds by hand.
- **Don't touch** the substrate engines, care cadence/lifecycle, crowding thresholds,
  or `deriveEnvelope` — out of scope and solid.
