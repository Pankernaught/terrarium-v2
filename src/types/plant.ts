/**
 * Plant domain type + zod schema (port of `engine/models/plants.py`).
 *
 * The required fields are the v1 core the compatibility/environment engines
 * read; everything else is optional metadata that can be backfilled over time.
 *
 * `light` and `soilMoisture` use a `{ primary, secondary? }` shape rather than a
 * single value. The primary is the happiest condition (the v1 scalar's analog);
 * the optional secondary is a tolerable, adjacent condition authored only where
 * botanically real. **pH is untouched** — it stays a single scalar with no
 * secondary.
 *
 * Several seed-authored fields are all `nullish()`/optional in this *base* schema
 * so engine test fixtures (`makePlant`) need not carry them. The seed loader
 * (`src/data`) validates every shipped plant against a stricter `seedPlantSchema`
 * that *requires* `image` + the root-depth range — so "every plant has an image"
 * is enforced at the data boundary, not by breaking fixtures.
 *   - `toxicity` — free text, toxic/irritant species only; **blank ≠ safe**.
 *   - `rootDepthMinCm`/`rootDepthMaxCm` — **reference-only** range; NOT a depth
 *     driver (depth math stays `maxHeightCm`-based, preserving oracle parity).
 *   - `image` + `imageCredit`/`imageLicense` — static seed asset; credit/license are
 *     **seed-only, never in the backup/export payload**.
 *   - `nativeContext` — optional Tier-3 sentence; `nativeBiome` stays the scored one.
 */
import { z } from 'zod';

// --- Controlled vocabularies (one source of truth for UI + validation) ------
export const LIGHT_LEVELS = ['low', 'medium', 'bright-indirect', 'direct'] as const;
export const MOISTURE_LEVELS = ['dry', 'moderate', 'moist', 'wet'] as const;
export const PH_PREFERENCES = ['acidic', 'neutral', 'alkaline'] as const;
export const GROWTH_RATES = ['slow', 'moderate', 'fast'] as const;
export const GROWTH_HABITS = [
  'trailing',
  'upright',
  'rosette',
  'creeping',
  'climbing',
  'mounding',
] as const;
export const PLANT_TYPES = [
  'fern',
  'fern-ally',
  'moss',
  'succulent',
  'carnivorous',
  'aroid',
  'begonia',
  'bromeliad',
  'orchid',
  'vine',
  'ground-cover',
  'foliage',
] as const;
export const NATIVE_BIOMES = [
  'tropical',
  'subtropical',
  'temperate',
  'montane',
  'arid',
  'mediterranean',
  'aquatic',
] as const;
export const RARITIES = ['common', 'uncommon', 'rare'] as const;

export type LightLevel = (typeof LIGHT_LEVELS)[number];
export type MoistureLevel = (typeof MOISTURE_LEVELS)[number];
export type PhPreference = (typeof PH_PREFERENCES)[number];
export type GrowthRate = (typeof GROWTH_RATES)[number];

export const lightLevelSchema = z.enum(LIGHT_LEVELS);
export const moistureLevelSchema = z.enum(MOISTURE_LEVELS);

/**
 * A `{ primary, secondary? }` condition for `light` and `soilMoisture`. The
 * secondary is a tolerable, adjacent fallback that can rescue a graduated mismatch
 * but never downgrades a lethal one.
 */
export const lightRequirementSchema = z.object({
  primary: lightLevelSchema,
  secondary: lightLevelSchema.optional(),
});
export const moistureRequirementSchema = z.object({
  primary: moistureLevelSchema,
  secondary: moistureLevelSchema.optional(),
});
export type LightRequirement = z.infer<typeof lightRequirementSchema>;
export type MoistureRequirement = z.infer<typeof moistureRequirementSchema>;

const rangeSchema = z.tuple([z.number(), z.number()]);

/**
 * A reference/source link for a plant's care information. `url` is required;
 * `label` is an optional human-readable title (the publication or page name) —
 * when absent the UI falls back to the link's host. Like image attribution,
 * sources are **seed-only display metadata and never enter the backup/export
 * payload.**
 */
export const plantSourceSchema = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});
export type PlantSource = z.infer<typeof plantSourceSchema>;

export const plantSchema = z.object({
  slug: z.string(),
  commonName: z.string(),
  scientificName: z.string(),

  // Reshaped to primary/secondary — pH stays a scalar.
  light: lightRequirementSchema,
  soilMoisture: moistureRequirementSchema,

  humidityPctRange: rangeSchema,
  tempCRange: rangeSchema,

  // Mature height: max required (tallest-plant value), min optional.
  maxHeightCm: z.number(),
  heightMinCm: z.number().nullish(),

  // Mature spread/footprint range; either bound may stand alone.
  spreadMinCm: z.number().nullish(),
  spreadMaxCm: z.number().nullish(),

  // Typical rooting depth — a sortable **reference-only** range.
  // Replaces v1's single `rootDepthCm` float. Authored for every seed plant but
  // deliberately NOT wired into the depth math: the substrate-depth seed stays
  // `maxHeightCm`-driven, so this never diverges from the compatibility oracle.
  // Display data + a ready input for the v2.1 substrate mixer's depth refinement.
  rootDepthMinCm: z.number().nullish(),
  rootDepthMaxCm: z.number().nullish(),

  // Preferred substrate pH: numeric range (reference) + scored categorical band.
  soilPhMin: z.number().nullish(),
  soilPhMax: z.number().nullish(),
  phPreference: z.enum(PH_PREFERENCES).nullish(),

  growthRate: z.enum(GROWTH_RATES),
  // Frozen component vocabulary. Stored as canonical ids; the `{ id, label }`
  // source of truth + the seed-time vocab check live in
  // `src/data/substrate-components.ts`. Kept permissive here so engine fixtures
  // can use bare strings; the seed loader enforces the frozen set.
  substrateTags: z.array(z.string()).default([]),

  // Optional descriptive classifiers.
  growthHabit: z.enum(GROWTH_HABITS).nullish(),
  plantType: z.enum(PLANT_TYPES).nullish(),
  nativeBiome: z.enum(NATIVE_BIOMES).nullish(),
  rarity: z.enum(RARITIES).nullish(),

  // Free-text safety note, toxic/irritant species only. Display-only;
  // **blank/absent means "no note authored," NEVER "non-toxic" — never render it
  // as a safety claim.** Free text by design (no vocabulary to facet/filter).
  toxicity: z.string().nullish(),
  // Optional short origin sentence for the Tier-3 plant view.
  nativeContext: z.string().nullish(),

  closedTerrariumOk: z.boolean(),
  openTerrariumOk: z.boolean(),
  difficulty: z.number().int().min(1).max(5),
  notes: z.string().nullish(),

  // Single static seed image: the selector thumbnail and profile hero.
  // `imageCredit`/`imageLicense` satisfy CC-BY[-SA] attribution and are
  // **seed-only — they must never enter the backup/export payload**.
  // Optional here; required by `seedPlantSchema` in `src/data`.
  image: z.string().nullish(),
  imageCredit: z.string().nullish(),
  imageLicense: z.string().nullish(),

  // Open key/value extension point for plant-specific care details.
  specialNotes: z.record(z.string(), z.string()).nullish(),

  // Reference links for the plant's care information — supports multiple
  // sources. Display-only **seed metadata, never in the backup/export payload**
  // (same boundary as `imageCredit`/`imageLicense`).
  sources: z.array(plantSourceSchema).nullish(),
});

export type Plant = z.infer<typeof plantSchema>;

/** Both declared conditions for a factor, primary first (secondary may be absent). */
export function lightValues(req: LightRequirement): LightLevel[] {
  return req.secondary ? [req.primary, req.secondary] : [req.primary];
}
export function moistureValues(req: MoistureRequirement): MoistureLevel[] {
  return req.secondary ? [req.primary, req.secondary] : [req.primary];
}
