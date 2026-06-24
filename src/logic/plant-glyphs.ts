/**
 * Pure geometry for the cross-section's **stylized per-type plant render** (ADR 0012).
 *
 * The planner used to draw every plant as one identical 3 px stick. This module
 * splits a plant into two parts that never couple:
 *   - a **stem** carrying true height (and a faint ghost to max height), and
 *   - a set of **foliage glyphs** carrying identity, sized by *spread* — never by
 *     height, so the ADR-0011 stretch/blob failure is structurally impossible.
 *
 * RN-free and returns **data**, never JSX (mirrors `substrate-wave.ts`): the renderer
 * (`plant-art.tsx`) and the `/glyph-lab` design harness consume the same output, and
 * the load-bearing invariants are locked in `__tests__/plant-glyphs.test.ts`.
 *
 * ## The hard contract the renderer relies on (locked in the test)
 *  1. **Base-anchored.** `(0,0)` is the stem base on the substrate surface; y is
 *     negative upward. The renderer translates the whole result to `(xPx, surfaceY)`.
 *  2. **Height-true stem.** `stem.capY === -typicalPx`; the ghost ends at `-maxPx`.
 *  3. **Footprint bound.** Every glyph's extent stays within `±widthPx/2`.
 *  4. **Deterministic by `seed`.** Same inputs → same output (no wriggle on re-render).
 *  5. **Spread-scaled foliage.** Glyph size comes from `widthPx` only; a taller plant
 *     is a longer stem, not a bigger glyph.
 */
import type { GrowthHabit, Plant, PlantType } from '@/types';

import { rand } from './substrate-wave';

export type PostureFamily = 'erect' | 'low' | 'trailing';

/** The 9 authored silhouettes. 12 `plantType`s key into these (3 share a base). */
export type GlyphId =
  | 'ovate'
  | 'angel-wing'
  | 'veined-heart'
  | 'frond'
  | 'strap-spike'
  | 'strap-whorl'
  | 'fat-leaf'
  | 'fuzz'
  | 'pitcher';

export interface PlantLayout {
  /** Footprint width (px), from spreadMax/MinCm × cmToPx (clamped by the caller). */
  widthPx: number;
  /** Solid stem height (px) = typicalHeightCm × cmToPx. */
  typicalPx: number;
  /** Ghost extent (px) = maxHeightCm × cmToPx; must be ≥ typicalPx. */
  maxPx: number;
  /** Slug hash — deterministic placement (see `idSeed` in `cross-section.tsx`). */
  seed: number;
}

export interface PlacedGlyph {
  glyph: GlyphId;
  /** Original plant type — drives the per-type colour nudge in the renderer. */
  type: PlantType;
  /** Which authored body variant to draw (interleaved so a field isn't stamped). */
  variant: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}

export interface StemSpec {
  /** Filled tapered stem path, base (0,0) → cap. */
  path: string;
  /** Faint headroom continuation cap→max, or `null` when max ≈ typical. */
  ghostPath: string | null;
  /** y of the solid cap = `-typicalPx` (contract #2). */
  capY: number;
  /** y of the ghost's dashed cap = `-maxPx`, or `null` when no ghost. */
  ghostCapY: number | null;
}

export interface ComposedPlant {
  stem: StemSpec;
  foliage: PlacedGlyph[];
  posture: PostureFamily;
}

/**
 * Authoring box: every glyph path in `plant-art.tsx` is drawn within roughly
 * ±`GLYPH_UNIT` of (0,0). The placement loop uses it to keep `scale × GLYPH_UNIT`
 * (a glyph's half-extent) inside the footprint, so the renderer's coordinate space
 * and this module's footprint bound stay in lockstep.
 */
export const GLYPH_UNIT = 9;

// ponytail: three placement taste knobs — tune in /glyph-lab against device, the
// "right" density is a visual call no math settles.
const GLYPH_SPACING = 13; // px of footprint per glyph (sets the count)
const MAX_GLYPHS = 7;
const STEM_BASE_W = 5; // tapered stem: wide at the soil…
const STEM_TOP_W = 2; // …narrow at the cap.

/** Map all 6 growth habits onto the 3 posture families (ADR 0012 §4). */
export function postureFor(habit: GrowthHabit | null | undefined): PostureFamily {
  switch (habit) {
    case 'trailing':
      return 'trailing';
    case 'mounding':
    case 'creeping':
    case 'rosette':
      return 'low';
    // upright + climbing + null fall through to the safe default.
    default:
      return 'erect';
  }
}

/** Map all 12 plant types onto the 9 authored glyphs (ADR 0012 §3; 3 share a base). */
export function glyphFor(type: PlantType | null | undefined): GlyphId {
  switch (type) {
    case 'begonia':
      return 'angel-wing';
    case 'aroid':
      return 'veined-heart';
    case 'fern':
    case 'fern-ally':
      return 'frond';
    case 'orchid':
      return 'strap-spike';
    case 'bromeliad':
      return 'strap-whorl';
    case 'succulent':
      return 'fat-leaf';
    case 'moss':
      return 'fuzz';
    case 'carnivorous':
      return 'pitcher';
    // foliage + vine + ground-cover + null share the ovate base.
    default:
      return 'ovate';
  }
}

function glyphCount(widthPx: number): number {
  return Math.max(2, Math.min(MAX_GLYPHS, Math.round(widthPx / GLYPH_SPACING)));
}

/** Tapered stem (+ optional ghost). Trailing arcs to one side; others run vertical. */
function buildStem(posture: PostureFamily, widthPx: number, typicalPx: number, maxPx: number): StemSpec {
  const capY = -typicalPx;
  const bw = STEM_BASE_W / 2;
  const tw = STEM_TOP_W / 2;
  // Trailing drifts its cap to one side so the stem reads as an arc, not a pole.
  const drift = posture === 'trailing' ? Math.min(widthPx * 0.18, 10) : 0;

  const path =
    drift > 0
      ? `M ${-bw} 0 Q ${drift - tw} ${capY * 0.5} ${drift - tw} ${capY} L ${drift + tw} ${capY} Q ${drift + tw} ${capY * 0.5} ${bw} 0 Z`
      : `M ${-bw} 0 L ${-tw} ${capY} L ${tw} ${capY} L ${bw} 0 Z`;

  let ghostPath: string | null = null;
  let ghostCapY: number | null = null;
  if (maxPx > typicalPx + 0.5) {
    ghostCapY = -maxPx;
    const g = 0.7; // ghost half-width at the top
    ghostPath = `M ${drift - tw} ${capY} L ${drift - g} ${ghostCapY} L ${drift + g} ${ghostCapY} L ${drift + tw} ${capY} Z`;
  }
  return { path, ghostPath, capY, ghostCapY };
}

/**
 * Place the foliage for one posture. Each glyph gets seeded rotation + scale jitter
 * (the cheapest "not-stamped" win, ADR 0012 §7), and the scale is capped so the
 * glyph's half-extent never leaves the footprint (contract #3) — true even for a
 * tiny spread where one glyph would otherwise overflow.
 */
function placeGlyphs(
  posture: PostureFamily,
  glyph: GlyphId,
  type: PlantType,
  widthPx: number,
  typicalPx: number,
  seed: number,
): PlacedGlyph[] {
  const n = glyphCount(widthPx);
  const half = widthPx / 2;
  // Base size: a glyph spans a sensible share of the footprint (spread-scaled only).
  const baseScale = Math.min(1.8, Math.max(0.5, half / (GLYPH_UNIT * 1.6)));
  const out: PlacedGlyph[] = [];

  for (let i = 0; i < n; i++) {
    const s = seed + i * 131;
    const jScale = baseScale * (0.85 + rand(s) * 0.3); // ±15%
    // Cap so the half-extent fits the footprint with a sliver of margin.
    const scale = Math.min(jScale, (half * 0.9) / GLYPH_UNIT);
    const ext = scale * GLYPH_UNIT;
    const jRot = (rand(s + 1) - 0.5) * 28; // ±14°
    const t = n === 1 ? 0 : i / (n - 1); // 0..1 across the set

    let x: number;
    let y: number;
    let rotate: number;
    if (posture === 'erect') {
      // Crown the upper stem: the topmost glyph centres over the cap (hiding the
      // pole tip — no bare antenna), lower ones fan out down the upper third.
      const up = n === 1 ? 1 : i / (n - 1); // 0 (bottom of crown) .. 1 (top)
      const fan = 1 - up; // wide low in the crown, ~0 at the centred top
      const side = i % 2 === 0 ? -1 : 1;
      x = side * half * 0.62 * fan * (0.45 + rand(s + 2) * 0.55);
      y = -typicalPx * (0.5 + 0.52 * up);
      rotate = jRot + side * 20 * fan;
    } else if (posture === 'low') {
      // Radiate into a dome from the base across the whole footprint.
      const spread = n === 1 ? 0 : (t - 0.5) * 2; // -1..1
      x = spread * half;
      y = -Math.max(2, typicalPx) * (0.35 + 0.5 * Math.cos(spread * 1.2));
      rotate = jRot + spread * 38;
    } else {
      // Trailing — cascade down from the cap, drifting to one side and tipping down.
      const k = t; // 0..1 along the cascade
      x = (0.2 + 0.8 * k) * half;
      y = -typicalPx * (1 - k) - 2;
      rotate = jRot + 30 + k * 34;
    }

    // Footprint clamp (contract #3): |x| + ext ≤ half.
    x = Math.max(-(half - ext), Math.min(half - ext, x));
    out.push({ glyph, type, variant: i % 3, x, y, rotate, scale });
  }
  return out;
}

/**
 * Compose one plant into stem + placed foliage. Reads only `plantType`/`growthHabit`
 * (a real `Plant` satisfies the `Pick`), so the harness and test can pass bare literals.
 */
export function composePlant(plant: Pick<Plant, 'plantType' | 'growthHabit'>, layout: PlantLayout): ComposedPlant {
  const posture = postureFor(plant.growthHabit);
  const glyph = glyphFor(plant.plantType);
  const type = plant.plantType ?? 'foliage';
  return {
    stem: buildStem(posture, layout.widthPx, layout.typicalPx, layout.maxPx),
    foliage: placeGlyphs(posture, glyph, type, layout.widthPx, layout.typicalPx, layout.seed),
    posture,
  };
}
