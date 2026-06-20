# Compatibility Engine — Issue Analysis & Improvements

*Analysis compiled from two independent reviews (Claude + Gemini). Covers `src/logic/compatibility.ts`, `recommend.ts`, `score-build.ts`, `verdict.ts`, `eco.ts`, `environment.ts`, `constants.ts`.*

---

## How the engine works (quick reference)

**Entry points:**
- `checkPair(a, b)` — pairwise score (0–100) between two plants
- `checkGroup(plants, container)` — group `GroupReport` (pairwise matrix + container issues + envelope)
- `scoreBuild(build, plants, containers)` — wrapper that resolves slugs and surfaces errors as diagnostics
- `recommend(selected, container, candidates)` — fit-scores candidates against the current selection
- `plantFitScore(candidate, selected, container)` — single-candidate fit score for catalog sorting

**Scoring:**
- Starts at 100, deducts per factor. Survival-critical conflicts (extreme light, moisture, pH, or container-type mismatch) clamp the score to ≤40, forcing "incompatible."
- Group score = average of upper-triangle pair scores minus container penalties, then survival ceiling applied.
- Verdict bands: ≥80 compatible/healthy, 50–79 caution, <50 incompatible/critical.

**Factors scored in `checkPair`:**

| Factor | Mechanism | Penalties |
|---|---|---|
| Light | Ordinal distance `low(0)→medium(1)→bright-indirect(2)→direct(4)` | Dist 1: −15 / Dist ≥2: −30 / Survival (direct+shade): −35+clamp |
| Soil moisture | Ordinal distance `dry→moderate→moist→wet` | Dist 1: −7 / Dist 2: −14 / Survival (dry+wet): −35+clamp |
| Humidity | Range overlap — binary | No overlap: −25 |
| Temperature | Range overlap — binary | No overlap: −15 |
| Substrate pH | Ordinal distance `acidic→neutral→alkaline` | Dist 1: −7 / Survival (acidic+alkaline): −35+clamp |
| Growth rate | **Not scored anywhere in `checkGroup`** — only surfaced in `recommend()` cautions |

**Primary/secondary (light + soil moisture only):** `bestAdjacency()` finds the minimum ordinal distance across the full `{ primary, secondary? }` cross-product. A secondary-only distance-0 match is penalised at the one-step rate (never a free 100). Survival tier is judged on primaries only.

---

## Issues found

### 1 — "Ghost Warning" bug: growth rate disappears on add (Gemini)

**Severity: High**

`recommend()` pushes a `growth_rate` caution when a candidate's growth rate differs from any selected plant. But `checkGroup()` ignores growth rate entirely. The moment the user adds the plant, the engine re-scores using `checkGroup`, the growth-rate warning vanishes, and the score is unaffected.

The user sees a warning *before* adding, then nothing *after* — the opposite of what should happen.

**Fix:** Move growth-rate conflict detection into `checkGroup`. It doesn't need to penalise the raw score, but it must appear in `GroupReport.containerFitIssues` (or a new `groupConflicts` array) so `allConflicts()` in `verdict.ts` picks it up and `summarizeVerdict` can surface it post-selection.

```typescript
// In checkGroup, after the gas-exchange block:
for (const plant of plants) {
  const others = plants.filter(p => p.slug !== plant.slug);
  if (others.some(p => p.growthRate !== plant.growthRate)) {
    containerFitIssues.push({
      factor: 'growth_rate',
      severity: 'caution',
      message: `${plant.commonName} has a different growth rate from its companions — trim regularly to prevent overcrowding.`,
      affectedPlants: [plant.slug],
    });
    break; // one group-level note is enough
  }
}
```

---

### 2 — Global environmental collapse not detected (Gemini)

**Severity: High**

Temperature and humidity are scored pairwise only. In a three-plant group where:
- Plant A: 10–20°C
- Plant B: 18–25°C  
- Plant C: 23–35°C

A–B overlaps (fine), B–C overlaps (fine), A–C does not (flagged). But the group score averages these: two decent pair scores dilute the A–C conflict. Critically, there is **zero global temperature range** where all three can coexist — yet the group score and envelope display don't make this obvious.

`deriveEnvelope()` already computes the global intersection (`humidityMin`, `humidityMax`, `tempMin`, `tempMax`) and an inverted result (`min > max`) signals collapse — but `checkGroup` never checks it.

**Fix:** After `deriveEnvelope()` in `checkGroup`, inspect the envelope and push group-level conflicts if the intersection is empty:

```typescript
const envEnvelope = deriveEnvelope(plants);

if (envEnvelope.tempMin > envEnvelope.tempMax) {
  containerFitIssues.push({
    factor: 'temperature',
    severity: 'incompatible',
    message: `No shared temperature range exists across all plants — there is no single temperature these plants can all survive at together.`,
    affectedPlants: plants.map(p => p.slug),
  });
}

if (envEnvelope.humidityMin > envEnvelope.humidityMax) {
  containerFitIssues.push({
    factor: 'humidity',
    severity: 'incompatible',
    message: `No shared humidity range exists across all plants — humidity requirements are mutually exclusive.`,
    affectedPlants: plants.map(p => p.slug),
  });
}
```

These push into `containerFitIssues` so they flow through `containerPenalty()` and into the overall score naturally.

---

### 3 — Averaging dilutes a single terrible pairing (Claude + Gemini)

**Severity: Medium-High**

With 5 plants (10 pairs), one pair scoring 20 is averaged with nine pairs scoring 100 → group score ≈ 88 ("Healthy"). The survival ceiling saves the survival-critical cases (clamps to 40), but graduated incompatibles can average away to a misleading healthy score.

**Fix (Gemini's formula):** Apply a worst-pair floor so the group score cannot be more than 20 points above its weakest link:

```typescript
// In checkGroup, replacing the current baseScore calculation:
const averagePairScore = upperScores.reduce((sum, s) => sum + s, 0) / upperScores.length;
const worstPairScore = Math.min(...upperScores);
const baseScore = Math.trunc(Math.min(averagePairScore, worstPairScore + 20));
```

This ensures a genuinely miserable pair drags the ecosystem score into "Caution" even when the other plants are compatible.

---

### 4 — Misleading "lethal" message for `direct + bright-indirect` (Claude)

**Severity: Medium**

In `compatibility.ts`, the graduated branch at `bestDist >= 2` has a special case when `involvesDirect` is true — it reuses the survival-tier wording ("direct sunlight through glass creates a greenhouse effect and will cook shade-adapted plants — lethal"). But this path only fires when `lightSurvival` is false, meaning `bright-indirect` is involved (not `low`/`medium`). The score is only −30 and the verdict can be "Caution", yet the message says "lethal."

```typescript
// compatibility.ts ~line 159 — the involvesDirect branch in the graduated path
const message = involvesDirect
  ? `...lethal.`           // ← says lethal but score is -30, not survival-clamped
  : `...requirements too far apart.`
```

**Fix:** Reserve "lethal" language exclusively for the survival branch. The graduated message for `direct + bright-indirect` should read something like:
> `"${a.commonName} needs ${aLight} and ${b.commonName} needs ${bLight} — two steps apart, a significant mismatch."`

---

### 5 — `recommend()` positive reasons drift from scoring logic (Claude)

**Severity: Medium**

`recommend()` builds positive reason strings ("Matches light requirement") by checking primary light equality directly:

```typescript
if (candidate.light.primary !== sp.light.primary) lightMatches = false;
```

But scoring uses `bestAdjacency()` across primary + secondary. A candidate whose `secondary` light matches a selected plant's `primary` would score fine (distance 0, minor caution penalty) but `lightMatches` would be `false` here, suppressing the positive reason. The reasons text and the fit score can contradict each other.

**Fix:** Derive positive reasons from the absence of conflicts in the `checkPair` result rather than re-implementing the check:

```typescript
for (const sp of selected) {
  const result = checkPair(candidate, sp);
  pairScores.push(result.score);
  const factorsWithConflicts = new Set(result.conflicts.map(c => c.factor));
  if (!factorsWithConflicts.has('light')) lightMatches &&= true;
  // etc.
}
```

Or more simply: a factor earns a positive reason if no pair conflict names that factor.

---

### 6 — Duplicate container penalty logic (Claude + Gemini)

**Severity: Low-Medium**

The container penalty check (sealed/lidded vs `closedTerrariumOk`, open vs `openTerrariumOk`) is copy-pasted verbatim in three places:

1. `recommend()` — for caution building
2. `plantFitScore()` — for fit score calculation
3. `checkGroup()` / `containerPenalty()` — for group scoring

Any change to the thresholds requires updating all three locations.

**Fix:** Extract a single helper:

```typescript
// In compatibility.ts or a shared utils file:
export function candidateContainerPenalty(candidate: Plant, container: Container): number {
  if ((container.opening === 'sealed' || container.opening === 'lidded') && !candidate.closedTerrariumOk) {
    return 20;
  }
  if (container.opening === 'open' && !candidate.openTerrariumOk) {
    return 5;
  }
  return 0;
}
```

---

### 7 — Redundant `checkPair` calls in `checkGroup` (Claude)

**Severity: Low**

The double loop in `checkGroup` calls `checkPair(a, b)` for every ordered pair — both `pairMatrix[a][b]` and `pairMatrix[b][a]` — performing O(N²) computations when O(N(N−1)/2) would suffice. Since `checkPair` is pure and symmetric, the lower triangle can be mirrored:

```typescript
// Inside checkGroup's double loop, change to:
if (i === j) { /* self */ }
else if (i < j) {
  const result = checkPair(a, b);
  pairMatrix[a.slug][b.slug] = result;
  pairMatrix[b.slug][a.slug] = result; // mirror
  upperScores.push(result.score);
} else {
  // Already set via mirror above — pairMatrix[a.slug][b.slug] already exists
}
```

---

### 8 — Eco-colour amber anchor is a magic number (Claude)

**Severity: Low**

In `eco.ts`, the OKLab interpolation anchors amber at score 65 (hardcoded), which is `(VERDICT_CAUTION_MIN + VERDICT_COMPATIBLE_MIN) / 2 = (50 + 80) / 2`. If the verdict thresholds are ever adjusted, the colour sweep will silently drift out of alignment with the band boundaries.

**Fix:** Derive it:

```typescript
// eco.ts — import the constants and compute:
import { VERDICT_CAUTION_MIN, VERDICT_COMPATIBLE_MIN } from './constants';
const AMBER_ANCHOR = (VERDICT_CAUTION_MIN + VERDICT_COMPATIBLE_MIN) / 2; // 65
```

---

## Implementation order

| Priority | Issue | File(s) affected |
|---|---|---|
| 1 | #1 Growth rate ghost warning | `compatibility.ts`, `verdict.ts` |
| 2 | #2 Global envelope collapse | `compatibility.ts`, `environment.ts` |
| 3 | #3 Worst-pair floor | `compatibility.ts` |
| 4 | #4 "Lethal" message wording | `compatibility.ts` |
| 5 | #5 Reasons drift | `recommend.ts` |
| 6 | #6 Duplicate container penalty | `compatibility.ts`, `recommend.ts` |
| 7 | #7 Redundant checkPair calls | `compatibility.ts` |
| 8 | #8 Magic amber anchor | `eco.ts`, `constants.ts` |

Issues #1–#3 change observable user-facing behaviour. Issues #4–#8 are correctness/maintainability fixes with no score changes visible to the user.
