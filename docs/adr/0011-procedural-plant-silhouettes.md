---
status: rejected
---

# Plants render as procedural per-habit silhouettes in the cross-section

> **REVERTED 2026-06-23, same day it shipped.** On screen the single-outline
> silhouettes read as amorphous blobs, not plants — a closed shape can't carry the
> repeated sub-units (fronds, blades, paired leaves) that make a fern look like a
> fern, and scaling one outline to height stretched tall plants into smears. The
> "ghost to mature max, breaking above the rim" warning rendered as ugly dark
> columns. We **reverted the plant bodies to the original 3px sticks** and the
> height warning to its **original binary overflow** (`OverflowBadge` + the
> "max height may exceed" tooltip).
>
> **Kept** from this pass (genuinely good, cheap): the substrate sine-wave seams,
> the glass specular sheen, condensation on sealed+lidded glass, the substrate
> surface crust, and the `PAD_X` bump that un-clips the H dimension label.
>
> **Removed:** `src/logic/plant-silhouette.ts` (+ its test), the tiered
> `FitTier`/ghost model in the renderer, and the `planner.fit.*` copy keys.
>
> Doing plants *properly* (structured leaf/frond primitives keyed on `plantType`,
> not `growthHabit`) is the deferred path — see
> [illustrative-plant-render-handoff.md](../illustrative-plant-render-handoff.md).
> The decision record below is kept as the history of the rejected approach.

The planner's cross-section ([cross-section.tsx](../../src/components/planner/cross-section.tsx))
draws each plant as a **procedural silhouette keyed on `growthHabit`** instead of
the old identical 3px sage stick. The six habit shapes, their width (from spread)
and their seeded green tint all come from data the plant record already carries.
The shape geometry is a pure, RN-free seam ([plant-silhouette.ts](../../src/logic/plant-silhouette.ts))
so a richer illustrative render can replace it later without touching the renderer
(see [illustrative-plant-render-handoff.md](../illustrative-plant-render-handoff.md)).

The same pass reworks the height-fit warning from a binary alarm into a tiered,
visual-only nudge, and adds cheap glass realism (sheen, condensation, surface
crust). It ships alongside the substrate sine-wave seams (ADR 0001 family).

## Context

The viewer read as a *diagram*, not a *preview*. Every plant was the same vertical
bar with a tiny rotated label, so three climbing aroids were indistinguishable —
even though each record carries `growthHabit` (6 forms), `spreadMin/MaxCm`
(footprint) and `typicalHeightCm` (typical height) that the renderer threw away.

The height warning was all-or-nothing: any plant whose `maxHeightCm` exceeded the
container got the same ⚠️ + "max height may exceed" tooltip. In a real build that
flagged **every** tall plant at once, sitting next to a "100% · Healthy"
eco-balance — noise that made a healthy build look broken.

"Real per-species art" is the eventual goal, but it's the expensive 20%. The
80% — making plants read as distinct, proportioned forms — is free from data
already in hand.

## Decision

1. **Procedural silhouettes now, illustrative later, behind one seam.** Six coarse
   per-habit outlines authored once in a normalized box, scaled to a plant's real
   height/spread. Geometry lives in pure `plant-silhouette.ts` (`silhouettePath` /
   `silhouettePoints`), mirroring the `substrate-wave.ts` split so the logic runner
   can lock its invariants. The illustrative tier swaps `silhouettePath` without
   the renderer changing.

2. **Height-true contract.** A silhouette's vertical extent fills exactly its
   computed height (base vertex at `y=0`, apex at `y=-heightPx`). This is what keeps
   the height-fit overflow logic and the surface-anchored root band correct
   regardless of habit — locked by `plant-silhouette.test.ts`.

3. **Spread-scaled, capped width.** Footprint from `spreadMax/MinCm × cmToPx`,
   clamped to `[14, 80]` px (and ≤ half the vessel) so dense placements stay legible
   instead of colliding into mush.

4. **Seeded sage tint, not a rainbow.** Same-habit neighbours get distinct
   lightness shifts of the themed `sage`, picked by a slug seed — differentiation
   without leaving the green family or clashing with the earthy substrate.

5. **Tiered, visual-only height warning.** Compare mature height against the air
   above the substrate, on the flat-mean surface (so a wave crest never flips the
   badge mid-drag):
   - **fits** — `max ≤ headroom`: silhouette drawn full, no badge.
   - **soft** — `typical ≤ headroom < max`: quiet ↑ badge; solid foliage to typical,
     a faint **ghost extends to mature max, breaking above the rim**.
   - **hard** — `headroom < typical`: ⚠️ badge.

   The badge/tooltip prose moves into the `copy.json` catalog (ADR 0010) with an
   overshoot slot (`planner.fit.outgrow` / `planner.fit.tooTall`). Height-fit stays
   a **cross-section nudge only** — the oracle-locked eco-balance/verdict engine is
   untouched. "Fit ≠ plant-compatibility" is accepted: a build can be 100% healthy
   and still show a soft "will outgrow" hint.

6. **Cheap glass realism, same pass.** A diagonal specular sheen (AO's bright twin),
   seeded condensation droplets on **sealed + lidded** glass only, and a thin
   leaf-litter crust riding the substrate surface seam — all additive SVG nodes
   reusing existing gradients/seeds, no new systems.

## Consequences

- The renderer keeps deriving overflow and root depth from the silhouette height,
  so the height-true invariant is load-bearing — changing it needs the test to move
  with it.
- `growthHabit` is now visually load-bearing for plants in a build. It's populated
  for all 243 seed plants today; the renderer still falls back to `upright` for a
  null habit.
- The old top-down `preview.tsx` remains dormant (ADR 0004); this is unrelated to
  the eventual 3-D view.
- UI is device-verified separately per project norm; logic (`plant-silhouette.ts`)
  is covered in CI.

## Verification status

Logic invariants are CI-locked (`plant-silhouette.test.ts`, `substrate-wave.test.ts`).
UI verification is **partial** (2026-06-23, web preview): the glass sheen, condensation
on a lidded build, and the un-clipped H dimension label are confirmed; the per-habit
silhouettes + seeded tints, the ghost-to-max foliage + tiered badge, and the live
substrate seams/crust **remain to be checked on device/simulator**. The web preview runs
in a hidden tab where `requestAnimationFrame` is parked, which stalls the Plants
catalog's deferred render and blocks adding plants. Full repro + the controlled test
scene are in [build-visual-upgrade-verification-handoff.md](../build-visual-upgrade-verification-handoff.md).

Data caveat: only **6 of 243** seed plants carry `typicalHeightCm`, and the ghost-to-max
foliage renders only when `maxHeightCm > typicalCm`. The **soft "will outgrow at
maturity" tier is therefore unreachable for the rest** — they read as `fits` or `hard`.
Broad use of the soft nudge needs `typicalHeightCm` authored across the catalog.
