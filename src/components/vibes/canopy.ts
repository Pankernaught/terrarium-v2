/**
 * Conservatory canopy layout — the *pure* arrangement logic, no React/RN, so it's
 * unit-testable in Node (vitest) with a deterministic rng. The component
 * (`conservatory-background.tsx`) turns these fractions into pixels.
 *
 * Model (ADR 0007, revised): a dense bottom canopy of overlapping hand-drawn plant
 * sprites, **slot-filled** so every load reads as a continuous mature planting — no
 * gap-roulette. Two depth rows (back small + high & slow, front large + low & fast)
 * give the parallax its depth. Each slot randomizes which sprite lands there + a few
 * bounded jitters (flip, scale, x-nudge, z-order). One optional tall **focal** plant
 * (≤1 per launch) rises higher as a centerpiece.
 *
 * Randomness is per cold launch: the component calls `buildCanopy` once at module
 * load with real `Math.random`, so the arrangement is stable across navigation and
 * fresh each app start. `rng` is injected only so tests can pin it.
 *
 * Sizes are **fractions of screen width** (sprites scale by width, anchored at the
 * bottom edge → taller art naturally rises higher, free height variety). Tune the
 * constants below against real art — they're the calibration knobs.
 */

/** Tunable layout constants — calibrate against real art. */
const FRONT = { slots: 5, minScale: 0.4, maxScale: 0.55, yJitter: 0 } as const;
const BACK = { slots: 7, minScale: 0.25, maxScale: 0.35, yJitter: 0.08 } as const;
const FOCAL_CHANCE = 0.5; // P(a focal plant appears this launch)
const FOCAL_MIN_SCALE = 0.45;
const FOCAL_MAX_SCALE = 0.6; // draw the focal art tall → this width rises to ~⅔ screen

export interface RowSpec {
  /** Number of (overlapping) slots spread across the width. */
  slots: number;
  /** Sprite width as a fraction of screen width. */
  minScale: number;
  maxScale: number;
  /** Max upward lift, fraction of screen height (back row peeks higher; front = 0). */
  yJitter: number;
}

export interface Slot {
  /** Index into the bottom-sprite pool. */
  poolIndex: number;
  /** Center x, fraction of screen width [0..1]. */
  cx: number;
  /** Width, fraction of screen width. */
  scale: number;
  /** Mirror horizontally — doubles apparent variety for free. */
  flip: boolean;
  /** Bottom offset, fraction of screen height (0 = rooted on the floor). */
  yOffset: number;
  /** Stacking rank within the row (randomized so overlaps differ each load). */
  z: number;
}

export interface Focal {
  poolIndex: number; // index into the focal-sprite pool
  cx: number;
  scale: number;
  flip: boolean;
}

export interface Canopy {
  back: Slot[];
  front: Slot[];
  focal: Focal | null;
}

type Rng = () => number;

/** Fill one depth row, one sprite per slot, no same sprite in two *adjacent* slots. */
function buildRow(poolSize: number, spec: RowSpec, rng: Rng): Slot[] {
  if (poolSize === 0) return [];
  const slots: Slot[] = [];
  let prev = -1;
  for (let i = 0; i < spec.slots; i++) {
    let idx = Math.floor(rng() * poolSize);
    // No adjacent duplicate: bump to the next sprite (cheap, slight bias — fine).
    if (poolSize > 1 && idx === prev) idx = (idx + 1) % poolSize;
    prev = idx;

    const slotCenter = (i + 0.5) / spec.slots; // even base spread...
    const xJitter = (rng() - 0.5) * (0.6 / spec.slots); // ...nudged within its slot
    slots.push({
      poolIndex: idx,
      cx: slotCenter + xJitter,
      scale: spec.minScale + rng() * (spec.maxScale - spec.minScale),
      flip: rng() < 0.5,
      yOffset: spec.yJitter * rng(),
      z: i, // placeholder; shuffled below
    });
  }
  // Randomize stacking order within the row (Fisher–Yates on the z ranks).
  const ranks = slots.map((_, i) => i);
  for (let i = ranks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ranks[i], ranks[j]] = [ranks[j], ranks[i]];
  }
  slots.forEach((s, i) => (s.z = ranks[i]));
  return slots;
}

function pickFocal(poolSize: number, rng: Rng): Focal | null {
  if (poolSize === 0 || rng() >= FOCAL_CHANCE) return null;
  return {
    poolIndex: Math.floor(rng() * poolSize),
    cx: 0.25 + rng() * 0.5, // somewhere across the middle
    scale: FOCAL_MIN_SCALE + rng() * (FOCAL_MAX_SCALE - FOCAL_MIN_SCALE),
    flip: rng() < 0.5,
  };
}

/**
 * Build the whole canopy once. `pool` carries the two pool sizes (the component owns
 * the actual sprite `require()`s and maps `poolIndex` back to them).
 */
export function buildCanopy(
  pool: { bottom: number; focal: number },
  rng: Rng = Math.random,
): Canopy {
  return {
    back: buildRow(pool.bottom, BACK, rng),
    front: buildRow(pool.bottom, FRONT, rng),
    focal: pickFocal(pool.focal, rng),
  };
}
