---
status: accepted
---

# Temperature & humidity non-overlap are survival-critical; drop the envelope-collapse check

A build whose plants share no common temperature **must** land in the
survival-critical tier (overall score clamped to `SURVIVAL_SCORE_CEILING` = 40,
verdict "incompatible"). We move that guarantee from the group-level
envelope-collapse check (where it is delivered by accident, with a double
penalty and a false justification) into the pairwise check that actually
detects the clash, and delete the now-redundant group check.

## Context

Today the guarantee is delivered by the **global envelope-collapse check** in
`checkGroup` ([compatibility.ts:455-485](../../src/logic/compatibility.ts)): after
`deriveEnvelope`, if `tempMin > tempMax` (or the humidity equivalent) it pushes
an `incompatible` conflict into `containerFitIssues`, which trips `groupSurvival`
→ clamp 40.

Two problems:

1. **It double-counts.** The same physical fact is scored pairwise
   (`TEMPERATURE_PENALTY` −15, feeding the pair average) *and again* at the group
   level (`containerPenalty` −20), and then the clamp lands on top. One fact,
   deducted three ways.
2. **Its justifying comment is false.** The comment
   ([compatibility.ts:451-454](../../src/logic/compatibility.ts)) claims pairwise
   overlap can hold for *every* pair while the group still has no common value.
   For 1-D intervals that is impossible — Helly's theorem in 1-D: if every pair of
   intervals overlaps, they share a common point. `deriveEnvelope` computes
   `tempMin = max(mins)`, `tempMax = min(maxes)`
   ([environment.ts:46-49](../../src/logic/environment.ts)), so `tempMin > tempMax`
   **iff some pair of ranges is disjoint** — and that pair already emits the
   pairwise temperature conflict at
   [compatibility.ts:263](../../src/logic/compatibility.ts). The engine's own
   canonical test proves it: the "every pair is fine" example
   (cool `[10,20]`, mid `[18,25]`, warm `[23,35]`) has a disjoint pair, cool↔warm.
   The envelope check detects nothing the pairwise pass misses; it only re-frames
   and re-penalizes.

The reason it can't simply be deleted today: the **pairwise** temperature and
humidity non-overlap branches deduct points but do **not** set `survivalCritical`
([compatibility.ts:270](../../src/logic/compatibility.ts),
[:189](../../src/logic/compatibility.ts)). A non-overlapping-temperature pair
therefore scores 100 − 15 = 85 → verdict "compatible" at the pair level, and
removing the envelope check would let a no-common-temperature group score as
"Healthy." The envelope check is load-bearing **by accident** — it is the only
thing forcing the survival tier.

## Decision

Detect once, score once, clamp once.

1. In `checkPair`, set `survivalCritical = true` in the temperature non-overlap
   branch and the humidity non-overlap branch (severity is already
   `incompatible`). The pair now clamps to 40 like every other survival-critical
   factor, and `groupSurvival`'s existing `pairSurvival` path carries the clamp
   up to the group — the guarantee is preserved.
2. Delete both envelope-collapse blocks and the false comment
   ([compatibility.ts:451-485](../../src/logic/compatibility.ts)). Keep
   `deriveEnvelope` / `envEnvelope` — still returned on `GroupReport`.
3. Leave the penalty magnitudes (`TEMPERATURE_PENALTY` 15, `HUMIDITY_PENALTY` 25)
   alone; the survival clamp dominates and the constants stay frozen.

This also fixes a latent bug: a disjoint-temperature pair was rated "compatible"
in the pair matrix; it is now correctly "incompatible."

## The A–E plan, adjudicated

The prior planning note proposed five follow-ons. Verdicts after checking each
against the code:

- **A — culprit finder** ("removing {plant} clears the most conflicts").
  *Accept in principle, as its own change.* Genuinely additive, not redundant,
  reuses `pairMatrix`, factor-agnostic. But it is a new user-facing feature, out
  of scope for this scoring-correctness ADR.
- **B — "one shared setting" group check for moisture/light.** **Reject.** The
  claim that `dry+moderate+moist` has "no viable regime" assumes zero tolerance,
  which contradicts the engine's own ordinal model: a `moderate` substrate puts
  each neighbour one step off — a *caution*, not death, which the pairwise pass
  already reports. The only genuinely unsatisfiable case is span ≥
  `MOISTURE_SURVIVAL_GAP` (dry↔wet), which the pairwise survival tier already
  clamps. B adds no survival signal; its one extra (naming the outlier) is
  subsumed by A. *This is where this ADR diverges from the prior note's "A + B."*
- **C — pH group collapse.** Skip (agreed). Acidic+alkaline is the only collapse
  and is already pairwise survival-critical (same reasoning as temperature).
- **D — care-load aggregate** (all `difficulty: 5`). Defer. `difficulty` exists
  ([plant.ts:159](../../src/types/plant.ts)); a real group-level advisory, but
  YAGNI until asked.
- **E — crowding by floor area, not volume.** **Implemented.** Crowding compared
  plant count to `volumeL`, so a tall narrow jar (`glass-cylinder-tall`: 4.5 L but
  only ⌀12 cm → ~113 cm² of floor) cleared the old 2 L gate and was never flagged —
  yet plants compete for the planting *surface*, not the litres above it. The check
  now divides the container footprint (parsed from `dimensionsCm` via the existing
  `parseDimensionsStr` + a new `floorAreaCm2`,
  [containers.ts](../../src/logic/containers.ts)) by plant count and thresholds on
  cm² per plant (`CROWDING_AREA_CAUTION_CM2` 30 / `_ERROR_CM2` 18 — the tunable
  knob); a single plant never crowds. This is **not** the per-plant `spreadMaxCm`
  idea (populated for 1/243 plants) — container geometry is fully populated, so it
  works today. Hardening `parseDimensionsStr` to tolerate the decorated `⌀…×… cm`
  form also fixed a latent round-trip bug for custom containers.

## Consequences

- **Tests:** the `checkGroup — global envelope collapse` block
  ([compatibility.test.ts:370-411](../../src/logic/__tests__/compatibility.test.ts))
  asserts the conflict lands in `containerFitIssues`; rewrite it to assert the
  disjoint pair is `survivalCritical` in `pairMatrix` and `overallScore ≤ 40`
  (the two extreme plants are still named, now by the pairwise message). Add
  `survivalCritical`/score assertions to the temp and humidity pair tests to lock
  the new behavior in. "Does not flag collapse when a shared range exists" still
  passes unchanged.
- **Consumers verified safe:** `verdict.ts` `allConflicts` merges
  `containerFitIssues` *and* `pairMatrix`, so the incompatible conflict still
  reaches the verdict sentence (wording shifts from the envelope phrasing to the
  pairwise "ranges don't overlap"). `plants-step.tsx` `hasSurvivalCritical`
  ([plants-step.tsx:48](../../src/components/planner/plants-step.tsx)) already
  checks `pairMatrix[..].survivalCritical`, so the signal simply moves from its
  `containerFitIssues` branch to its `pairMatrix` branch — no regression.
- **Lost nicety (minor):** the envelope message's "Removing one will sort it out"
  CTA goes away; the pairwise message states the clash but not the fix.
  Acceptable, and recoverable later via A.
