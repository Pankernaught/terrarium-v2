/**
 * Unit display + input conversions. **Storage and all logic stay metric**
 * (cm / litres / °C); this module converts only at the UI edge, driven by the
 * `units` preference (see {@link usePreferences}). Pure — imports only
 * `dimensionsToStr` for the metric dimension string it already owns.
 */
import { dimensionsToStr, type Dimensions } from './containers';

export type Units = 'metric' | 'imperial';

const CM_PER_IN = 2.54;
const L_PER_GAL = 3.785411784; // US gallon

export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const inToCm = (inch: number): number => inch * CM_PER_IN;
export const cToF = (c: number): number => (c * 9) / 5 + 32;
export const lToGal = (l: number): number => l / L_PER_GAL;

/** Stringify a number to `dp` decimals without a trailing `.0` (so `12.0` → `"12"`). */
function num(n: number, dp = 1): string {
  return String(Number(n.toFixed(dp)));
}

/** The bare length unit label for input fields/steppers. */
export const lengthUnit = (u: Units): string => (u === 'imperial' ? 'in' : 'cm');

/** A length: `"12 cm"` / `"4.7 in"`. */
export function fmtLength(cm: number, u: Units): string {
  return u === 'imperial' ? `${num(cmToIn(cm))} in` : `${num(cm)} cm`;
}

/** A length value only (no unit) — for steppers that render the unit separately. */
export function lengthValue(cm: number, u: Units): string {
  return u === 'imperial' ? num(cmToIn(cm)) : num(cm);
}

/** A length range: `"5–8 cm"` / `"2–3.1 in"`. `?` parts pass through unconverted. */
export function fmtLengthRange(min: number | '?', max: number | '?', u: Units): string {
  const lo = typeof min === 'number' ? num(u === 'imperial' ? cmToIn(min) : min) : min;
  const hi = typeof max === 'number' ? num(u === 'imperial' ? cmToIn(max) : max) : max;
  return `${lo}–${hi} ${lengthUnit(u)}`;
}

/** A temperature range: `"18–24°C"` / `"64–75°F"` (whole degrees). */
export function fmtTempRange(min: number, max: number, u: Units): string {
  if (u === 'imperial') return `${Math.round(cToF(min))}–${Math.round(cToF(max))}°F`;
  return `${num(min, 0)}–${num(max, 0)}°C`;
}

/** A single temperature: `"22°C"` / `"72°F"`. */
export function fmtTemp(c: number, u: Units): string {
  return u === 'imperial' ? `${Math.round(cToF(c))}°F` : `${num(c, 0)}°C`;
}

/** A volume: `"10 L"` / `"2.6 gal"`. */
export function fmtVolume(l: number, u: Units): string {
  return u === 'imperial' ? `${num(lToGal(l))} gal` : `${num(l)} L`;
}

/** A dimension string: metric reuses `dimensionsToStr`; imperial converts each part. */
export function fmtDimensions(shape: string, dims: Dimensions, u: Units): string {
  if (u !== 'imperial') return dimensionsToStr(shape, dims);
  const inch = (v: number | undefined) => num(cmToIn(v as number));
  if (shape === 'cylindrical') return `⌀${inch(dims.diameter)}×${inch(dims.height)} in`;
  return `${inch(dims.length)}×${inch(dims.width)}×${inch(dims.height)} in`;
}
