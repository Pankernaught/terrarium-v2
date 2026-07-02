---
status: accepted
---

# Group compatibility scores against a per-build consensus, not pairwise averages

`checkGroup` ([compatibility.ts](../../src/logic/compatibility.ts)) scores a build
as the **average of every pairwise `checkPair`** (clamped by a worst-pair floor,
and clamped to 40 if any pair is survival-critical). The averaging has a flaw the
owner named directly: **one off plant drags down the plants that were fine.** Add a
direct-sun plant to two happy shade plants and the two good plants' pair scores
with the newcomer sink the average — they "lose score" for a mismatch that isn't
theirs. The worst-pair floor and the whole-group survival clamp amplify it: one bad
relationship pulls the entire build toward "incompatible."

We replace pairwise-average group scoring with a **consensus model**. Each build
derives a dominant level per stat; plants that match the consensus take **zero**
penalty; only the deviating plant loses points; the build score is the **weakest
plant**, never an average the good plants can be dragged into.

## The model

1. **Consensus per stat (all five environmental stats).**
   - Categorical (`light`, `soilMoisture`, `phPreference`): the **plurality of
     primaries** — one plant, one vote. Secondaries do not vote.
   - Numeric (`humidity`, `temperature`): the **max-overlap zone** — the
     sub-interval the most plant ranges cover.

2. **Per-plant scoring against the consensus.** A plant's distance from the
   consensus runs the **existing penalty ladder verbatim** (the constants in
   [constants.ts](../../src/logic/constants.ts) still *are* the rules) — only the
   operand changes from plant-to-plant to plant-to-consensus. Light 1 step −15 /
   2+ steps −30; moisture 1/2 steps −7/−14; pH 1 step −7. A deviant whose
   **secondary** covers the consensus pays only the mild caution (today's
   `viaSecondary`), never the full miss. A numeric range that covers the consensus
   zone scores 0; one disjoint from it is survival-critical. Container-fit and
   gas-exchange are per-plant. A plant's score is `100 − Σ(its penalties)`, clamped
   to **≤20** if any of them is survival-critical (it will die in this box).

3. **Build score is the weakest link.** `build = min(per-plant scores) −
   Σ(build-level penalties)`, clamped ≥0. Matching plants keep their 100 in the
   roster regardless of how bad the deviant is — that is the whole point. The
   verdict band still derives from the score (≥80 / ≥50), so a build holding a
   survival-clamped plant (≤20) reads critical, while a build whose worst plant is
   a one-step caution reads in the high 80s.

4. **Ties = no dominant trait yet.** When no level holds the plurality (a 2-v-2
   split, or any 1-v-1 two-plant build), **no consensus is chosen for that stat and
   no plant is penalised on it** — nobody is "the off one" when there is no
   majority. Instead the build takes one **split warning** whose severity scales
   with the distance between the tied camps: 1 step → caution (−5), 2 steps →
   incompatible (−20), a survival gap (dry vs wet, direct vs shade, acidic vs
   alkaline, or two disjoint numeric zones) → clamps the build to ≤20. The listed
   trait for that stat shows **"split"** until one side gains the plurality.

5. **The dominant trait is listed on the build.** The consensus profile (the
   per-stat dominant levels) is surfaced as a live line on the planner's
   `EcoVerdictCard`. It updates for free on every recompute — "switched out when a
   trait becomes dominant" needs no special mechanic, only `scoreBuild` re-running.
   It also explains the penalties: a roster row reading "wants dry — build is wet"
   only makes sense with the build's wet trait visible. No synthesized biome-name
   taxonomy (a separate feature, deferred).

6. **Catalog fit follows.** `recommend()` and `plantFitScore` stop averaging
   `checkPair` and instead score the candidate against the **consensus of the
   already-selected plants** (the candidate does not vote on the consensus it is
   measured against). A single outlier in the build no longer tanks every
   candidate's fit.

## Consequences

- **Retired:** the pairwise `checkPair` scoring path, the average-of-pairs in
  `checkGroup`, `WORST_PAIR_FLOOR_BUFFER`, and `GroupReport.pairMatrix`. The
  whole-group survival clamp (`SURVIVAL_SCORE_CEILING = 40`) becomes a **per-plant**
  ceiling of **20** (`PLANT_SURVIVAL_CEILING`).
- **Kept and shared:** the per-stat distance→penalty ladder, factored into
  `scorePlantVsConsensus(plant, consensus)` and called by both `checkGroup` and the
  recommender — one place defines how far off is how bad.
- **`GroupReport` reshapes:** `pairMatrix` → a per-plant score/conflict list; add
  the consensus profile and the build-level warnings. `verdict.ts` (currently walks
  `pairMatrix`) reads per-plant conflicts + build warnings instead.
- **Build Detail follows the planner.** [build/[id]/index.tsx](../../src/app/build/%5Bid%5D/index.tsx)'s
  `PairwiseMatrix` ("Pairwise compatibility" section) reads `pairMatrix` and so is
  retired with it — replaced by the per-plant view, since a "pairwise" section
  contradicts a model that no longer scores pairwise. ADR 0016 was planner-only;
  this engine change carries to Build Detail.
- **Behavioural shift, intended:** a build that read "caution" under averaging may
  now read "healthy" (the good plants no longer dragged), and a build with a lethal
  plant pins to critical via the weakest-link min rather than a diluted average.
  This is the point, but it moves scores — the `compatibility.test.ts` /
  `verdict.test.ts` expectations are rewritten, not preserved.
- **Out of scope:** crowding, the env-envelope display on Build Detail's StatStrip
  (`deriveEnvelope` stays — it answers a different question than the consensus), the
  care/substrate engines, and the biome-name idea.
