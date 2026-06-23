# Vibe art worklist

> **Status:** scaffolding. Vibe art (mascots, background foliage layers) ships as
> **PNG** files at fixed paths, each with a clearly-marked **placeholder** the artist
> overwrites in place. Decisions: [docs/adr/0007-vibe-atmospheres.md](../../docs/adr/0007-vibe-atmospheres.md).
> Mirror of the plant flow in [assets/plants/IMAGE_SOURCING.md](../plants/IMAGE_SOURCING.md),
> with one key difference: these placeholders **do** render on device.

## How it works

- Each vibe **owns its art** as static `require()` literals on its bundle (TS, not
  JSON — Metro can only bundle static requires). The render reads `vibe.art.<slot>`.
- **PNG only.** RN renders PNG natively via `<Image>` — no `react-native-svg-transformer`,
  no `metro.config.js`. (SVG would need a dep this repo doesn't have.)
- A CI gate asserts every art file a bundle references exists on disk under
  `assets/vibes/`. A missing file fails CI instead of rendering broken on device.

## Swapping a placeholder for real art (artist — no code needed)

1. Find the slot's path in the worklist table below (e.g.
   `assets/vibes/conservatory/mascot.png`).
2. Export the real art to **PNG**, **same filename**, **same pixel dimensions** as the
   placeholder it replaces.
3. **Overwrite the file in place.** Done. The next rebuild / hot-reload shows it.
4. Flip the row's **Status** below from `Placeholder` to `Final`.

Do **not** rename files, change paths, or edit code — a same-name overwrite is the
whole swap.

## Future expansion (dev)

- **Add a slot to a vibe:** add one line —
  `require('@/assets/vibes/<vibe>/<slot>.png')` — to that vibe's `art` map, and drop a
  marked placeholder PNG at the path. The CI gate picks it up automatically. Add a row
  here.
- **Add a whole new vibe:** create the bundle (palette light+dark · `art` map ·
  optional background component), make `assets/vibes/<vibe>/`, drop placeholders, and
  add the vibe to the Settings switcher list. Add a section here.

## Placeholder authoring

Hand-make each placeholder PNG; **no generator** (only a handful of bespoke files —
see ADR 0007). Mark every placeholder visibly (e.g. a "PLACEHOLDER" label) so it can
never be mistaken for final art.

## Worklist

### Conservatory (flagship / proof-of-concept)

Two roles (ADR 0007 A6): **ambient critters** live in the backdrop on every screen;
the **featured mascot** greets in empty states. Both are open/expandable sets — a new
critter or pose is one `require()` line in `art.ts` + one PNG at the path + a row here.

| Slot | Path | Dimensions | Purpose | Status |
| --- | --- | --- | --- | --- |
| `foliageBack` | `assets/vibes/conservatory/foliage-back.png` | 1400×900 | far parallax layer (slow drift), bottom-anchored `cover` | Placeholder |
| `foliageFront` | `assets/vibes/conservatory/foliage-front.png` | 1400×700 | near parallax layer (fast drift), bottom-anchored `cover` | Placeholder |
| `critters.snail` | `assets/vibes/conservatory/critters/snail.png` | 600×600 | ambient critter, hand-placed in the foliage band (rendered `contain`, ~50–64px) | Placeholder |
| `mascot.default` | `assets/vibes/conservatory/mascot/default.png` | 600×600 | featured mascot — welcoming pose, first-run empty states (rendered `contain`, ~100px) | Placeholder |
| `mascot.sad` | `assets/vibes/conservatory/mascot/sad.png` | 600×600 | featured mascot — commiserating pose, search-no-match (rendered `contain`, ~100px) | Placeholder |

> Dimensions are the placeholder's pixel size — final art must match them (the swap is
> a same-name, same-size overwrite). Foliage layers are bottom-anchored and `cover`, so
> art should read as foliage growing up from the bottom edge. Critters and mascot poses
> are transparent PNGs rendered `contain` — design each to read on both Conservatory
> schemes on its own value contrast (A11); add a `<name>-dark.png` only if one fails.

> **Expanding:** drop `critters/<name>.png` and add a `require()` line (+ a
> `CRITTER_SPOTS` entry in `conservatory-background.tsx` to place it); drop
> `mascot/<pose>.png` and add the pose to the `MascotPose` union + a `require()` line.

<!-- Cottagecore / Field guide: add sections + slots when those vibes are built. -->
