/**
 * Placement geometry — the pure, deterministic core of the planner's
 * drag-to-place interaction (Phase 6, decision 5 / Option A).
 *
 * A **placement** is a plant or hardscape asset positioned on the **2-D front
 * plane** of the container as `{ slug, x, y, scale }` (the same shape the Phase-3
 * presets and the Phase-4 `builds.placements` column already use):
 *   - `x`, `y` are **normalized to [0, 1]** across the front view, so a placement
 *     is resolution-independent and renders identically on the dashboard, in the
 *     planner preview, and (v2.1) in the 3-D display. `y` runs **0 = top → 1 =
 *     bottom**, so ground covers sit near 1 and taller specimens higher up.
 *   - `scale` is a relative size multiplier, clamped to a sane band so a sprite is
 *     never larger than the vessel (Sequence "Phase 6": *clamped to the container,
 *     never larger than the vessel*).
 *
 * **Pure + DB-free by design** (mirrors `containers.ts`): this module defines its
 * own structural `Placement` type and imports nothing from `src/db` / `src/data`,
 * so `src/logic` stays the engine's clean room. The drag handler (Phase 6 chat 2)
 * runs these functions on the UI thread; because they are deterministic math they
 * are trivially unit-testable and trivially 60fps.
 */

/** Structural placement — kept local so `src/logic` imports no DB/data layer. */
export interface Placement {
  slug: string;
  x: number;
  y: number;
  scale: number;
}

/** Scale band: a sprite may shrink to 40% and grow to 140% of its base size. */
export const PLACEMENT_SCALE_MIN = 0.4;
export const PLACEMENT_SCALE_MAX = 1.4;

/** Clamp a value into the closed unit interval [0, 1]. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Clamp a scale multiplier into the sane [MIN, MAX] band. */
export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return PLACEMENT_SCALE_MIN;
  return Math.min(PLACEMENT_SCALE_MAX, Math.max(PLACEMENT_SCALE_MIN, value));
}

/**
 * Return a copy of `p` with `x`/`y` clamped to the front plane and `scale` clamped
 * to the band — so a dropped or imported placement can never sit off-vessel or
 * blow past the sane size band.
 *
 * `margin` (normalized, default 0) insets the valid box on every side: pass the
 * sprite's normalized half-width so the *whole* sprite — not just its centre —
 * stays inside the vessel during a drag.
 */
export function clampPlacement(p: Placement, margin = 0): Placement {
  const m = Math.min(0.5, Math.max(0, margin));
  return {
    slug: p.slug,
    x: Math.min(1 - m, Math.max(m, clamp01(p.x))),
    y: Math.min(1 - m, Math.max(m, clamp01(p.y))),
    scale: clampScale(p.scale),
  };
}

/** True if the placement's centre sits within the front plane (inside [0, 1]²). */
export function isInsidePlane(p: Placement): boolean {
  return p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
}

/**
 * Apply a normalized translation `(dx, dy)` to a placement and re-clamp — the
 * pure primitive the drag gesture calls every frame with the finger delta
 * expressed as a fraction of the preview's width/height.
 */
export function movePlacement(p: Placement, dx: number, dy: number, margin = 0): Placement {
  return clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, margin);
}

/** Apply a relative scale factor to a placement and re-clamp to the band. */
export function scalePlacement(p: Placement, factor: number): Placement {
  return clampPlacement({ ...p, scale: p.scale * factor });
}

/**
 * Replace the placement for one slug in a list (or append if absent), keeping the
 * rest untouched and order stable — the planner's write-back when a drag commits.
 */
export function upsertPlacement(placements: readonly Placement[], next: Placement): Placement[] {
  const clamped = clampPlacement(next);
  const idx = placements.findIndex((p) => p.slug === clamped.slug);
  if (idx === -1) return [...placements, clamped];
  const copy = placements.slice();
  copy[idx] = clamped;
  return copy;
}
