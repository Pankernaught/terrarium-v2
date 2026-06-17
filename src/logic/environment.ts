/**
 * Plant environmental-envelope derivation (port of `engine/environment.py`).
 *
 * Intersects the numeric ranges (humidity, temperature) and unions the
 * categorical sets. An inverted numeric result (min > max) signals no viable
 * overlap — the caller detects and reports it.
 *
 * **Decision 15 ripple:** the categorical union now spans each plant's
 * `primary ∪ secondary` for light and soil moisture. This widens the **display**
 * sets only — the recommender re-runs `checkPair` and never reads the envelope,
 * so the union cannot over-widen scoring.
 */
import type { EnvEnvelope, LightLevel, MoistureLevel, Plant } from '../types';

function collectLights(into: Set<LightLevel>, p: Plant): void {
  into.add(p.light.primary);
  if (p.light.secondary) into.add(p.light.secondary);
}

function collectMoisture(into: Set<MoistureLevel>, p: Plant): void {
  into.add(p.soilMoisture.primary);
  if (p.soilMoisture.secondary) into.add(p.soilMoisture.secondary);
}

/**
 * Derive a combined environmental envelope for a list of plants.
 *
 * @throws if `plants` is empty.
 */
export function deriveEnvelope(plants: Plant[]): EnvEnvelope {
  if (plants.length === 0) {
    throw new Error('Cannot derive an environmental envelope for an empty plant list.');
  }

  const first = plants[0];
  let humidityMin = first.humidityPctRange[0];
  let humidityMax = first.humidityPctRange[1];
  let tempMin = first.tempCRange[0];
  let tempMax = first.tempCRange[1];
  const lights = new Set<LightLevel>();
  const moisture = new Set<MoistureLevel>();
  collectLights(lights, first);
  collectMoisture(moisture, first);

  for (const p of plants.slice(1)) {
    humidityMin = Math.max(humidityMin, p.humidityPctRange[0]);
    humidityMax = Math.min(humidityMax, p.humidityPctRange[1]);
    tempMin = Math.max(tempMin, p.tempCRange[0]);
    tempMax = Math.min(tempMax, p.tempCRange[1]);
    collectLights(lights, p);
    collectMoisture(moisture, p);
  }

  return {
    humidityMin,
    humidityMax,
    tempMin,
    tempMax,
    // `sorted()` in v1 is lexicographic; mirror it for a stable display order.
    compatibleLights: [...lights].sort(),
    compatibleMoisture: [...moisture].sort(),
  };
}
