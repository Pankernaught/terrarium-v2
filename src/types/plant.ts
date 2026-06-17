/**
 * Plant domain type + zod schema (port of `engine/models/plants.py`).
 *
 * The required fields are the v1 core the compatibility/environment engines
 * read; everything else is optional metadata that can be backfilled over time.
 *
 * **Phase 2 divergence (decision 15 / plan §2.1):** `light` and `soilMoisture`
 * reshape from a single value into `{ primary, secondary? }`. The primary is the
 * happiest condition (the v1 scalar's analog); the optional secondary is a
 * tolerable, adjacent condition authored only where botanically real. **pH is
 * untouched** — it stays a single scalar with no secondary.
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
 * A `{ primary, secondary? }` condition (decision 15). Only `light` and
 * `soilMoisture` use this shape; the secondary is a tolerable, adjacent fallback
 * that can rescue a graduated mismatch but never downgrades a lethal one.
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

export const plantSchema = z.object({
  slug: z.string(),
  commonName: z.string(),
  scientificName: z.string(),

  // Reshaped to primary/secondary (decision 15). pH below stays scalar.
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

  // Typical rooting depth — informs substrate-depth planning.
  rootDepthCm: z.number().nullish(),

  // Preferred substrate pH: numeric range (reference) + scored categorical band.
  soilPhMin: z.number().nullish(),
  soilPhMax: z.number().nullish(),
  phPreference: z.enum(PH_PREFERENCES).nullish(),

  growthRate: z.enum(GROWTH_RATES),
  substrateTags: z.array(z.string()).default([]),

  // Optional descriptive classifiers.
  growthHabit: z.enum(GROWTH_HABITS).nullish(),
  plantType: z.enum(PLANT_TYPES).nullish(),
  nativeBiome: z.enum(NATIVE_BIOMES).nullish(),
  rarity: z.enum(RARITIES).nullish(),

  closedTerrariumOk: z.boolean(),
  openTerrariumOk: z.boolean(),
  difficulty: z.number().int().min(1).max(5),
  notes: z.string().nullish(),

  // Open key/value extension point for plant-specific care details.
  specialNotes: z.record(z.string(), z.string()).nullish(),
});

export type Plant = z.infer<typeof plantSchema>;

/** Both declared conditions for a factor, primary first (secondary may be absent). */
export function lightValues(req: LightRequirement): LightLevel[] {
  return req.secondary ? [req.primary, req.secondary] : [req.primary];
}
export function moistureValues(req: MoistureRequirement): MoistureLevel[] {
  return req.secondary ? [req.primary, req.secondary] : [req.primary];
}
