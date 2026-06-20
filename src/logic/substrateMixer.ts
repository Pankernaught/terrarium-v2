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

/**
 * Roll a recipe up into the normalized derived stats, or `null` for an empty /
 * all-zero recipe. Only matrix-known components contribute (an unknown id is
 * ignored), so the blend domain is always exactly the authored matrix.
 */
export function mixSubstrate(mix: SubstrateMix): MixStats | null {
  const total = totalParts(mix);
  if (total === 0) return null;

  const stats = blankStats();
  for (const id of MATRIX_COMPONENT_IDS) {
    const parts = mix[id] ?? 0;
    if (parts <= 0) continue;
    const weight = parts / total;
    const row = SUBSTRATE_MATRIX[id];
    for (const prop of SUBSTRATE_PROPERTIES) {
      // weighted ordinal mean, normalized 0–4 → 0–1.
      stats[prop] += (weight * row[prop]) / PROPERTY_MAX;
    }
  }
  return stats;
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
