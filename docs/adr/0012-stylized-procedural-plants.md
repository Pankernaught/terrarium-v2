---
status: accepted
---

# Plants render as stylized per-type foliage on a height-true stem

The planner cross-section ([cross-section.tsx](../../src/components/planner/cross-section.tsx))
draws every plant as an identical 3 px sage stick. This ADR replaces that with a
**two-part render**: the stick stays — upgraded — as a true-scale **stem**, and a
**stylized, per-`plantType` foliage glyph** sits on it as the **identity**. Where the
foliage attaches is chosen from `growthHabit`. All geometry lives in a pure, RN-free
module so the renderer *and a standalone design harness* (`/glyph-lab`) consume the
same code.

This is the successor to the **rejected** single-outline attempt in
[ADR 0011](0011-procedural-plant-silhouettes.md), and it supersedes the
stacked-composition approach sketched in
[illustrative-plant-render-handoff.md](../illustrative-plant-render-handoff.md). The
buildable spec lives in
[stylized-plant-render-handoff.md](../stylized-plant-render-handoff.md).

## Context

ADR 0011 drew each plant as **one closed outline scaled to its height** and reverted
the same day: a single silhouette can't carry plant identity (that lives in *repeated
sub-units* — fronds, blades, paired leaves), and scaling one outline to height smears
tall plants into columns. The plain 3 px stick that we reverted to is **safe** — it
never looks broken — but it reads as a CAD diagram: three climbing aroids, a fern, and
a trailing vine are all the same vertical bar, and the scene feels dead.

The record already carries everything needed to do better: `plantType` (12),
`growthHabit` (6), `spreadMin/MaxCm` (footprint), and `maxHeightCm` /
`typicalHeightCm` (heights). The stated goal is **differentiation *and* a scene that
feels alive**, at the highest impact-per-effort — and explicitly *without* re-opening
the blob failure mode.

The key realisation: the blob came from coupling **identity** to **height** in one
shape. Decouple them — let the stem own height (it already does, correctly), and let a
fixed, spread-scaled foliage glyph own identity — and the failure is **structurally
impossible** because nothing gets stretched.

## Decision

1. **Cap-on-stick: decouple identity from height.** The stem carries true height,
   overflow, and the root-depth band exactly as today. A separate foliage glyph,
   sized by **spread** (not height), carries identity. No part of the plant is scaled
   to its height, so the ADR-0011 stretch/blob failure cannot recur.

2. **Stem upgrade.** Thicker (≈4–5 px) and gently **tapered** (wider at the soil) so
   it reads as an organic stem, not a CAD bar. It now shows **both heights**: a solid
   stem to `typicalHeightCm`, a faint **ghost** continuing to `maxHeightCm` with a
   dashed cap — read as *growth headroom*, never a number. Overflow stays a
   **binary** ⚠️ on `maxHeightCm` vs the rim (unchanged from today); ADR 0011's tiered
   soft/hard badge is **not** reintroduced (that's the part that looked bad).

3. **Identity = per-type two-tone glyph; 9 distinct, keyed on all 12 types.** Each
   glyph is a flat "cut-paper botanical" form: a sage **body** path plus one lighter
   **highlight** path for volume, no outline. The lookup is keyed on all 12
   `plantType`s, but only **9 silhouettes** are authored — `vine`, `ground-cover`,
   and `fern-ally` share a base glyph (their real difference is size/posture, already
   supplied by the posture system) and can be **promoted to their own row the moment
   they read wrong, with zero refactor**. The 9: ovate (`foliage`), asymmetric
   angel-wing (`begonia`), veined heart (`aroid`), frond (`fern`), strap + bloom-spike
   (`orchid`), strap whorl (`bromeliad`), fat-leaf rosette (`succulent`), fuzz (`moss`),
   pitcher/trap (`carnivorous`).

4. **Posture = 3 families from 6 habits.** The stem is an armature; `growthHabit` only
   decides **where glyphs attach**:
   - **erect** = `upright` + `climbing` (108 plants) — vertical stem, glyphs fan from
     the top / pair up the pole.
   - **low** = `mounding` + `creeping` + `rosette` (101) — short or no stem, glyphs
     radiate into a dome / fan from the base.
   - **trailing** = `trailing` (34) — stem arcs and glyphs hang and cascade to one
     side. This is the answer to "a leaf-puff on a pothos looks wrong": a trailing
     plant visibly trails.

5. **Pure seam + one locked test.** A single RN-free module
   (`src/logic/plant-glyphs.ts`) exposes `composePlant(plant, layout, seed)` returning
   **placement data** (stem path spec + a list of placed glyph instances), mirroring
   the `substrate-wave.ts` logic/renderer split. The cross-section and the harness both
   render that data with `react-native-svg`. One pure unit test locks the load-bearing
   invariants (base-anchored, height-true, footprint-bound, deterministic-by-seed) per
   posture family — the test that ADR 0011 had and that was deleted with its module.

6. **Colour.** All glyphs derive from the themed `sage`, with a per-`plantType` hue /
   value nudge (cooler fern, deeper aroid, greyer succulent) and **seeded per-slug
   value jitter** so two same-type neighbours differ. Stays in the palette, works in
   light/dark.

7. **"Alive", layered cheaply on top.** In priority order: (a) **seeded per-plant
   rotation/scale jitter** on each glyph (nearly free, reuses the scatter seed — the
   biggest "not-stamped" win); (b) an optional **idle sway** (slow seeded Reanimated
   rotation, ±~1.5°, ~4 s, phase-offset per plant); (c) a **soil contact shadow** under
   each stem. A drifting spore/mote for ferns + moss is deferred.

8. **Harness-first.** The whole system is built and tuned in an **isolated
   `/glyph-lab` route** (`src/app/glyph-lab.tsx`, registered `href: null` like the
   planner — navigable by URL, hidden from the tab bar) before a line of it touches the
   planner. Because the harness renders the *same* pure module + RN-SVG path that ships,
   designs approved in the lab are literally what the build guide draws — no port
   between environments (the reason this is an in-app route, not a separate DOM tool
   like the plant-admin in ADR 0005).

9. **Data dependency.** The ghost band is honest only once `typicalHeightCm` is
   authored across the catalog — today **6 of 243** carry it; the rest fall back to
   `maxHeightCm × 0.7`, which would render a fake uniform top-30 % ghost on 97 % of
   plants. **Backfilling `typicalHeightCm` for all 243 is an owner data task** (next to
   the photo backlog) that gates the ghost band. The glyph + posture + jitter work does
   **not** depend on it and can ship first.

## Consequences

- The **height-true invariant is load-bearing**: the renderer derives the overflow
  badge and the surface-anchored root band from the stem cap. The locking test must
  move with any change to it.
- **Both `growthHabit` and `plantType` are now visually load-bearing** for plants in a
  build (previously neither was). Both are populated for all 243 seed plants; the
  renderer falls back to `foliage` / `erect` for a null value.
- The glyph kit is **data, reversible, and expandable** — adding the 10th–12th bespoke
  glyph later is one table row, no architecture change. Ship-9, expand-by-need.
- The old top-down `preview.tsx` stays dormant (ADR 0004); unrelated to the 3-D view.
- The stacked-composition plan in `illustrative-plant-render-handoff.md` is
  **superseded** by the cap-on-stick model and kept only as history.
- No new copy-catalog (ADR 0010) keys: overflow prose is unchanged and the ghost is
  visual-only.
- UI is device-verified separately per project norm; the pure module
  (`plant-glyphs.ts`) is covered in CI.

## Verification status

**Nothing built yet** — this ADR records the approved direction. Implementation is
harness-first per Decision 8: build `/glyph-lab` + `plant-glyphs.ts` + the 9 glyph
stubs + the locking test, tune on web/device in isolation, *then* swap the stem-render
block in `cross-section.tsx` behind the seam. The `typicalHeightCm` backfill (Decision
9) is a parallel owner task that gates only the ghost band.
