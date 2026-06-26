/**
 * Customized care-guide compilation (port of `engine/care.py`).
 *
 * Walks the chosen plants + container and emits an ordered list of care tips:
 * Watering, Humidity, Light, Substrate, and — only when growth rates differ —
 * Trimming. Each tip is a `{ category, tip }` pair.
 *
 * **Decision 15 reshape:** v1 keyed watering off the scalar `p.soil_moisture`
 * and light off the scalar `p.light`. Those are now `{ primary, secondary? }`
 * objects, so the care text reads `.soilMoisture.primary` / `.light.primary` —
 * the primary is the v1-scalar analog (the happiest condition the tips describe).
 * pH is untouched (and unused here). Secondary conditions are intentionally
 * ignored: care copy speaks to a plant's preferred condition, not its tolerance.
 *
 * **All tip wording lives in `copy.json`** (`care.guide.*`), so every sentence the
 * care guide emits — and the notification bodies that reuse it — is editable from the
 * Plant Admin Copy tab (ADR 0010). This module owns only the branching that *picks*
 * which entry fires and the values it interpolates; it never holds prose.
 */
import type { Container, Plant } from '../types';
import { copy } from '../lib/copy';

/** A single care recommendation. Mirrors the v1 `{category, tip}` dict. */
export interface CareTip {
  category: string;
  tip: string;
}

/**
 * Generate a structured care plan tailored to the given plants and container.
 *
 * @throws if `plants` is empty.
 */
export function generateCareGuide(plants: Plant[], container: Container): CareTip[] {
  if (plants.length === 0) {
    throw new Error('At least one plant must be provided to generate a care guide.');
  }

  const careGuide: CareTip[] = [];

  // ==========================================================================
  // 1. Watering Guidelines
  // ==========================================================================
  const moistures = new Set(plants.map((p) => p.soilMoisture.primary));
  const dryLeaning = moistures.has('moderate') || moistures.has('dry');

  // Container openness is what actually governs watering in a terrarium, so the
  // prose leads with it: a sealed loop recycles its own water (read the glass, don't
  // water on a timer), a lidded one needs far less than a pot, and only an open
  // planting follows the moisture-led advice. (ADR 0014.)
  let wateringTip: string;
  if (container.opening === 'sealed') {
    wateringTip = copy('care.guide.water.sealed');
  } else if (container.opening === 'lidded') {
    wateringTip =
      copy('care.guide.water.lidded') +
      (dryLeaning ? ' ' + copy('care.guide.water.liddedDryClause') : '');
  } else if (moistures.has('wet') && moistures.size === 1) {
    wateringTip = copy('care.guide.water.wet');
  } else if (moistures.has('moist') || moistures.has('wet')) {
    wateringTip = moistures.has('dry')
      ? copy('care.guide.water.mixed')
      : copy('care.guide.water.moist');
  } else if (moistures.has('moderate')) {
    wateringTip = moistures.has('dry')
      ? copy('care.guide.water.moderateDry')
      : copy('care.guide.water.moderate');
  } else {
    wateringTip = copy('care.guide.water.dry');
  }

  careGuide.push({ category: 'Watering', tip: wateringTip });

  // ==========================================================================
  // 2. Humidity Guidelines
  // ==========================================================================
  const minHum = Math.max(...plants.map((p) => p.humidityPctRange[0]));
  const maxHum = Math.min(...plants.map((p) => p.humidityPctRange[1]));

  const targetRange =
    minHum <= maxHum
      ? `${Math.trunc(minHum)}%-${Math.trunc(maxHum)}%`
      : `above ${Math.trunc(minHum)}%`;

  const humidityTip = copy(`care.guide.humidity.${container.opening}`, { range: targetRange });

  careGuide.push({ category: 'Humidity', tip: humidityTip });

  // ==========================================================================
  // 3. Light Placement Guidelines
  // ==========================================================================
  const lights = new Set(plants.map((p) => p.light.primary));

  let lightTip: string;
  if (lights.has('direct')) {
    lightTip =
      lights.has('low') || lights.has('medium')
        ? copy('care.guide.light.conflict')
        : copy('care.guide.light.direct');
  } else if (lights.has('bright-indirect')) {
    lightTip = copy('care.guide.light.brightIndirect');
  } else if (lights.has('medium')) {
    lightTip = copy('care.guide.light.medium');
  } else {
    lightTip = copy('care.guide.light.low');
  }

  careGuide.push({ category: 'Light', tip: lightTip });

  // Substrate is built once and not "maintained", so the care guide intentionally
  // says nothing about it — the build guide owns the substrate description.

  // ==========================================================================
  // 5. Trimming Schedule (Conditional on mixed growth rates)
  // ==========================================================================
  const growthRates = new Set(plants.map((p) => p.growthRate));
  if (growthRates.size > 1) {
    const sortedRates = [...growthRates].sort();
    careGuide.push({
      category: 'Trimming',
      tip: copy('care.guide.trimming', { rates: sortedRates.join(', ') }),
    });
  }

  return careGuide;
}
