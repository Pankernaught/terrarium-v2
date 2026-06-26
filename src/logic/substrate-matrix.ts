/**
 * Per-component substrate **property matrix**.
 *
 * The substrate mixer's only data dependency. Co-located in `src/logic` (not in
 * `src/data/substrate-components.ts`) so the import-pure mixer can read it without
 * `src/logic` ever reaching into `src/data` — keep the dataset next to its sole
 * consumer.
 *
 * **These values are AUTHORED + PROVISIONAL, not science.** They are a coarse,
 * horticulturally-plausible ranking on a small ordinal scale — the substrate analog
 * of the scoring constants — meant only to make the live mixer bars *move sensibly*
 * as a recipe changes. They are not measurements and must never be presented as
 * precise (the UI bars and `describeMix` are kept deliberately soft for this reason).
 *
 * Four properties only (decision-grill 2026-06-17): `aeration`, `waterRetention`,
 * `nutrient`, `buffering`. (The old brief's fifth, `particleSize`, was dropped — it
 * duplicated aeration's signal and added no bar a beginner could act on.)
 *
 * Scale — ordinal **0–4**: 0 none · 1 low · 2 medium · 3 high · 4 very high.
 * The mixer normalizes the parts-weighted blend to 0–1 (÷ {@link PROPERTY_MAX}).
 *
 * The keys are exactly the 13 canonical `SUBSTRATE_COMPONENTS` ids,
 * `mud` included as the outlier. A drift guard test cross-checks these keys against
 * the frozen vocabulary so adding a new material without a row fails CI — kept as a
 * *test* rather than an `import type` so `src/logic` stays free of any `src/data`
 * coupling.
 */

/** The four authored properties, in display order (drives the live bars). */
export const SUBSTRATE_PROPERTIES = [
  'aeration',
  'waterRetention',
  'nutrient',
  'buffering',
] as const;

export type SubstrateProperty = (typeof SUBSTRATE_PROPERTIES)[number];

/** One component's authored 0–4 ordinal scores across the four properties. */
export type PropertyVector = Record<SubstrateProperty, number>;

/** Top of the ordinal scale — the blend is divided by this to land in 0–1. */
export const PROPERTY_MAX = 4;

/** Plain, beginner-readable bar labels (never the bare camelCase key). */
export const PROPERTY_LABELS: Record<SubstrateProperty, string> = {
  aeration: 'Aeration',
  waterRetention: 'Water retention',
  nutrient: 'Nutrients',
  buffering: 'pH buffering',
};

/**
 * The authored matrix — `componentId → { aeration, waterRetention, nutrient,
 * buffering }`, each 0–4. Provisional (see file header). Keyed by the frozen
 * `SUBSTRATE_COMPONENTS` ids; the drift-guard test keeps these in lockstep.
 */
export const SUBSTRATE_MATRIX: Readonly<Record<string, PropertyVector>> = {
  // Volcanic glass — the airiest, drains almost instantly, inert.
  perlite: { aeration: 4, waterRetention: 1, nutrient: 0, buffering: 0 },
  // Classic moisture sponge — acidic, some nutrient + cation exchange, packs down.
  peat: { aeration: 1, waterRetention: 4, nutrient: 2, buffering: 2 },
  // Holds huge water while staying open; low feed, mildly acidic.
  sphagnum: { aeration: 2, waterRetention: 4, nutrient: 1, buffering: 2 },
  // Drainage + weight, little else; inert.
  sand: { aeration: 2, waterRetention: 1, nutrient: 0, buffering: 0 },
  // The all-rounder — balanced air/water, mild feed, near-neutral with good CEC.
  'coco-coir': { aeration: 3, waterRetention: 3, nutrient: 2, buffering: 3 },
  // Coarse mineral grit — pure drainage/aeration, no retention or feed.
  grit: { aeration: 4, waterRetention: 0, nutrient: 0, buffering: 1 },
  // Chunky bark — very open, holds a little, slow trickle of nutrient.
  'orchid-bark': { aeration: 3, waterRetention: 2, nutrient: 1, buffering: 1 },
  // Porous volcanic rock — airy, soaks water internally, some mineral buffering.
  pumice: { aeration: 3, waterRetention: 2, nutrient: 0, buffering: 2 },
  // The outlier — dense and water-logging, rich and strongly pH-buffering (clay).
  mud: { aeration: 0, waterRetention: 4, nutrient: 3, buffering: 4 },
  // General-purpose base — balanced air/water, well-fed, decent buffering.
  'potting-soil': { aeration: 2, waterRetention: 3, nutrient: 3, buffering: 3 },
  // Bioactive feed — fine and moisture-holding, very rich, good cation exchange.
  'worm-castings': { aeration: 1, waterRetention: 3, nutrient: 4, buffering: 3 },
  // Mineral sponge — soaks water while staying open, inert feed, mild buffering.
  vermiculite: { aeration: 2, waterRetention: 4, nutrient: 1, buffering: 2 },
  // Fired clay balls — pure drainage/aeration, holds nothing, near-inert.
  leca: { aeration: 4, waterRetention: 1, nutrient: 0, buffering: 1 },
  // Japanese fired clay — porous hold-and-release, mineral-inert, mildly acidic.
  akadama: { aeration: 2, waterRetention: 3, nutrient: 0, buffering: 2 },
};

/** The component ids that have an authored row (the mixer's blendable domain). */
export const MATRIX_COMPONENT_IDS: readonly string[] = Object.keys(SUBSTRATE_MATRIX);

/**
 * **Hidden** inter-particle pore size, ordinal **0–4** (0 powder · 1 fine · 2
 * granule · 3 coarse · 4 chunky). Deliberately *not* a display bar — a beginner
 * can't act on "2.3 mm" (the old `particleSize` was dropped as a bar for exactly
 * this reason). But it is the physics behind two things the four bars alone get
 * wrong, so it lives on as an internal variable (see ADR 0015):
 *
 *   1. **Packing non-linearity** — fines fill the voids between coarse grains, so
 *      a wide-spread blend has *less* aeration (and a touch more retained water)
 *      than the parts-weighted mean predicts ("sand into clay = concrete").
 *   2. **Perched water table** — finer inter-particle pores hold a taller
 *      capillary-saturated zone at the substrate base, independent of depth.
 *
 * Note this correctly separates *internal* water-holding from *perched* height:
 * vermiculite / pumice / akadama soak water inside the grain (high
 * `waterRetention`) yet drain freely *between* grains (size 2–3) — so they won't
 * waterlog a shallow base the way clay/peat powder (size 0–1) does.
 *
 * Keyed by the same frozen ids as {@link SUBSTRATE_MATRIX}; the mixer test's drift
 * guard keeps the two maps in lockstep.
 */
export const SIZE_CLASS: Readonly<Record<string, number>> = {
  mud: 0,
  peat: 1,
  'worm-castings': 1,
  'potting-soil': 1,
  sand: 2,
  'coco-coir': 2,
  vermiculite: 2,
  akadama: 2,
  perlite: 3,
  grit: 3,
  pumice: 3,
  sphagnum: 3,
  'orchid-bark': 4,
  leca: 4,
};

/** Top of the size-class scale — normalizes mean size to 0–1. */
export const SIZE_CLASS_MAX = 4;
