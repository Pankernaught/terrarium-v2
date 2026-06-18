/**
 * One-time build-guide compiler (port of `engine/guide.py`).
 *
 * Produces the ordered physical-assembly steps for a terrarium build — distinct
 * from the ongoing care guide. Pure logic over `Plant` / `Container`; imports no
 * store.
 *
 * **Decision 15 ripple:** v1 read `p.light` and `p.soil_moisture` as scalars to
 * group plants, pick step text and decide watering/light copy. The primary is the
 * v1-scalar analog, so each of those reads becomes `.light.primary` /
 * `.soilMoisture.primary`. pH is untouched (and unused here).
 */
import type { Container, Plant } from '../types';

/** One ordered build step (camelCase mirror of the v1 `{step, title, instruction}` dict). */
export interface BuildStep {
  step: number;
  title: string;
  instruction: string;
}

/**
 * A custom substrate-mixer recipe for the guide's Substrate-Layer line (decision 10
 * / Phase 8). Pre-formatted by the caller (which owns component labels in
 * `src/data`) so this module stays import-pure: `recipe` is the human "N parts …"
 * list and `character` is the soft `describeMix` phrase (e.g. "airy,
 * moisture-retentive"). When present, it replaces the default `substrateTags`
 * sentence; when absent, that sentence is unchanged.
 */
export interface SubstrateMixGuide {
  recipe: string;
  character: string;
}

/** Optional overrides for {@link generateBuildGuide} (mirror of the v1 keyword args). */
export interface BuildGuideOptions {
  /** Override substrate depth ("3-5cm" | "6-8cm"). If omitted, computed from plant heights. */
  substrateDepth?: string;
  /**
   * Override drainage depth ("1cm" | "2-3cm" | "skip" to omit drainage + separation
   * layers entirely). If omitted, computed from moisture preferences and volume.
   */
  drainageDepth?: string;
  /** Material string for the drainage-layer instruction. Defaults to "pebbles or LECA". */
  drainageMaterial?: string;
  /**
   * If `true`, always include the hardscape step; if `false`, always skip it; if
   * omitted, include only when substrate tags contain "rock" or "wood".
   */
  includeHardscape?: boolean;
  /**
   * A custom substrate-mixer recipe (Phase 8). When present (non-empty `recipe`),
   * the Substrate-Layer step describes the concrete mix + its character instead of
   * the generic `substrateTags` sentence.
   */
  substrateMix?: SubstrateMixGuide;
}

/** "a"/"an" for a character phrase — only the vowel-initial "airy" takes "an". */
function articleFor(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? 'an' : 'a';
}

/**
 * Generate a one-time, step-by-step setup guide for building this terrarium.
 *
 * @throws if `plants` is empty.
 */
export function generateBuildGuide(
  plants: Plant[],
  container: Container,
  opts: BuildGuideOptions = {},
): BuildStep[] {
  if (plants.length === 0) {
    throw new Error('At least one plant must be provided to generate a build guide.');
  }

  const {
    substrateDepth,
    drainageDepth,
    drainageMaterial = 'pebbles or LECA',
    includeHardscape,
    substrateMix,
  } = opts;

  // Working steps without numbers; sequential `step` is stamped on at the end.
  const stepsData: Array<Omit<BuildStep, 'step'>> = [];

  // 1. Container Preparation (always present)
  stepsData.push({
    title: 'Container Preparation',
    instruction:
      'Clean the container with warm water (no soap) and ensure it is fully dry before starting.',
  });

  // 2 & 3. Drainage & Separation Layers
  let addDrainage = true;
  if (drainageDepth === 'skip') {
    addDrainage = false;
  } else if (drainageDepth === undefined && container.volumeL < 1.0) {
    addDrainage = false;
  }

  if (addDrainage) {
    let actualDrainageDepth: string;
    if (drainageDepth !== undefined && drainageDepth !== 'skip') {
      actualDrainageDepth = drainageDepth;
    } else {
      const hasWetMoist = plants.some(
        (p) => p.soilMoisture.primary === 'wet' || p.soilMoisture.primary === 'moist',
      );
      actualDrainageDepth = hasWetMoist ? '2-3cm' : '1cm';
    }

    stepsData.push({
      title: 'Drainage Layer',
      instruction: `Add ${actualDrainageDepth} of ${drainageMaterial} to the bottom.`,
    });
    stepsData.push({
      title: 'Separation Layer',
      instruction:
        'Add a thin layer of sphagnum moss or fine mesh over the drainage layer to prevent substrate mixing.',
    });
  }

  // 4. Substrate Layer
  const allTags = new Set<string>();
  for (const p of plants) {
    for (const tag of p.substrateTags) allTags.add(tag);
  }
  const tagsStr = allTags.size > 0 ? [...allTags].sort().join(', ') : 'standard terrarium mix';

  let actualSubstrateDepth: string;
  if (substrateDepth !== undefined) {
    actualSubstrateDepth = substrateDepth;
  } else {
    const hasTallPlants = plants.some((p) => p.maxHeightCm > 15);
    actualSubstrateDepth = hasTallPlants ? '6-8cm' : '3-5cm';
  }

  // A custom mixer recipe (decision 10) supersedes the generic substrate-tags
  // sentence; with no recipe, the original tags line is unchanged (the fallback).
  const substrateInstruction =
    substrateMix && substrateMix.recipe
      ? `Add ${actualSubstrateDepth} of your custom mix: ${substrateMix.recipe} — ` +
        `${articleFor(substrateMix.character)} ${substrateMix.character} blend.`
      : `Add ${actualSubstrateDepth} of substrate explicitly supporting: ${tagsStr}.`;

  stepsData.push({ title: 'Substrate Layer', instruction: substrateInstruction });

  // 5. Hardscape Placement
  if (
    includeHardscape === true ||
    (includeHardscape === undefined && (allTags.has('rock') || allTags.has('wood')))
  ) {
    stepsData.push({
      title: 'Hardscape Placement',
      instruction:
        'Place your rocks or wood pieces now, anchoring them firmly into the substrate before planting.',
    });
  }

  // 6. Plant Placement
  const sortedPlants = [...plants].sort((a, b) => b.maxHeightCm - a.maxHeightCm);
  const plantNames = sortedPlants.map((p) => p.commonName);
  const fastGrowers = plants.filter((p) => p.growthRate === 'fast').map((p) => p.commonName);

  let plantInstr = `Plant the tallest or deepest-rooted plants first: ${plantNames.join(', ')}.`;
  if (fastGrowers.length > 0) {
    plantInstr += ` Note: ${fastGrowers.join(', ')} grow fast, so leave extra room around them.`;
  }

  stepsData.push({ title: 'Plant Placement', instruction: plantInstr });

  // 7. Initial Watering
  const moistures = new Set(plants.map((p) => p.soilMoisture.primary));
  let wateringMode: string;
  if (moistures.has('wet') || moistures.has('moist')) {
    wateringMode = 'water thoroughly';
  } else if (moistures.has('moderate')) {
    wateringMode = 'water lightly';
  } else {
    wateringMode = 'barely mist';
  }

  stepsData.push({
    title: 'Initial Watering',
    instruction: `Based on these plants' needs, ${wateringMode} the terrarium.`,
  });

  // 8. Sealing / Ventilation Setup
  let ventInstr: string;
  if (container.opening === 'sealed') {
    ventInstr =
      'Seal the container completely and place in indirect light for 48 hours to stabilise.';
  } else if (container.opening === 'lidded') {
    ventInstr =
      'Close the lid, but crack it open briefly each day for the first week to allow gas exchange.';
  } else {
    ventInstr = 'No sealing needed. Monitor humidity closely during the first week.';
  }

  stepsData.push({ title: 'Sealing / Ventilation Setup', instruction: ventInstr });

  // 9. Light Placement — conflict-aware
  const lights = new Set(plants.map((p) => p.light.primary));
  let lightInstr: string;
  if (lights.size === 1) {
    lightInstr = `Place in ${[...lights][0].replace('-', ' ')} light.`;
  } else if (lights.has('direct') && lights.size > 1) {
    const other = new Set(lights);
    other.delete('direct');
    if (other.has('low') || other.has('medium')) {
      lightInstr =
        'Conflicting light needs: some plants need direct sun, others prefer low or medium light. ' +
        'Place in bright indirect light as a compromise — watch sun-lovers for etiolation ' +
        'and shade plants for bleaching.';
    } else {
      // direct + bright-indirect
      lightInstr =
        'Direct and bright-indirect light requirements conflict. Place in bright indirect light. ' +
        'Direct sun through glass creates dangerous heat buildup in enclosed containers.';
    }
  } else if (lights.has('bright-indirect') && (lights.has('low') || lights.has('medium'))) {
    lightInstr =
      'Mixed light needs. Position in medium-bright indirect light — slightly further from ' +
      'the window than optimal for the bright-indirect plants to protect low-light ones.';
  } else {
    // low + medium only
    lightInstr =
      'Mixed low and medium light needs. A medium-low indirect light spot works well ' +
      '— a few feet back from a bright window.';
  }

  stepsData.push({ title: 'Light Placement', instruction: lightInstr });

  // Attach sequential step numbers.
  return stepsData.map((s, i) => ({ step: i + 1, title: s.title, instruction: s.instruction }));
}
