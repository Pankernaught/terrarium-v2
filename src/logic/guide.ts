/**
 * One-time build-guide compiler (port of `engine/guide.py`).
 *
 * Produces the ordered physical-assembly steps for a terrarium build — distinct
 * from the ongoing care guide. Pure logic over `Plant` / `Container`; imports no
 * store.
 *
 * `light` and `soilMoisture` are `{ primary, secondary? }` objects rather than
 * scalars. The primary is the v1-scalar analog, so each of those reads becomes
 * `.light.primary` / `.soilMoisture.primary`. pH is untouched (and unused here).
 */
import type { Container, Plant } from '../types';

/** One ordered build step (camelCase mirror of the v1 `{step, title, instruction}` dict). */
export interface BuildStep {
  step: number;
  title: string;
  instruction: string;
}

/**
 * A custom substrate-mixer recipe for the guide's Substrate-Layer line.
 * Pre-formatted by the caller (which owns component labels in `src/data`) so this
 * module stays import-pure: `recipe` is the human "N parts …"
 * list and `character` is the soft `describeMix` phrase (e.g. "airy,
 * moisture-retentive"). When present, it names the concrete mix; when absent, the
 * step falls back to "a standard well-draining terrarium mix".
 */
export interface SubstrateMixGuide {
  recipe: string;
  character: string;
}

/** Optional overrides for {@link generateBuildGuide} (mirror of the v1 keyword args). */
export interface BuildGuideOptions {
  /**
   * The build's actual substrate-layer depth, in cm. Rendered verbatim ("5 cm").
   * If omitted/null, computed from plant heights as a preset range.
   */
  substrateDepth?: number | null;
  /**
   * The build's actual drainage-layer depth, in cm. `0` omits the drainage +
   * separation layers entirely; `> 0` renders them with this depth. If omitted/null,
   * computed from moisture preferences and volume.
   */
  drainageDepth?: number | null;
  /**
   * The build's actual charcoal-layer depth, in cm. `> 0` adds a charcoal step
   * between the separation and substrate layers; `0`/omitted skips it.
   */
  charcoalDepth?: number | null;
  /** Material string for the drainage-layer instruction. Defaults to "pebbles or LECA". */
  drainageMaterial?: string;
  /**
   * A custom substrate-mixer recipe. When present (non-empty `recipe`), the
   * Substrate-Layer step names the concrete mix + its character; when absent it
   * falls back to a standard-mix sentence.
   */
  substrateMix?: SubstrateMixGuide;
}

/** "a"/"an" for a character phrase — only the vowel-initial "airy" takes "an". */
function articleFor(phrase: string): string {
  return /^[aeiou]/i.test(phrase) ? 'an' : 'a';
}

/** Round a cm value to one decimal and stringify without a trailing `.0`. */
function fmtCm(value: number): string {
  return `${String(Number(value.toFixed(1)))} cm`;
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
    charcoalDepth,
    drainageMaterial = 'pebbles or LECA',
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

  // 2 & 3. Drainage & Separation Layers. The build's real depth drives the line:
  // `0` omits drainage entirely; `> 0` renders it; null/undefined falls back to a
  // moisture- and volume-derived preset.
  let addDrainage = true;
  if (drainageDepth != null) {
    addDrainage = drainageDepth > 0;
  } else if (container.volumeL < 1.0) {
    addDrainage = false;
  }

  if (addDrainage) {
    let actualDrainageDepth: string;
    if (drainageDepth != null && drainageDepth > 0) {
      actualDrainageDepth = fmtCm(drainageDepth);
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

  // 3b. Charcoal Layer — its own line, only when the build includes one. Sits
  // between the separation layer and the substrate.
  if (charcoalDepth != null && charcoalDepth > 0) {
    stepsData.push({
      title: 'Charcoal Layer',
      instruction: `Add ${fmtCm(charcoalDepth)} of horticultural charcoal over the separation layer to keep the build fresh.`,
    });
  }

  // 4. Substrate Layer — describes the substrate built in the container: its real
  // depth plus the concrete mix (or a standard mix when none was authored).
  let actualSubstrateDepth: string;
  if (substrateDepth != null) {
    actualSubstrateDepth = fmtCm(substrateDepth);
  } else {
    const hasTallPlants = plants.some((p) => p.maxHeightCm > 15);
    actualSubstrateDepth = hasTallPlants ? '6-8cm' : '3-5cm';
  }

  const substrateInstruction =
    substrateMix && substrateMix.recipe
      ? `Add ${actualSubstrateDepth} of your custom mix: ${substrateMix.recipe} — ` +
        `${articleFor(substrateMix.character)} ${substrateMix.character} blend.`
      : `Add ${actualSubstrateDepth} of a standard well-draining terrarium mix.`;

  stepsData.push({ title: 'Substrate Layer', instruction: substrateInstruction });

  // 5. Plant Placement
  const sortedPlants = [...plants].sort((a, b) => b.maxHeightCm - a.maxHeightCm);
  const plantNames = sortedPlants.map((p) => p.commonName);
  const fastGrowers = plants.filter((p) => p.growthRate === 'fast').map((p) => p.commonName);

  let plantInstr = `Plant the tallest or deepest-rooted plants first: ${plantNames.join(', ')}.`;
  if (fastGrowers.length > 0) {
    plantInstr += ` Note: ${fastGrowers.join(', ')} grow fast, so leave extra room around them.`;
  }

  stepsData.push({ title: 'Plant Placement', instruction: plantInstr });

  // 6. Initial Watering
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

  // 7. Sealing / Ventilation Setup
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

  // 8. Light Placement — conflict-aware
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
