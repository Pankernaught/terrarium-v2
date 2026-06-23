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
 *
 * Instruction strings carry inline glossary markup (the bracketed slug form from
 * ADR 0006/0009) for the jargon terms; render them through `<GlossaryText>`, not
 * a plain `<Text>`.
 */
import type { Container, Plant } from '../types';
import { copy } from '../lib/copy';

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
    drainageMaterial = 'pebbles or [[leca|LECA]]',
    substrateMix,
  } = opts;

  // Working steps without numbers; sequential `step` is stamped on at the end.
  const stepsData: Array<Omit<BuildStep, 'step'>> = [];

  // 1. Container Preparation (always present)
  stepsData.push({
    title: copy('guide.title.containerPrep'),
    instruction: copy('guide.containerPrep'),
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
      title: copy('guide.title.drainage'),
      instruction: copy('guide.drainage', { depth: actualDrainageDepth, material: drainageMaterial }),
    });
    stepsData.push({
      title: copy('guide.title.separation'),
      instruction: copy('guide.separation'),
    });
  }

  // 3b. Charcoal Layer — its own line, only when the build includes one. Sits
  // between the separation layer and the substrate.
  if (charcoalDepth != null && charcoalDepth > 0) {
    stepsData.push({
      title: copy('guide.title.charcoal'),
      instruction: copy('guide.charcoal', { depth: fmtCm(charcoalDepth) }),
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
      ? copy('guide.substrate.custom', {
          depth: actualSubstrateDepth,
          recipe: substrateMix.recipe,
          article: articleFor(substrateMix.character),
          character: substrateMix.character,
        })
      : copy('guide.substrate.standard', { depth: actualSubstrateDepth });

  stepsData.push({ title: copy('guide.title.substrate'), instruction: substrateInstruction });

  // 5. Plant Placement
  const sortedPlants = [...plants].sort((a, b) => b.maxHeightCm - a.maxHeightCm);
  const plantNames = sortedPlants.map((p) => p.commonName);
  const fastGrowers = plants.filter((p) => p.growthRate === 'fast').map((p) => p.commonName);

  let plantInstr = copy('guide.placement', { names: plantNames.join(', ') });
  if (fastGrowers.length > 0) {
    plantInstr += copy('guide.placement.fast', { names: fastGrowers.join(', ') });
  }

  stepsData.push({ title: copy('guide.title.placement'), instruction: plantInstr });

  // 6. Initial Watering
  const moistures = new Set(plants.map((p) => p.soilMoisture.primary));
  let wateringMode: string;
  if (moistures.has('wet') || moistures.has('moist')) {
    wateringMode = copy('guide.watering.thorough');
  } else if (moistures.has('moderate')) {
    wateringMode = copy('guide.watering.light');
  } else {
    wateringMode = copy('guide.watering.mist');
  }

  stepsData.push({
    title: copy('guide.title.watering'),
    instruction: copy('guide.watering', { mode: wateringMode }),
  });

  // 7. Sealing / Ventilation Setup
  let ventInstr: string;
  if (container.opening === 'sealed') {
    ventInstr = copy('guide.seal.sealed');
  } else if (container.opening === 'lidded') {
    ventInstr = copy('guide.seal.lidded');
  } else {
    ventInstr = copy('guide.seal.open');
  }

  stepsData.push({ title: copy('guide.title.sealing'), instruction: ventInstr });

  // 8. Light Placement — conflict-aware
  const lights = new Set(plants.map((p) => p.light.primary));
  let lightInstr: string;
  if (lights.size === 1) {
    lightInstr = copy('guide.light.single', { light: [...lights][0].replace('-', ' ') });
  } else if (lights.has('direct') && lights.size > 1) {
    const other = new Set(lights);
    other.delete('direct');
    if (other.has('low') || other.has('medium')) {
      lightInstr = copy('guide.light.conflictLowMed');
    } else {
      // direct + bright-indirect
      lightInstr = copy('guide.light.conflictBright');
    }
  } else if (lights.has('bright-indirect') && (lights.has('low') || lights.has('medium'))) {
    lightInstr = copy('guide.light.mixedBright');
  } else {
    // low + medium only
    lightInstr = copy('guide.light.mixedLow');
  }

  stepsData.push({ title: copy('guide.title.light'), instruction: lightInstr });

  // Attach sequential step numbers.
  return stepsData.map((s, i) => ({ step: i + 1, title: s.title, instruction: s.instruction }));
}
