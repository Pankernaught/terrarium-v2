/**
 * Substrate **mixer** — pure roll-up of a component recipe into the four derived
 * stats, plus a soft one-line character. Net-new in this phase (there is no v1
 * mixer to port). CI-tested from day one.
 *
 * **Import-pure.** This module imports *only* its co-located property
 * matrix (`./substrate-matrix`) — nothing from `src/db` or `src/data`. The recipe
 * *formatter* takes an injected `labelOf` so even component labels (which live in
 * `src/data`) never create a dependency edge from `src/logic`.
 *
 * **Input = the integer parts map** `{ [componentId]: parts }` — also the persisted
 * shape (`builds.substrateMix`). An absent key is 0; non-positive parts are ignored.
 * **Roll-up = the parts-weighted mean** of each property,
 * `Σ (partsᵢ / total) · matrixᵢ`, then ÷ {@link PROPERTY_MAX} so each stat lands in
 * **0–1** (the `Meter` bar's domain). Edge cases:
 *   - empty / all-zero recipe → **`null`** (no bars to show);
 *   - a single component → its matrix row, verbatim (the formula already gives this).
 *
 * The stats feed the live planner bars **only** — they are deliberately *separate*
 * from the Eco-compatibility score (the recipe does not move the verdict) and
 * there is no plant-data coupling (no seeded-from-plants default).
 */
import {
  MATRIX_COMPONENT_IDS,
  PROPERTY_MAX,
  SIZE_CLASS,
  SIZE_CLASS_MAX,
  SUBSTRATE_MATRIX,
  SUBSTRATE_PROPERTIES,
  type SubstrateProperty,
} from './substrate-matrix';

/**
 * The persisted recipe + mixer input: `componentId → integer parts`. Absent key =
 * 0 parts. This is the exact JSON stored in `builds.substrateMix`.
 */
export type SubstrateMix = Record<string, number>;

/** The normalized blend — one 0–1 value per property (ready for a `Meter`). */
export type MixStats = Record<SubstrateProperty, number>;

/** A blank 0-filled stat object (mutated in the weighted-sum loop). */
function blankStats(): MixStats {
  return { aeration: 0, waterRetention: 0, nutrient: 0, buffering: 0 };
}

/**
 * The active components of a recipe — ids with positive parts, in the matrix's
 * canonical order (a stable list for the step UI, independent of insert order).
 */
export function activeComponents(mix: SubstrateMix): string[] {
  return MATRIX_COMPONENT_IDS.filter((id) => (mix[id] ?? 0) > 0);
}

/** Sum of the positive parts across the matrix's known components. */
export function totalParts(mix: SubstrateMix): number {
  let total = 0;
  for (const id of MATRIX_COMPONENT_IDS) {
    const p = mix[id] ?? 0;
    if (p > 0) total += p;
  }
  return total;
}

/** Parts-weighted mean inter-particle size of a recipe, 0–4 (caller ensures total>0). */
function meanSize(mix: SubstrateMix, total: number): number {
  let s = 0;
  for (const id of MATRIX_COMPONENT_IDS) {
    const p = mix[id] ?? 0;
    if (p > 0) s += (p / total) * SIZE_CLASS[id];
  }
  return s;
}

/**
 * The packing non-linearity term, 0–1. Fines fall into the voids between coarse
 * grains, so porosity *dips* — strongest when the recipe both spans a wide size
 * range and splits near 50/50 fine-to-coarse (the binary-packing intuition, here a
 * symmetric parabola). A single component, or a uniform-size blend, returns 0.
 *
 * ponytail: symmetric `4f(1−f)` peak at 50/50; the real Furnas optimum is ~30%
 * fine — swap for an asymmetric curve only if the bars ever need it.
 */
function packingMismatch(mix: SubstrateMix, total: number): number {
  const active = activeComponents(mix);
  if (active.length < 2) return 0;
  const sizes = active.map((id) => SIZE_CLASS[id]);
  const spread = (Math.max(...sizes) - Math.min(...sizes)) / SIZE_CLASS_MAX;
  const mean = meanSize(mix, total);
  let fineFrac = 0;
  for (const id of active) if (SIZE_CLASS[id] < mean) fineFrac += (mix[id] ?? 0) / total;
  return spread * 4 * fineFrac * (1 - fineFrac);
}

/** How much of aeration the worst packing can erase (macropores clogged by fines). */
const AERATION_PACKING_LOSS = 0.5;
/** How much of the *remaining* retention headroom that lost pore space fills with water. */
const RETENTION_PACKING_GAIN = 0.5;

/**
 * Roll a recipe up into the normalized derived stats, or `null` for an empty /
 * all-zero recipe. Only matrix-known components contribute (an unknown id is
 * ignored), so the blend domain is always exactly the authored matrix.
 *
 * Two-step (ADR 0015): the parts-weighted ordinal mean gives each property as a
 * single-component blend, then a **packing correction** bends aeration/retention
 * off that line — fines filling coarse voids cut aeration sub-linearly and turn
 * the lost macropores into held water. A uniform-size recipe (mismatch 0) is the
 * pure weighted mean, exactly as before. Nutrient and buffering blend linearly.
 */
export function mixSubstrate(mix: SubstrateMix): MixStats | null {
  const total = totalParts(mix);
  if (total === 0) return null;

  // 1. parts-weighted ordinal means, in 0–4 matrix units.
  const lin = blankStats();
  for (const id of MATRIX_COMPONENT_IDS) {
    const parts = mix[id] ?? 0;
    if (parts <= 0) continue;
    const weight = parts / total;
    const row = SUBSTRATE_MATRIX[id];
    for (const prop of SUBSTRATE_PROPERTIES) lin[prop] += weight * row[prop];
  }

  // 2. packing correction, then normalize 0–4 → 0–1.
  const m = packingMismatch(mix, total);
  const stats: MixStats = {
    aeration: (lin.aeration * (1 - AERATION_PACKING_LOSS * m)) / PROPERTY_MAX,
    waterRetention:
      (lin.waterRetention + RETENTION_PACKING_GAIN * m * (PROPERTY_MAX - lin.waterRetention)) /
      PROPERTY_MAX,
    nutrient: lin.nutrient / PROPERTY_MAX,
    buffering: lin.buffering / PROPERTY_MAX,
  };
  return stats;
}

// --- Perched water table (mix × container depth) -----------------------------

/** The capillary-saturated base zone a recipe holds at a given substrate depth. */
export interface PerchedWaterTable {
  /** Saturated-zone height (cm), set by pore size — *independent* of container depth. */
  perchedHeightCm: number;
  /** `perchedHeightCm / substrateDepthCm`, clamped 0–1 — the rot signal. */
  saturatedFraction: number;
}

/**
 * The perched water table for a recipe in a substrate layer `substrateDepthCm`
 * deep (ADR 0015). After draining, capillary tension holds a saturated zone at the
 * base whose *height* is fixed by the mix's inter-particle pore size (finer →
 * taller), **independent of how deep the substrate is** — so in a shallow base that
 * same zone is a larger, rot-prone *fraction* of the roots' space.
 *
 * `null` for an empty recipe or a non-positive depth. The height runs ~1 cm
 * (chunky) … 7 cm (powder); `saturatedFraction` reads roughly: `<0.3` fine ·
 * `0.3–0.6` watch · `>0.6` roots sitting in water.
 *
 * Note (the counterintuitive bit worth surfacing): a coarse drainage layer does
 * **not** drain this zone — it raises it into the finer substrate above. What
 * lowers it is a coarser mix, a deeper substrate, or a wick.
 */
export function perchedWaterTable(
  mix: SubstrateMix,
  substrateDepthCm: number,
): PerchedWaterTable | null {
  const total = totalParts(mix);
  if (total === 0 || substrateDepthCm <= 0) return null;
  const mean = meanSize(mix, total);
  const perchedHeightCm = round1(1 + 6 * (1 - mean / SIZE_CLASS_MAX));
  return {
    perchedHeightCm,
    saturatedFraction: Math.min(1, perchedHeightCm / substrateDepthCm),
  };
}

/** One-decimal round (the cm values are soft — no false precision). */
function round1(value: number): number {
  return Number(value.toFixed(1));
}

// --- Soft character summary (feeds the build-guide substrate line) -----------

/** One soft plain word per property — kept gentle, never a precise claim. */
const PROPERTY_WORD: Record<SubstrateProperty, string> = {
  aeration: 'airy',
  waterRetention: 'moisture-retentive',
  nutrient: 'rich',
  buffering: 'pH-stable',
};

/** A property counts as a standout only above this normalized level… */
const STANDOUT_MIN = 0.55;
/** …and only when it clears the blend's own mean by this margin (so a uniformly
 *  strong mix reads "well-balanced", not a wall of adjectives). */
const STANDOUT_MARGIN = 0.1;

/**
 * A soft, ~2-word character for a recipe: the 1–2 properties that genuinely stand
 * out → their plain words (e.g. `"airy, moisture-retentive"`), else
 * `"well-balanced"`. Deliberately imprecise — the values are authored, not
 * measured. `null` stats (empty recipe) also read `"well-balanced"`.
 */
export function describeMix(stats: MixStats | null): string {
  if (!stats) return 'well-balanced';

  const values = SUBSTRATE_PROPERTIES.map((p) => stats[p]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  const standouts = SUBSTRATE_PROPERTIES.filter(
    (p) => stats[p] >= STANDOUT_MIN && stats[p] >= mean + STANDOUT_MARGIN,
  )
    // Strongest first; the property display order breaks ties stably.
    .sort((a, b) => stats[b] - stats[a])
    .slice(0, 2);

  if (standouts.length === 0) return 'well-balanced';
  return standouts.map((p) => PROPERTY_WORD[p]).join(', ');
}

// --- Recipe formatting (label lookup injected to stay import-pure) -----------

/**
 * Render a recipe as a human "N parts <label>" list, biggest share first
 * (e.g. `"2 parts coco coir, 1 part perlite, 1 part sphagnum moss"`). The label
 * lookup is **injected** (`componentLabel` lives in `src/data`) so this stays
 * import-pure; labels are lowercased to read naturally mid-sentence. Returns `''`
 * for an empty recipe.
 */
export function formatMixRecipe(
  mix: SubstrateMix,
  labelOf: (id: string) => string,
): string {
  const ordered = activeComponents(mix).sort((a, b) => {
    const byParts = (mix[b] ?? 0) - (mix[a] ?? 0);
    if (byParts !== 0) return byParts;
    // Tie → canonical matrix order (stable, matches the step UI).
    return MATRIX_COMPONENT_IDS.indexOf(a) - MATRIX_COMPONENT_IDS.indexOf(b);
  });
  return ordered
    .map((id) => {
      const parts = mix[id] ?? 0;
      return `${parts} part${parts === 1 ? '' : 's'} ${labelOf(id).toLowerCase()}`;
    })
    .join(', ');
}
