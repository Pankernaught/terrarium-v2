/**
 * Eco-balance — the band + the perceptual meter colour.
 *
 * The score→band thresholds are a faithful port of v1's compatibility badge
 * (`components/build_card.py`: ≥80 success, ≥50 warning, else danger). The colour
 * sweep interpolates
 * interpolate green → amber → red through **OKLab** at roughly constant lightness
 * so the midpoint stays a vivid amber instead of the muddy brown a naïve sRGB lerp
 * passes through. Pure + dependency-free (no `culori` on device) so it unit-tests
 * in the node Vitest runner — colour math is exactly the kind of logic CI verifies.
 *
 * Imports nothing from `src/db` / `src/data` (engine-purity invariant).
 */

import { VERDICT_CAUTION_MIN, VERDICT_COMPATIBLE_MIN } from './constants';

export type EcoBand = 'healthy' | 'caution' | 'critical';

/**
 * Where the colour sweep pivots to amber — the centre of the caution band, derived
 * from the verdict thresholds so the colour midpoint can't drift away from the band
 * boundaries if those thresholds are ever retuned. Currently (50 + 80) / 2 = 65.
 */
const AMBER_ANCHOR = (VERDICT_CAUTION_MIN + VERDICT_COMPATIBLE_MIN) / 2;

/** Score band — v1 badge thresholds (≥80 / ≥50 / else). */
export function ecoBand(score: number): EcoBand {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'caution';
  return 'critical';
}

/** Short human label for a band. */
export function ecoBandLabel(band: EcoBand): string {
  switch (band) {
    case 'healthy':
      return 'Healthy';
    case 'caution':
      return 'Caution';
    case 'critical':
      return 'At risk';
  }
}

// --- OKLab colour interpolation -------------------------------------------
// sRGB hex ⇄ OKLab (Björn Ottosson's matrices). We mix in OKLab because it is
// perceptually uniform: a 50/50 mix of green and red lands on a believable amber,
// not the grey-brown sRGB gives you.

type Rgb = [number, number, number];
type Lab = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHex([r, g, b]: Rgb): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToOklab([r, g, b]: Rgb): Lab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, A, B]: Lab): Rgb {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function mixOklab(a: Lab, b: Lab, t: number): Lab {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Stops resolved per scheme — dark raises lightness so the sweep stays vivid. */
const LIGHT_STOPS = { critical: '#C0492F', caution: '#D2992B', healthy: '#3FA45B' } as const;
const DARK_STOPS = { critical: '#D96A4F', caution: '#E3B24B', healthy: '#5FC07C' } as const;

/**
 * Perceptual colour for a 0–100 score: critical red → amber → healthy green,
 * interpolated in OKLab. Two segments meet at the 50→80 caution band so the
 * amber sits where the warning band does. `clamp`ed to [0,100].
 */
export function ecoColor(score: number, scheme: 'light' | 'dark' = 'light'): string {
  const s = Math.max(0, Math.min(100, score));
  const stops = scheme === 'dark' ? DARK_STOPS : LIGHT_STOPS;
  const critical = rgbToOklab(hexToRgb(stops.critical));
  const caution = rgbToOklab(hexToRgb(stops.caution));
  const healthy = rgbToOklab(hexToRgb(stops.healthy));

  // Anchor the amber stop at the centre of the caution band (see AMBER_ANCHOR).
  let lab: Lab;
  if (s <= AMBER_ANCHOR) {
    lab = mixOklab(critical, caution, s / AMBER_ANCHOR);
  } else {
    lab = mixOklab(caution, healthy, (s - AMBER_ANCHOR) / (100 - AMBER_ANCHOR));
  }
  return rgbToHex(oklabToRgb(lab));
}
