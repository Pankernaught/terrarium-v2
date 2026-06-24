/**
 * Pure math for the cross-section's **organic substrate seams**. The material
 * boundaries (substrate surface, substrate/charcoal, charcoal/drainage) undulate
 * instead of sitting dead-level, so the layer stack reads as hand-poured sediment
 * rather than a CAD drawing. Kept here — pure, RN-free — so the logic runner can
 * lock its invariants; the renderer (`components/planner/cross-section.tsx`) turns
 * these offsets into SVG paths and clips.
 */

/** Deterministic 0–1 hash so seeded scatter/waves are stable across renders. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// ponytail: two taste knobs — nudge on-device, real DPI never matches the math.
export const WAVE_AMP_FRAC = 0.25; // wave reach as a share of the thinner adjacent band
export const WAVE_AMP_CAP = 5; // px ceiling so a ~1 cm charcoal/drainage band can't pinch

/**
 * Deterministic vertical offset (px) of a wavy boundary at `x`. Three seeded sines
 * at different frequencies sum to an irregular, non-repeating but smooth contour.
 * The coefficients sum to 1, so `|offset| ≤ amp` — amp is a true bound, which is
 * what keeps a thin layer from being pinched past {@link WAVE_AMP_CAP}.
 */
export function waveOffset(x: number, amp: number, seed: number): number {
  if (amp <= 0) return 0;
  const f1 = 0.04 + rand(seed) * 0.02;
  const f2 = 0.09 + rand(seed + 2) * 0.03;
  const f3 = 0.17 + rand(seed + 4) * 0.04;
  const p1 = rand(seed + 1) * 6.283;
  const p2 = rand(seed + 3) * 6.283;
  const p3 = rand(seed + 5) * 6.283;
  const v = 0.55 * Math.sin(x * f1 + p1) + 0.3 * Math.sin(x * f2 + p2) + 0.15 * Math.sin(x * f3 + p3);
  return amp * v;
}

/** Wave amplitude for a seam, as a capped share of its thinner adjacent band (px). */
export function ampFor(bandPx: number): number {
  return Math.min(WAVE_AMP_CAP, Math.max(0, bandPx) * WAVE_AMP_FRAC);
}
