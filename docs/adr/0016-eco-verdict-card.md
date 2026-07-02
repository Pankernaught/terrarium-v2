---
status: accepted
---

# The planner's live Eco-balance becomes a verdict card: a score ring over a per-plant roster

The Plants step's live Eco-balance bar ([plants-step.tsx](../../src/components/planner/plants-step.tsx))
shows a linear meter, a `%·band` caption, the verdict sentence, and a collapsible
**Pair checks** matrix listing every plant pair and score. The matrix is noisy
(it shows compatible pairs too), and the bar answers "what's the score" without
answering "which plant is dragging it down." We replace this surface — **planner
only**, Build Detail's `VerdictBand` is untouched — with a verdict card:

1. A circular **`EcoRing`** (react-native-svg, already a dependency) replaces the
   linear meter — a big `score/100` number tinted by `ecoColor`, with the arc
   sweeping animated as plants are added. The survival-critical **haptic** nudge
   is kept; the visual glow pulse is retired with the meter it overlaid (the
   amber roster rows now carry the visual warning).
2. A status line reads `{band phrase} · {loop descriptor}`, e.g.
   *"Healthy ecosystem · closed humidity loop"*. Both halves are new
   `copy.json` keys (`eco.band.*`, `eco.loop.*`) — the band phrase is
   admin-editable prose; the loop descriptor derives from the container opening
   (`open` → open to the air, else → closed humidity loop).
3. A **per-plant roster** lists the *selected* plants in selection order. A plant
   with no conflict shows a green check + its `Fit N`; a plant with a conflict
   shows an amber marker, its worst-conflict reason inline, a `(N more)` counter,
   and **expands in place** (the shared `Collapse`) to reveal its remaining
   conflict rows. Tapping a no-conflict row opens the existing `PlantSheet` for
   detail.
4. The verdict sentence stays as the closing paragraph (explanation only — no
   what-if "reach N" projection).

The collapsible **Pair checks** matrix and its height-measuring animation state
are deleted: the roster (worst conflict per plant) plus per-row expand (the rest)
plus the sheet (full per-plant list) cover every conflict, keyed by plant rather
than by pair. The card is now variable-height and grows with the build — the old
fixed-height "catalog never shifts" invariant is intentionally dropped, since a
roster card legitimately reflects its contents. Empty (no plants) and unscored
(no container) states degrade to text-only prompts — no confident `100` ring on
an empty build.

All data already exists: `score`/`band`/`verdict.sentence` from `scoreBuild`,
per-plant fit from `plantFitScore`, per-plant conflicts from the existing
`getConflicts`. The only new logic is the trivial opening → loop-descriptor map.
