/**
 * Seed data loader — the single validated entry point to the bundled plants /
 * containers / presets. Every shipped record is re-validated against the zod
 * schemas here, so a malformed row fails the build/CI, not the device.
 *
 * **Base schema vs. seed schema.** `plantSchema` (in `src/types`) keeps some
 * fields optional so engine fixtures need not carry them. `seedPlantSchema`
 * tightens the rules that every *shipped* plant must satisfy:
 *   - `image` is required and non-empty — "every plant has an image."
 *   - the root-depth reference range is authored for all.
 *   - `substrateTags` are restricted to the frozen vocabulary.
 *
 * `imageCredit` / `imageLicense` ride here in the seed only — they must never
 * enter the backup/export payload.
 */
import { z } from 'zod';

import {
  containerSchema,
  glossaryEntrySchema,
  plantSchema,
  type Container,
  type GlossaryEntry,
  type Plant,
} from '../types';
import containersJson from './containers.json';
import glossaryJson from './glossary.json';
import plantsJson from './plants.json';
import { PRESETS, presetSchema, type Preset } from './presets';
import { isSubstrateComponentId } from './substrate-components';
import { glossaryMarkupSlugs } from '../logic/glossary-markup';

export const SEED_SCHEMA_VERSION = 1;

/** Stricter, seed-only plant contract layered on the permissive base schema. */
export const seedPlantSchema = plantSchema.extend({
  image: z.string().min(1),
  rootDepthMinCm: z.number(),
  rootDepthMaxCm: z.number(),
  substrateTags: z
    .array(z.string().refine(isSubstrateComponentId, 'substrate vocab is frozen'))
    .default([]),
});

function versioned<T>(
  raw: unknown,
  key: 'plants' | 'containers' | 'terms',
  file = `${key}.json`,
): T[] {
  const obj = raw as { schemaVersion?: number; [k: string]: unknown };
  if (obj.schemaVersion !== SEED_SCHEMA_VERSION) {
    throw new Error(`${file} schemaVersion ${obj.schemaVersion} != expected ${SEED_SCHEMA_VERSION}`);
  }
  return obj[key] as T[];
}

/** All seed plants, validated. Throws (fails CI) on any malformed record. */
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

/** All glossary terms, validated. Throws (fails CI) on any malformed record. */
export function loadGlossary(): GlossaryEntry[] {
  return z.array(glossaryEntrySchema).parse(versioned(glossaryJson, 'terms', 'glossary.json'));
}

/**
 * Lazily-indexed `slug → entry` lookup — the single resolver behind inline chip
 * links, prose `[[slug]]` links, and `seeAlso` cross-links. Vocab callers compute
 * the slug with `vocabSlug(category, value)` (see `src/types/glossary.ts`).
 */
let glossaryIndex: Map<string, GlossaryEntry> | null = null;
export function lookupTerm(slug: string): GlossaryEntry | undefined {
  glossaryIndex ??= new Map(loadGlossary().map((e) => [e.slug, e]));
  return glossaryIndex.get(slug);
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

  // Inline glossary links in care prose must resolve (ADR 0006) — a typo'd
  // `[[slug]]` fails the build here instead of dead-linking on the device.
  for (const plant of plants) {
    for (const field of [plant.notes, plant.nativeContext]) {
      if (!field) continue;
      for (const slug of glossaryMarkupSlugs(field)) {
        if (!lookupTerm(slug)) {
          throw new Error(`plant ${plant.slug}: unresolved glossary link [[${slug}]]`);
        }
      }
    }
  }

  return { schemaVersion: SEED_SCHEMA_VERSION, plants, containers, presets };
}

export { PRESETS, presetSchema, type Preset } from './presets';
export * from './substrate-components';
