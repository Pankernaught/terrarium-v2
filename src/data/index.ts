/**
 * Seed data loader (Phase 3) — the single validated entry point to the bundled
 * plants / containers / presets. Every shipped record is re-validated against the
 * Phase-2 zod schemas here, so a malformed row fails the build/CI, not the device.
 *
 * **Base schema vs. seed schema.** `plantSchema` (in `src/types`) keeps the Phase-3
 * additions optional so engine fixtures need not carry them. `seedPlantSchema`
 * tightens the rules that every *shipped* plant must satisfy (decisions 11/12):
 *   - `image` is required and non-empty — "every plant has an image."
 *   - the root-depth reference range is authored for all.
 *   - `substrateTags` / `hardscapeTags` are restricted to the frozen vocabulary.
 *
 * `imageCredit` / `imageLicense` ride here in the seed only — they must never enter
 * the backup/export payload (decision 17/18).
 */
import { z } from 'zod';

import { containerSchema, plantSchema, type Container, type Plant } from '../types';
import containersJson from './containers.json';
import plantsJson from './plants.json';
import { PRESETS, presetSchema, type Preset } from './presets';
import {
  isHardscapeComponentId,
  isSubstrateComponentId,
} from './substrate-components';

export const SEED_SCHEMA_VERSION = 1;

/** Stricter, seed-only plant contract layered on the permissive base schema. */
export const seedPlantSchema = plantSchema.extend({
  image: z.string().min(1),
  rootDepthMinCm: z.number(),
  rootDepthMaxCm: z.number(),
  substrateTags: z
    .array(z.string().refine(isSubstrateComponentId, 'substrate vocab is frozen (decision 12)'))
    .default([]),
  hardscapeTags: z
    .array(z.string().refine(isHardscapeComponentId, 'hardscape vocab is frozen (decision 12)'))
    .optional(),
});

function versioned<T>(raw: unknown, key: 'plants' | 'containers'): T[] {
  const obj = raw as { schemaVersion?: number; [k: string]: unknown };
  if (obj.schemaVersion !== SEED_SCHEMA_VERSION) {
    throw new Error(
      `${key}.json schemaVersion ${obj.schemaVersion} != expected ${SEED_SCHEMA_VERSION}`,
    );
  }
  return obj[key] as T[];
}

/** All 67 seed plants, validated. Throws (fails CI) on any malformed record. */
export function loadPlants(): Plant[] {
  return z.array(seedPlantSchema).parse(versioned(plantsJson, 'plants'));
}

/** All 16 seed containers, validated. */
export function loadContainers(): Container[] {
  return z.array(containerSchema).parse(versioned(containersJson, 'containers'));
}

/** The 3–5 onboarding presets, validated. */
export function loadPresets(): Preset[] {
  return z.array(presetSchema).parse(PRESETS);
}

/** Validated seed bundle + cross-record referential-integrity check. */
export function loadSeed(): {
  schemaVersion: number;
  plants: Plant[];
  containers: Container[];
  presets: Preset[];
} {
  const plants = loadPlants();
  const containers = loadContainers();
  const presets = loadPresets();

  const plantSlugs = new Set(plants.map((p) => p.slug));
  const containerSlugs = new Set(containers.map((c) => c.slug));
  for (const preset of presets) {
    if (!containerSlugs.has(preset.containerSlug)) {
      throw new Error(`preset ${preset.slug}: unknown container ${preset.containerSlug}`);
    }
    for (const placement of preset.placements) {
      if (!plantSlugs.has(placement.slug)) {
        throw new Error(`preset ${preset.slug}: unknown plant ${placement.slug}`);
      }
    }
  }

  return { schemaVersion: SEED_SCHEMA_VERSION, plants, containers, presets };
}

export { PRESETS, presetSchema, type Preset } from './presets';
export * from './substrate-components';
