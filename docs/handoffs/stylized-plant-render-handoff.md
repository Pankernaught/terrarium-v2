# Stylized plant render — handoff

**Status:** approved, harness-first, nothing built. Decision record:
[ADR 0012](adr/0012-stylized-procedural-plants.md). Supersedes the stacked-composition
approach in [illustrative-plant-render-handoff.md](illustrative-plant-render-handoff.md)
(kept as history) and the rejected single-outline attempt in
[ADR 0011](adr/0011-procedural-plant-silhouettes.md).

> **One-line model:** the stick stays as a true-scale **stem**; a fixed,
> spread-scaled, per-`plantType` **foliage glyph** sits on it as the identity. Nothing
> is scaled to height, so the ADR-0011 blob failure is structurally impossible.

## Build order (harness-first — do NOT touch the planner until step 4)

1. **Pure module + test** — `src/logic/plant-glyphs.ts` (+ `__tests__/plant-glyphs.test.ts`).
2. **The isolated test window** — `src/app/glyph-lab.tsx`, rendering the module.
3. **Author + tune the 9 glyphs and 3 postures** entirely in `/glyph-lab`.
4. **Integrate** — replace the stem-render block in `cross-section.tsx` behind the seam.

Steps 1–3 ship no user-visible change; step 4 is the only edit to the live planner.

## 1. The pure seam

`src/logic/plant-glyphs.ts` — RN-free, returns **data**, never JSX (mirrors the
`substrate-wave.ts` logic/renderer split so the test can lock invariants and the
renderer + harness share one source of truth):

```ts
type PostureFamily = 'erect' | 'low' | 'trailing';

interface PlantLayout {
  widthPx: number;       // footprint, from spreadMax/MinCm × cmToPx (clamped)
  typicalPx: number;     // stem solid height (typicalHeightCm × cmToPx)
  maxPx: number;         // ghost extent (maxHeightCm × cmToPx), ≥ typicalPx
  seed: number;          // slug hash — deterministic placement
}

interface PlacedGlyph { type: PlantType; variant: number; x: number; y: number; rotate: number; scale: number; }
interface StemSpec { path: string; ghostPath: string | null; capY: number; }

function postureFor(habit: GrowthHabit | null): PostureFamily;
function composePlant(plant: Plant, layout: PlantLayout, seed: number):
  { stem: StemSpec; foliage: PlacedGlyph[] };
```

### Hard contract the renderer relies on (lock these in the test)

1. **Base-anchored local space.** `(0, 0)` is the stem base on the substrate surface;
   y is negative upward. The renderer `translate`s the whole result to `(xPx, surfaceY)`.
2. **Height-true stem.** `stem.capY === -typicalPx` and the ghost (when present) ends at
   `-maxPx`. The renderer derives the overflow badge and the root band from `capY` —
   break it and "too tall" + roots desync. (Overflow logic itself is unchanged: binary
   ⚠️ on `maxHeightCm` vs rim, computed on the flat-mean surface — see
   `cross-section.tsx` `buildScene`.)
3. **Footprint bound.** Every glyph's extent within `±widthPx/2`.
4. **Deterministic by `seed`.** Same inputs → same output, so plants don't wriggle on
   re-render (drag, field edits). Seed is the slug hash (see `idSeed` in
   `cross-section.tsx`).
5. **Spread-scaled foliage, never height-scaled.** Glyph size comes from `widthPx`
   only. A taller plant = a longer stem, *not* a bigger or stretched glyph.

## 2. The test window — `src/app/glyph-lab.tsx`

Register it exactly like the planner in
[`src/app/_layout.tsx`](../src/app/_layout.tsx) (line ~75):

```tsx
<Tabs.Screen name="glyph-lab" options={{ href: null, tabBarStyle: { display: 'none' } }} />
```

Reachable at `localhost:8081/glyph-lab` on web (`npm run web`) and by deep link on
device — **never shown in the app's tab bar**. It is a dev tool: plain controls, no
copy-catalog prose, no DB.

Two modes (a toggle):

- **Gallery** — all 12 `plantType`s × the 3 posture families in a grid, each on a short
  substrate strip, so a style tweak is judged across the whole kit at a glance. A
  "reseed" button reshuffles every jitter seed; a light/dark toggle; an optional
  "show old 3 px stick beside each" for before/after.
- **Single** — one large specimen with live controls: `plantType` chips (12),
  `growthHabit` chips (6), sliders for `typicalHeightCm` / `maxHeightCm` / spread, a
  seed shuffle. This is where you tune one glyph's shape and the both-heights ghost.

Both modes render via `composePlant` + a small `<PlantArt>` that maps `PlacedGlyph[]`
to `react-native-svg` — **the same `<PlantArt>` the planner will import in step 4**, so
parity is guaranteed.

## 3. What to author

### The 9 glyphs (keyed on all 12 types)

Each glyph = 2–3 `body` path variants (centred on 0,0, like `COMPONENT_MARKS` in
[cross-section-patterns.tsx](../src/components/planner/cross-section-patterns.tsx)) plus
one lighter `highlight` path. The scatter/placement loop interleaves variants and
applies per-instance rotation + scale jitter.

| Glyph | `plantType`(s) | Shape |
|---|---|---|
| ovate | `foliage` · *(shared: `vine`, `ground-cover`)* | simple pointed oval |
| angel-wing | `begonia` | asymmetric, pointed, off-centre |
| veined heart | `aroid` | large heart + centre/side veins |
| frond | `fern` · *(shared: `fern-ally`)* | pinnate, jagged midrib |
| strap + spike | `orchid` | strappy blade + one arching bloom spike |
| strap whorl | `bromeliad` | rigid blades fanning from base |
| fat-leaf | `succulent` | plump teardrop rosette, greyer green |
| fuzz | `moss` | low filament tuft |
| pitcher | `carnivorous` | tube/trap — the one bespoke form |

`vine` / `ground-cover` / `fern-ally` start pointing at a shared base; promote any to
its own row when it reads wrong (one table entry, no refactor).

### 3 postures (placement, from `growthHabit`)

- **erect** (`upright`,`climbing`): glyphs fan from the top third / pair up the pole.
- **low** (`mounding`,`creeping`,`rosette`): short or no stem, glyphs radiate near base.
- **trailing** (`trailing`): stem arcs, glyphs hang and cascade to one side.

### Stem + both heights

Tapered stem path (≈4–5 px base → ≈2 px top). Solid to `typicalPx`; faint ghost
(opacity ≈0.28) to `maxPx` with a dashed cap line. Ghost is **visual headroom only** —
no number, no new badge tier.

### Colour

Derive from themed `sage`; per-`plantType` hue/value nudge; seeded per-slug value
jitter. Two-tone = body fill + lighter highlight (or reuse the existing
`SPECULAR`/`AO` idea).

### "Alive" (priority order)

1. Seeded per-plant rotation/scale jitter (free, reuses the seed). **Do this first.**
2. Idle sway — slow seeded Reanimated rotation on each foliage `<G>` (±~1.5°, ~4 s,
   phase-offset per plant).
3. Soil contact shadow under each stem.
4. *(Deferred)* drifting spore/mote near ferns + moss.

## 4. Integration (last)

In [cross-section.tsx](../src/components/planner/cross-section.tsx), the plant render is
the `scene.plants.map(...)` block (~L775–802) that draws the `STEM_W` `<Rect>` + overflow
stub + label. Replace the `<Rect>` stem with `<PlantArt>` fed by `composePlant`,
translated to `(p.xPx, p.surfaceY)`. **Leave untouched:** `buildScene`'s overflow flag,
`capY`, the root-band rects, the drag overlays, and the label. `STEM_W` (L104) and
`PLANT_EMOJI` (the drag chip still uses an emoji) can stay or be folded in.

## Data dependency

The ghost band needs real `typicalHeightCm` — **6 of 243** have it today; the rest fall
back to `maxHeightCm × 0.7` (a fake uniform top-30 % ghost). **Backfill
`typicalHeightCm` for all 243** (owner data task, next to the photos) before turning the
ghost on for everyone. Glyphs + postures + jitter + sway do **not** depend on it — ship
those first, gate only the ghost on the backfill.

## Effort / sequencing

1. Pure module + test + `<PlantArt>` + `/glyph-lab` skeleton — ~1 day (the plumbing).
2. Author the 9 glyphs + 3 postures, tuned in the lab — ~1–2 days (the bulk).
3. Two-tone + per-type hue + seeded jitter — ~half day.
4. Integration swap in `cross-section.tsx` + device tuning pass — ~half day.
5. *(Parallel/owner)* `typicalHeightCm` backfill, then enable the ghost band.
6. *(Optional, later)* idle sway; per-type bespoke promotions for the shared 3.
