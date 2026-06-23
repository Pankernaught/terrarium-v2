/**
 * Scoring constants — ported verbatim from `engine/compatibility.py`. **These
 * are the rules.** They are frozen for the faithful port (no ad-hoc changes); the
 * only divergence is the primary/secondary mechanic in `compatibility.ts`, which
 * reuses the same ladder values below.
 */
import type { LightLevel, MoistureLevel, PhPreference } from '../types';

// Ordered categorical scales; the distance between two values drives severity.
export const LIGHT_ORDER: Record<LightLevel, number> = {
  low: 0,
  medium: 1,
  'bright-indirect': 2,
  direct: 4, // deliberate gap of 2 from bright-indirect — a big jump
};
export const MOISTURE_ORDER: Record<MoistureLevel, number> = {
  dry: 0,
  moderate: 1,
  moist: 2,
  wet: 3,
};
export const PH_ORDER: Record<PhPreference, number> = {
  acidic: 0,
  neutral: 1,
  alkaline: 2,
};

// --- Graduated ladder deductions -----------------------------------------
export const LIGHT_CAUTION_PENALTY = 15; // one step apart (and the distance-0-via-secondary cap)
export const LIGHT_INCOMPATIBLE_PENALTY = 30; // two+ steps apart
export const MOISTURE_ONE_STEP_PENALTY = 7; // one step apart (and the distance-0-via-secondary cap)
export const MOISTURE_TWO_STEP_PENALTY = 14; // two steps apart
export const HUMIDITY_PENALTY = 25; // no humidity-range overlap
export const TEMPERATURE_PENALTY = 15; // no temperature-range overlap
export const PH_CAUTION_PENALTY = 7; // one pH band apart

// --- Group scoring --------------------------------------------------------
// A group score may sit at most this many points above its weakest pair, so a
// single terrible pairing cannot be averaged away into a misleading "Healthy".
export const WORST_PAIR_FLOOR_BUFFER = 20;

// --- Small-container safety thresholds ------------------------------------
// Crowding is a 2-D problem: plants compete for the planting *surface*, not the
// volume — a tall narrow jar has the litres but not the floor. Thresholds are
// floor area (cm²) per plant. ponytail: tune these two if real builds over- or
// under-warn; they're the only calibration knob here.
export const CROWDING_AREA_CAUTION_CM2 = 30; // < this cm²/plant → tight (caution)
export const CROWDING_AREA_ERROR_CM2 = 18; // < this cm²/plant → overcrowded (incompatible)
export const GAS_EXCHANGE_SEALED_THRESHOLD_L = 1.0;

// --- Survival-critical tier (above the graduated scale) -------------------
// Mismatches that kill plants regardless of care. Any survival-critical conflict
// clamps the score to the ceiling, forcing an "incompatible" verdict.
export const LIGHT_SURVIVAL_PENALTY = 35;
export const MOISTURE_SURVIVAL_PENALTY = 35;
export const MOISTURE_SURVIVAL_GAP = 3; // dry <-> wet
export const PH_SURVIVAL_PENALTY = 35;
export const PH_SURVIVAL_GAP = 2; // acidic <-> alkaline (the two extremes)
export const CONTAINER_TYPE_SURVIVAL_PENALTY = 35;
export const CONTAINER_TYPE_OPEN_PENALTY = 5; // humid-loving plant in an open container (caution)
export const SURVIVAL_SCORE_CEILING = 40; // survival => incompatible verdict

export const SHADE_LIGHTS: ReadonlySet<LightLevel> = new Set(['low', 'medium']);

// --- Verdict bands --------------------------------------------------------
export const VERDICT_COMPATIBLE_MIN = 80; // >= 80 compatible
export const VERDICT_CAUTION_MIN = 50; // >= 50 caution, else incompatible
