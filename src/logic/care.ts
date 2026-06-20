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
 */
import type { Container, Plant } from '../types';

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

  let wateringTip: string;
  if (moistures.has('wet') && moistures.size === 1) {
    wateringTip =
      'Keep the substrate consistently saturated and wet. Ensure there is ' +
      'steady water pooling slightly at the base of the drainage layer at all times.';
  } else if (moistures.has('moist') || moistures.has('wet')) {
    if (moistures.has('dry')) {
      wateringTip =
        'Mixed moisture needs detected. Target watering precisely toward the roots ' +
        'of moisture-loving plants while allowing sections housing dry-tolerant ' +
        'varieties to stay well-drained. Avoid uniform overwatering.';
    } else {
      wateringTip =
        'Keep the substrate consistently damp but not waterlogged or soggy. ' +
        'Water evenly whenever the top surface begins to feel slightly dry.';
    }
  } else if (moistures.has('moderate')) {
    if (moistures.has('dry')) {
      wateringTip =
        'Allow the top layer of the substrate to dry out noticeably between waterings. ' +
        'Be highly conservative with watering to safely accommodate dry-tolerant species.';
    } else {
      wateringTip =
        'Allow the top half-inch of the substrate to dry out between waterings, ' +
        'then water moderately to re-moisten without fully saturating the lower profile.';
    }
  } else {
    wateringTip =
      'Water very sparingly. Allow the substrate to dry out completely between waterings ' +
      'to prevent root rot.';
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

  let humidityTip: string;
  if (container.opening === 'sealed') {
    humidityTip =
      `This sealed container naturally traps ambient moisture to maintain high ` +
      `humidity levels (${targetRange}). Monitor for excessive glass condensation; ` +
      `if the walls remain completely fogged for over 48 hours, open the enclosure ` +
      `for a few hours to vent stale air, then reseal.`;
  } else if (container.opening === 'lidded') {
    humidityTip =
      `This lidded container helps retain elevated humidity levels (${targetRange}). ` +
      `Keep the lid closed and mist periodically only when internal air circulation ` +
      `or the substrate surface feels notably dry.`;
  } else {
    // open container
    humidityTip =
      `This open container allows humidity to dissipate rapidly into the surrounding room. ` +
      `Since your selected plants thrive with higher humidity (${targetRange}), ` +
      `mist the foliage frequently, utilize an automated mister, or position a pebble ` +
      `tray underneath the container to boost local humidity levels.`;
  }

  careGuide.push({ category: 'Humidity', tip: humidityTip });

  // ==========================================================================
  // 3. Light Placement Guidelines
  // ==========================================================================
  const lights = new Set(plants.map((p) => p.light.primary));

  let lightTip: string;
  if (lights.has('direct')) {
    if (lights.has('low') || lights.has('medium')) {
      lightTip =
        'Highly conflicting light requirements detected within this ecosystem. ' +
        'Place the terrarium in bright, indirect sunlight as a fragile compromise. Monitor ' +
        'direct-sun plants for stretching (etiolation) and low-light varieties for leaf bleaching.';
    } else {
      lightTip =
        'Place in a location that receives several hours of direct sunlight daily. ' +
        'Monitor temperature closely, as enclosed glass containers can create a greenhouse ' +
        'effect and overheat rapidly under direct sun rays.';
    }
  } else if (lights.has('bright-indirect')) {
    lightTip =
      'Position the setup in bright, indirect sunlight (such as close to an east-facing window ' +
      'or behind a sheer curtain on a south/west window). This provides optimal energy ' +
      'while safeguarding delicate leaves from scorching.';
  } else if (lights.has('medium')) {
    lightTip =
      'Place in a medium indirect light environment or a few feet back from a primary light window. ' +
      'Avoid deep, dark corners as well as intense, burning direct sun rays.';
  } else {
    lightTip =
      'Tolerates low-light baselines exceptionally well. Ideal for north-facing windows, ' +
      'lower-light rooms, or placements sitting deeper within a brightly lit living area.';
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
    const trimmingTip =
      `Mixed growth rates detected within the enclosure (${sortedRates.join(', ')}). ` +
      `Regular pruning intervals are highly recommended: monitor fast-growing elements ` +
      `closely and trim them back regularly to prevent them from choking out slower companions ` +
      `or creating canopy shadows that block valuable light.`;
    careGuide.push({ category: 'Trimming', tip: trimmingTip });
  }

  return careGuide;
}
