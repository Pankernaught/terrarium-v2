# Illustrative plant render — handoff

**Status:** future enhancement, nothing built. A first **procedural single-outline
silhouette** attempt shipped and was **reverted the same day** (ADR 0011) — the
blobs didn't read as plants. Plants are back to the original 3px sticks. This doc is
the spec for doing it *properly*, and the key lesson from the failed attempt:

> **Key learning:** a single closed outline per `growthHabit` can't carry plant
> identity, and scaling one outline to height just stretches it. Plant identity lives
> in **repeated sub-units** (fronds, blades, paired leaves) and in **`plantType`**,
> not in the overall silhouette or the growth habit. Key the render on `plantType`,
> compose primitives, and **stack** for height rather than stretch.

## The seam to (re)introduce

There is currently **no silhouette module** — the reverted attempt's
`src/logic/plant-silhouette.ts` was deleted. When this tier is built, reintroduce a
single pure, RN-free module behind this contract so the renderer
([cross-section.tsx](../src/components/planner/cross-section.tsx)) stays swappable:

```ts
plantRenderPaths(plant, { widthPx, heightPx, seed }) → ReactNode | path-data
```

The renderer should `translate` the result to `(xPx, surfaceY)` and know nothing
about how it's produced. Keep all geometry in the pure module so the logic runner can
lock its invariants (see the contract below).

### Hard contract the swap must preserve

1. **Base-anchored local space.** `(0, 0)` is the base centre that sits on the
   substrate surface; y is negative upward.
2. **Height-true.** The artwork's vertical extent must fill exactly `heightPx`
   (top of foliage at `-heightPx`, base at `0`). The renderer derives the overflow
   badge and the surface-anchored root band from the cap height — break it and a
   plant's "too tall" warning and its roots desync. Add a pure unit test that locks
   this for every plant type (the reverted attempt had one; it was deleted with the
   module).
3. **Footprint bound.** Horizontal extent within `±widthPx/2`.
4. **Deterministic by `seed`.** Same inputs → same output, so the plant doesn't
   wriggle on every re-render (drag, field edits). Seed is the slug hash.
5. **Stack, don't stretch, for height.** A taller plant has *more/longer* sub-units,
   not a vertically-scaled outline — the single biggest reason the reverted blobs
   failed. The current planner does not re-introduce a "ghost to mature max"; if a
   future warning wants one, it must compose, not scale.

## Proposed approach

- **Per-habit form + per-type detailing.** Keep the six habit archetypes as the
  silhouette envelope, then overlay structure chosen by `plantType` (fern → fronds,
  succulent → rosette of fat leaves, vine → trailing stems with spaced leaves,
  bromeliad → strappy whorl, moss → low fuzz, carnivorous → pitchers/traps).
- **Layered SVG, authored as data.** Mirror the substrate `COMPONENT_MARKS` pattern
  in [cross-section-patterns.tsx](../src/components/planner/cross-section-patterns.tsx):
  a small table of leaf/frond primitives (paths centred on 0,0) per type, scattered
  along the habit's stems/crown with seeded position + scale + rotation jitter. Keeps
  the look as editable data, not hand-written JSX per species.
- **Two-tone shading.** A darker fill body + a lighter highlight path (or a reuse of
  the existing `SPECULAR`/AO idea) to give leaves volume. Optional vein strokes for
  large-leaf aroids.
- **Color.** Still derive from the themed `sage` so it sits in the palette and works
  in light/dark, but allow a per-`plantType` hue nudge (cool fern green vs grey
  succulent vs deep aroid). Keep the seeded value jitter for same-type neighbours.
- **Per-species art (last step, optional).** For hero/common plants, an authored
  path set keyed by slug, falling back to the type-detailed habit render for the long
  tail. Only worth it once the procedural detailing is in and you know what's missing.

## Data available to drive it

From the plant record ([src/types/plant.ts](../src/types/plant.ts)):
`growthHabit` (6), `plantType` (~14: fern, moss, succulent, carnivorous, aroid,
begonia, bromeliad, orchid, vine, ground-cover…), `spreadMin/MaxCm`,
`heightMin/MaxCm`, `nativeBiome`, `rarity`, `leafiness`-adjacent tags via
`substrateTags`. `nativeBiome`/`rarity` could tint mood but aren't needed for v1 of
this tier.

## Effort / sequencing

1. Leaf/frond primitive tables per `plantType` + a scatter-along-envelope helper in
   the pure module. (~1–2 days, the bulk.)
2. Two-tone shading + per-type hue. (~half day.)
3. Device tuning pass — silhouettes are authored coarse; real DPI/scale always needs
   a calibration nudge. (~half day.)
4. (Optional, later) per-species path sets for hero plants.

Keep each step behind the existing seam so it can ship incrementally — the renderer,
the height-fit warning, and the tests don't move.
