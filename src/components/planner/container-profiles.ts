/**
 * Container **shape geometry** for the 2-D cross-section viewer — the extensibility
 * seam for adding new vessel shapes (see ADR 0002).
 *
 * ## What a profile owns
 *
 * A {@link ContainerShapeProfile} turns a container's pixel bounding box (a
 * {@link Rect}) into the SVG geometry the cross-section needs:
 *
 *  - **`wallPath`** — the stroked silhouette of the vessel walls + floor, drawn as
 *    an *open* path (no line across the top). The top edge is the cross-section's
 *    job, because how it's drawn depends on the container *opening*
 *    (open / lidded / sealed), not the shape.
 *  - **`interiorClipPath`** — the same silhouette, **closed** across the rim. The
 *    viewer renders every layer (drainage, charcoal, substrate) and every plant
 *    inside an SVG `<ClipPath>` built from this, so a rounded base or a narrowing
 *    neck clips the fills automatically — no per-shape layer math required.
 *  - **`interiorWidthAt`** — interior width (px) at a height fraction above the
 *    floor (`0` = floor, `1` = rim). Lets the viewer keep a plant's x-position
 *    inside the vessel even where the walls curve inward. For the straight-walled
 *    shapes this is constant; a fishbowl would return a curve.
 *  - **`rimWidthFrac`** — rim width as a fraction of the full bounding-box width,
 *    so the viewer knows how long to draw the top edge.
 *
 * ## Why this is the seam
 *
 * Adding a shape (e.g. `fishbowl`) is a **drop-in**: implement the four members for
 * that silhouette and register it in {@link CONTAINER_PROFILES}. Nothing in
 * `cross-section.tsx` changes — it asks the registry for a profile by
 * {@link ContainerShape} and draws whatever geometry comes back. Keep new shapes
 * here, never branch on shape inside the renderer.
 *
 * ## Coordinate convention
 *
 * All paths are in the SVG's pixel space. A {@link Rect} `{ x, y, width, height }`
 * is the container's interior bounding box; `y` grows **downward** (SVG default),
 * so the floor is at `y + height` and the rim is at `y`. Height fractions in
 * `interiorWidthAt` are measured the natural way — **from the floor up** — so the
 * renderer doesn't have to keep flipping the axis.
 *
 * Pure module: no React, no SVG runtime import — it only *builds path strings*, so
 * it is trivially unit-testable.
 */
import type { ContainerShape } from '@/types';

/** A pixel bounding box in the SVG. `y` grows downward (floor at `y + height`). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ContainerShapeProfile {
  /** The shape this profile draws — matches the registry key. */
  readonly id: ContainerShape;
  /**
   * Open silhouette of the walls + floor (no top edge), as an SVG path `d` string.
   * Stroked by the viewer to draw the vessel.
   */
  wallPath(geom: Rect): string;
  /**
   * Closed silhouette (walls + floor + rim), as an SVG path `d` string. Used as the
   * clip region for every interior fill, so shape curvature clips layers for free.
   */
  interiorClipPath(geom: Rect): string;
  /**
   * Interior width (px) at `yFracFromFloor` ∈ [0, 1] (0 = floor, 1 = rim). Constant
   * for straight-walled shapes; a curved shape returns its profile here.
   */
  interiorWidthAt(geom: Rect, yFracFromFloor: number): number;
  /** Rim width as a fraction of `geom.width` — how long the top edge should be. */
  readonly rimWidthFrac: number;
}

/** Clamp helper kept local so this module imports nothing. */
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * **Rectangular** — flat walls, flat floor, sharp corners. The interior is a plain
 * rectangle, so width is constant and the clip region is a simple box.
 */
const rectangular: ContainerShapeProfile = {
  id: 'rectangular',
  rimWidthFrac: 1,
  wallPath({ x, y, width, height }) {
    const bottom = y + height;
    // Left wall down, across the floor, right wall up — open at the top.
    return `M ${x} ${y} L ${x} ${bottom} L ${x + width} ${bottom} L ${x + width} ${y}`;
  },
  interiorClipPath({ x, y, width, height }) {
    const bottom = y + height;
    return `M ${x} ${y} L ${x} ${bottom} L ${x + width} ${bottom} L ${x + width} ${y} Z`;
  },
  interiorWidthAt({ width }) {
    return width;
  },
};

/**
 * **Cylindrical** — straight walls with a softly **rounded base**, the jar/tank
 * silhouette. Only the two bottom corners curve; the walls stay vertical, so
 * interior width is still constant and the rounded floor clips the drainage layer
 * into a pleasing curve via the clip path.
 */
const cylindrical: ContainerShapeProfile = {
  id: 'cylindrical',
  rimWidthFrac: 1,
  // Base corner radius — a fraction of the smaller dimension, capped so a short,
  // wide vessel never rounds past its own half-height/width.
  wallPath(geom) {
    return cylinderPath(geom, false);
  },
  interiorClipPath(geom) {
    return cylinderPath(geom, true);
  },
  interiorWidthAt({ width }) {
    return width;
  },
};

/** Corner radius for the cylindrical base, clamped to stay geometrically sane. */
function cylinderRadius({ width, height }: Rect): number {
  return Math.max(0, Math.min(width / 2, height / 2, Math.min(width, height) * 0.22));
}

/**
 * Shared path builder for the cylindrical silhouette. `close` adds the rim segment
 * (`Z`) for the clip region; without it the path is the open wall stroke.
 */
function cylinderPath(geom: Rect, close: boolean): string {
  const { x, y, width, height } = geom;
  const r = cylinderRadius(geom);
  const bottom = y + height;
  const d =
    `M ${x} ${y} ` + // top-left
    `L ${x} ${bottom - r} ` + // down the left wall
    `Q ${x} ${bottom} ${x + r} ${bottom} ` + // round the bottom-left corner
    `L ${x + width - r} ${bottom} ` + // across the floor
    `Q ${x + width} ${bottom} ${x + width} ${bottom - r} ` + // round the bottom-right
    `L ${x + width} ${y}`; // up the right wall to the rim
  return close ? `${d} Z` : d;
}

/**
 * The shape registry — the **only** place the viewer learns about shapes. Add a new
 * `ContainerShapeProfile` here (and a `ContainerShape` literal in `src/types`) to
 * teach the cross-section a new vessel; the renderer needs no edits.
 */
export const CONTAINER_PROFILES: Record<ContainerShape, ContainerShapeProfile> = {
  rectangular,
  cylindrical,
};

/**
 * Resolve a profile by shape, falling back to `rectangular` for an unknown/missing
 * shape so the viewer always has something sane to draw (progressive-reveal safe).
 */
export function getContainerProfile(shape: ContainerShape | null | undefined): ContainerShapeProfile {
  return (shape && CONTAINER_PROFILES[shape]) || rectangular;
}

/**
 * Horizontal inset (as a fraction of half the interior width) to keep a plant's
 * footprint clear of the wall at a given height. Exposed so the viewer and any
 * future placement-clamp logic share one definition of "don't touch the glass".
 */
export function interiorInsetFrac(profile: ContainerShapeProfile, geom: Rect, yFracFromFloor: number): number {
  const full = geom.width || 1;
  return clamp01(profile.interiorWidthAt(geom, clamp01(yFracFromFloor)) / full);
}
