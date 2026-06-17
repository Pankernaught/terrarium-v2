/**
 * Pairwise and group compatibility engines (port of `engine/compatibility.py`).
 *
 * Scoring starts at 100 and deducts per conflict on the v1 ladder; a
 * survival-critical conflict clamps the score to `SURVIVAL_SCORE_CEILING` (40),
 * forcing an "incompatible" verdict. The constants in `./constants` ARE the rules.
 *
 * **Primary/secondary (decision 15) — the only divergence.** Only `light` and
 * `soilMoisture` carry a `{ primary, secondary? }`; pH is untouched. The graduated
 * tier scores the *best-matching* pair across the primary/secondary cross-product;
 * a best pair at distance 0 reached **only via a secondary** still deducts the
 * one-step caution penalty (never a free 100). The survival/lethal tier is judged
 * on **primaries only** — a secondary never downgrades a lethal primary conflict.
 * `growthRate` is intentionally NOT scored here (it is a once-surfaced care note).
 */
import {
  type CompatibilityResult,
  type Conflict,
  type Container,
  type GroupReport,
  type Plant,
  type Verdict,
  lightValues,
  moistureValues,
} from '../types';
import {
  CONTAINER_TYPE_SURVIVAL_PENALTY,
  CROWDING_MAX_PLANTS_ERROR,
  CROWDING_MAX_PLANTS_WARNING,
  CROWDING_VOLUME_THRESHOLD_L,
  GAS_EXCHANGE_SEALED_THRESHOLD_L,
  HUMIDITY_PENALTY,
  LIGHT_CAUTION_PENALTY,
  LIGHT_INCOMPATIBLE_PENALTY,
  LIGHT_ORDER,
  LIGHT_SURVIVAL_PENALTY,
  MOISTURE_ONE_STEP_PENALTY,
  MOISTURE_ORDER,
  MOISTURE_SURVIVAL_GAP,
  MOISTURE_SURVIVAL_PENALTY,
  MOISTURE_TWO_STEP_PENALTY,
  PH_CAUTION_PENALTY,
  PH_ORDER,
  PH_SURVIVAL_GAP,
  PH_SURVIVAL_PENALTY,
  SHADE_LIGHTS,
  SURVIVAL_SCORE_CEILING,
  TEMPERATURE_PENALTY,
  VERDICT_CAUTION_MIN,
  VERDICT_COMPATIBLE_MIN,
} from './constants';
import { deriveEnvelope } from './environment';

/** True if the two closed intervals share any common point. */
function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return Math.max(minA, minB) <= Math.min(maxA, maxB);
}

function verdict(score: number): Verdict {
  if (score >= VERDICT_COMPATIBLE_MIN) return 'compatible';
  if (score >= VERDICT_CAUTION_MIN) return 'caution';
  return 'incompatible';
}

/**
 * Best (minimum) adjacency distance across the primary/secondary cross-product,
 * plus the primary-only distance. `viaSecondary` is true when a secondary value
 * produced a strictly closer match than the primaries alone (decision 15a). The
 * `*Values` helpers always return the primary at index 0.
 */
function bestAdjacency<T extends string>(
  aVals: readonly T[],
  bVals: readonly T[],
  order: Record<T, number>,
): { bestDist: number; primaryDist: number; viaSecondary: boolean } {
  let bestDist = Infinity;
  for (const x of aVals) {
    for (const y of bVals) {
      bestDist = Math.min(bestDist, Math.abs(order[x] - order[y]));
    }
  }
  const primaryDist = Math.abs(order[aVals[0]] - order[bVals[0]]);
  return { bestDist, primaryDist, viaSecondary: bestDist < primaryDist };
}

/** Spread the optional `viaSecondary: true` only when set (keeps it absent otherwise). */
function annotate(viaSecondary: boolean): { viaSecondary?: true } {
  return viaSecondary ? { viaSecondary: true } : {};
}

/**
 * Check pairwise compatibility between two plants.
 *
 * Graduated weights: light up to 30, humidity 25, soil moisture up to 14,
 * temperature 15, substrate pH 7 (caution). Survival-critical tier (35, clamps
 * to 40): extreme light gap (direct + low/medium primaries) and extreme watering
 * gap (dry + wet primaries), plus acidic + alkaline pH. Verdict: >= 80 compatible,
 * >= 50 caution, < 50 incompatible.
 */
export function checkPair(a: Plant, b: Plant): CompatibilityResult {
  let score = 100;
  const conflicts: Conflict[] = [];
  let survivalCritical = false;

  // --- Light (survival 35 on primaries; else graduated 15/30) -------------
  const aLight = a.light.primary;
  const bLight = b.light.primary;
  const lightSurvival =
    (aLight === 'direct' || bLight === 'direct') &&
    (SHADE_LIGHTS.has(aLight) || SHADE_LIGHTS.has(bLight));

  if (lightSurvival) {
    score -= LIGHT_SURVIVAL_PENALTY;
    survivalCritical = true;
    // 15b: survival is decided on primaries; suppress the "via secondary" note.
    conflicts.push({
      factor: 'light',
      severity: 'incompatible',
      message:
        `${a.commonName} needs ${aLight} light and ${b.commonName} needs ${bLight} light — ` +
        'direct sunlight through glass creates a greenhouse effect and will cook ' +
        'shade-adapted plants — lethal.',
      affectedPlants: [a.slug, b.slug],
    });
  } else {
    const { bestDist, viaSecondary } = bestAdjacency(
      lightValues(a.light),
      lightValues(b.light),
      LIGHT_ORDER,
    );
    if (bestDist === 0) {
      if (viaSecondary) {
        // 15a distance-0 cap: a secondary-only exact match is a mild caution, not a free 100.
        score -= LIGHT_CAUTION_PENALTY;
        conflicts.push({
          factor: 'light',
          severity: 'caution',
          message:
            `${a.commonName} prefers ${aLight} light; ${b.commonName} prefers ${bLight} — ` +
            'they overlap only on a secondary (tolerated) light level.',
          affectedPlants: [a.slug, b.slug],
          viaSecondary: true,
        });
      }
    } else if (bestDist === 1) {
      score -= LIGHT_CAUTION_PENALTY;
      conflicts.push({
        factor: 'light',
        severity: 'caution',
        message:
          `${a.commonName} prefers ${aLight} light; ${b.commonName} prefers ${bLight} — ` +
          'one step apart, manageable.',
        affectedPlants: [a.slug, b.slug],
        ...annotate(viaSecondary),
      });
    } else {
      // bestDist >= 2
      score -= LIGHT_INCOMPATIBLE_PENALTY;
      const involvesDirect = aLight === 'direct' || bLight === 'direct';
      const message = involvesDirect
        ? `${a.commonName} needs ${aLight} light; ${b.commonName} needs ${bLight} — ` +
          'direct sunlight through glass creates a greenhouse effect and will cook ' +
          'shade-adapted plants — lethal.'
        : `${a.commonName} needs ${aLight} light but ${b.commonName} needs ${bLight} — ` +
          'requirements too far apart.';
      conflicts.push({
        factor: 'light',
        severity: 'incompatible',
        message,
        affectedPlants: [a.slug, b.slug],
        ...annotate(viaSecondary),
      });
    }
  }

  // --- Humidity (25 pts) --------------------------------------------------
  if (
    !rangesOverlap(
      a.humidityPctRange[0],
      a.humidityPctRange[1],
      b.humidityPctRange[0],
      b.humidityPctRange[1],
    )
  ) {
    score -= HUMIDITY_PENALTY;
    conflicts.push({
      factor: 'humidity',
      severity: 'incompatible',
      message:
        `${a.commonName} needs ${a.humidityPctRange[0]}–${a.humidityPctRange[1]}% humidity; ` +
        `${b.commonName} needs ${b.humidityPctRange[0]}–${b.humidityPctRange[1]}% — no overlap.`,
      affectedPlants: [a.slug, b.slug],
    });
  }

  // --- Soil moisture (survival 35 on primaries for dry+wet; else 7/14) ----
  const aMoist = a.soilMoisture.primary;
  const bMoist = b.soilMoisture.primary;
  const primaryMoistureDiff = Math.abs(MOISTURE_ORDER[aMoist] - MOISTURE_ORDER[bMoist]);

  if (primaryMoistureDiff >= MOISTURE_SURVIVAL_GAP) {
    score -= MOISTURE_SURVIVAL_PENALTY;
    survivalCritical = true;
    conflicts.push({
      factor: 'soil_moisture',
      severity: 'incompatible',
      message:
        `Severe moisture conflict: ${a.commonName} (${aMoist}) vs ${b.commonName} (${bMoist}) — ` +
        "matching a plant's moisture preference is essential; plants thrive in a terrarium " +
        'that mimics their native environment.',
      affectedPlants: [a.slug, b.slug],
    });
  } else {
    const { bestDist, viaSecondary } = bestAdjacency(
      moistureValues(a.soilMoisture),
      moistureValues(b.soilMoisture),
      MOISTURE_ORDER,
    );
    if (bestDist === 0) {
      if (viaSecondary) {
        score -= MOISTURE_ONE_STEP_PENALTY;
        conflicts.push({
          factor: 'soil_moisture',
          severity: 'caution',
          message:
            `${a.commonName} prefers ${aMoist}; ${b.commonName} prefers ${bMoist} — ` +
            'they overlap only on a secondary (tolerated) moisture level.',
          affectedPlants: [a.slug, b.slug],
          viaSecondary: true,
        });
      }
    } else if (bestDist === 1) {
      score -= MOISTURE_ONE_STEP_PENALTY;
      conflicts.push({
        factor: 'soil_moisture',
        severity: 'caution',
        message:
          `${a.commonName} prefers ${aMoist}; ${b.commonName} prefers ${bMoist} — ` +
          'one step apart, manageable with care.',
        affectedPlants: [a.slug, b.slug],
        ...annotate(viaSecondary),
      });
    } else {
      // bestDist === 2
      score -= MOISTURE_TWO_STEP_PENALTY;
      conflicts.push({
        factor: 'soil_moisture',
        severity: 'caution',
        message:
          `Moisture mismatch: ${a.commonName} (${aMoist}) vs ${b.commonName} (${bMoist}) — ` +
          'two steps apart.',
        affectedPlants: [a.slug, b.slug],
        ...annotate(viaSecondary),
      });
    }
  }

  // --- Temperature (15 pts) -----------------------------------------------
  if (
    !rangesOverlap(
      a.tempCRange[0],
      a.tempCRange[1],
      b.tempCRange[0],
      b.tempCRange[1],
    )
  ) {
    score -= TEMPERATURE_PENALTY;
    conflicts.push({
      factor: 'temperature',
      severity: 'incompatible',
      message:
        `${a.commonName}: ${a.tempCRange[0]}–${a.tempCRange[1]}°C; ` +
        `${b.commonName}: ${b.tempCRange[0]}–${b.tempCRange[1]}°C — ` +
        'temperature ranges do not overlap.',
      affectedPlants: [a.slug, b.slug],
    });
  }

  // --- Substrate pH (survival 35 for acidic+alkaline; else caution 7) -----
  // Only scored when both plants declare a preference. pH has no secondary.
  if (a.phPreference && b.phPreference) {
    const phDiff = Math.abs(PH_ORDER[a.phPreference] - PH_ORDER[b.phPreference]);
    if (phDiff >= PH_SURVIVAL_GAP) {
      score -= PH_SURVIVAL_PENALTY;
      survivalCritical = true;
      conflicts.push({
        factor: 'soil_ph',
        severity: 'incompatible',
        message:
          `${a.commonName} needs ${a.phPreference} substrate and ${b.commonName} needs ` +
          `${b.phPreference} — a single shared substrate cannot be both acidic and alkaline; ` +
          'one plant will decline regardless of care.',
        affectedPlants: [a.slug, b.slug],
      });
    } else if (phDiff === 1) {
      score -= PH_CAUTION_PENALTY;
      conflicts.push({
        factor: 'soil_ph',
        severity: 'caution',
        message:
          `${a.commonName} prefers ${a.phPreference} substrate; ${b.commonName} prefers ` +
          `${b.phPreference} — one band apart. A near-neutral mix keeps both within tolerance.`,
        affectedPlants: [a.slug, b.slug],
      });
    }
  }

  // growthRate is intentionally NOT scored (a once-surfaced "Trimming" care note).

  if (survivalCritical) score = Math.min(score, SURVIVAL_SCORE_CEILING);
  score = Math.max(0, score);

  return { score, verdict: verdict(score), conflicts, survivalCritical };
}

/**
 * Group-score deduction for a container-fit conflict. Container-type
 * incompatibility is survival-critical (35); other incompatible issues deduct
 * 20; cautions deduct 5.
 */
function containerPenalty(c: Conflict): number {
  if (c.factor === 'container_type' && c.severity === 'incompatible') {
    return CONTAINER_TYPE_SURVIVAL_PENALTY;
  }
  if (c.severity === 'incompatible') return 20;
  return 5;
}

/**
 * Evaluate a full group of plants within a container. Overall score = average of
 * the upper-triangle pair scores minus container penalties, clamped to 40 if any
 * survival-critical conflict (container-type or a survival-critical pair) exists.
 *
 * @throws if `plants` is empty.
 */
export function checkGroup(plants: Plant[], container: Container): GroupReport {
  if (plants.length === 0) {
    throw new Error('Cannot evaluate an empty plant list.');
  }

  // --- Pairwise matrix ----------------------------------------------------
  const pairMatrix: Record<string, Record<string, CompatibilityResult>> = {};
  const upperScores: number[] = [];

  for (let i = 0; i < plants.length; i++) {
    const a = plants[i];
    pairMatrix[a.slug] = {};
    for (let j = 0; j < plants.length; j++) {
      const b = plants[j];
      if (i === j) {
        pairMatrix[a.slug][b.slug] = {
          score: 100,
          verdict: 'compatible',
          conflicts: [],
          survivalCritical: false,
        };
      } else {
        const result = checkPair(a, b);
        pairMatrix[a.slug][b.slug] = result;
        if (i < j) upperScores.push(result.score);
      }
    }
  }

  // --- Container fit ------------------------------------------------------
  const containerFitIssues: Conflict[] = [];
  for (const plant of plants) {
    if (
      (container.opening === 'sealed' || container.opening === 'lidded') &&
      !plant.closedTerrariumOk
    ) {
      containerFitIssues.push({
        factor: 'container_type',
        severity: 'incompatible',
        message: `${plant.commonName} is not suitable for closed/lidded terrariums.`,
        affectedPlants: [plant.slug],
      });
    } else if (container.opening === 'open' && !plant.openTerrariumOk) {
      containerFitIssues.push({
        factor: 'container_type',
        severity: 'caution',
        message: `${plant.commonName} prefers humid conditions — may struggle in an open container.`,
        affectedPlants: [plant.slug],
      });
    }
  }

  // --- Crowding (volume vs. plant count) ---------------------------------
  if (container.volumeL < CROWDING_VOLUME_THRESHOLD_L) {
    if (plants.length > CROWDING_MAX_PLANTS_ERROR) {
      containerFitIssues.push({
        factor: 'crowding',
        severity: 'incompatible',
        message: `${plants.length} plants in ${container.volumeL}L is too many — severe overcrowding likely.`,
        affectedPlants: plants.map((p) => p.slug),
      });
    } else if (plants.length > CROWDING_MAX_PLANTS_WARNING) {
      containerFitIssues.push({
        factor: 'crowding',
        severity: 'caution',
        message: `${plants.length} plants in ${container.volumeL}L is tight — monitor for overcrowding.`,
        affectedPlants: plants.map((p) => p.slug),
      });
    }
  }

  // --- Gas exchange (fast growers in micro sealed containers) -------------
  if (
    container.opening === 'sealed' &&
    container.volumeL < GAS_EXCHANGE_SEALED_THRESHOLD_L
  ) {
    for (const plant of plants) {
      if (plant.growthRate === 'fast') {
        containerFitIssues.push({
          factor: 'gas_exchange',
          severity: 'caution',
          message: `${plant.commonName} grows fast and may deplete CO₂ quickly in this micro sealed container.`,
          affectedPlants: [plant.slug],
        });
      }
    }
  }

  // --- Environmental envelope --------------------------------------------
  const envEnvelope = deriveEnvelope(plants);

  // --- Overall score -----------------------------------------------------
  const baseScore =
    upperScores.length > 0
      ? Math.trunc(upperScores.reduce((sum, s) => sum + s, 0) / upperScores.length)
      : 100;
  const penalty = containerFitIssues.reduce((sum, c) => sum + containerPenalty(c), 0);
  let overallScore = Math.max(0, baseScore - penalty);

  let pairSurvival = false;
  for (let i = 0; i < plants.length && !pairSurvival; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      if (pairMatrix[plants[i].slug][plants[j].slug].survivalCritical) {
        pairSurvival = true;
        break;
      }
    }
  }
  const groupSurvival =
    containerFitIssues.some(
      (c) => c.factor === 'container_type' && c.severity === 'incompatible',
    ) || pairSurvival;
  if (groupSurvival) overallScore = Math.min(overallScore, SURVIVAL_SCORE_CEILING);

  return { overallScore, pairMatrix, containerFitIssues, envEnvelope };
}
