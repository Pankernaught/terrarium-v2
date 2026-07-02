/**
 * Group compatibility engine — the per-build **consensus** model (ADR 0017).
 *
 * The build derives a dominant level per stat (plurality of primaries for the
 * categorical stats, the max-overlap zone for the numeric ranges). Every plant is
 * then scored against that consensus on the v1 penalty ladder — only the deviating
 * plant loses points, so one off plant can no longer drag down the plants that fit.
 * The build score is the **weakest plant** minus build-level penalties, never an
 * average the good plants can be pulled into. A survival-critical mismatch clamps
 * the affected *plant* to {@link PLANT_SURVIVAL_CEILING}; the weakest-link min
 * carries that through to the build. A stat with no majority (a tie) chooses no
 * consensus and penalises no plant — it becomes one build-level "split" warning
 * scaled by the distance between the tied camps.
 *
 * Pure: imports nothing from `src/db` / `src/data` (copy.json + label helpers are
 * static), so it unit-tests in the node Vitest runner.
 */
import {
  type ConsensusProfile,
  type Conflict,
  type Container,
  type GroupReport,
  type LightLevel,
  type MoistureLevel,
  type PhPreference,
  type Plant,
  type PlantScore,
  type Severity,
  lightValues,
  moistureValues,
} from '../types';
import {
  BUILD_CAUTION_PENALTY,
  BUILD_INCOMPATIBLE_PENALTY,
  CONTAINER_TYPE_OPEN_PENALTY,
  CONTAINER_TYPE_SURVIVAL_PENALTY,
  CROWDING_AREA_CAUTION_CM2,
  CROWDING_AREA_ERROR_CM2,
  GAS_EXCHANGE_PENALTY,
  GAS_EXCHANGE_SEALED_THRESHOLD_L,
  HUMIDITY_PENALTY,
  LIGHT_CAUTION_PENALTY,
  LIGHT_INCOMPATIBLE_PENALTY,
  LIGHT_ORDER,
  LIGHT_SURVIVAL_GAP,
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
  PLANT_SURVIVAL_CEILING,
  SHADE_LIGHTS,
  TEMPERATURE_PENALTY,
} from './constants';
import { floorAreaCm2, parseDimensionsStr } from './containers';
import { deriveEnvelope } from './environment';
import { copy, type CopyKey } from '../lib/copy';
import { humanize } from '../lib/labels';

type Zone = [number, number];

/** True if the two closed intervals share any common point. */
function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return Math.max(minA, minB) <= Math.min(maxA, maxB);
}

const severityRank = (s: Severity): number => (s === 'incompatible' ? 0 : 1);

// ===========================================================================
// Consensus derivation
// ===========================================================================

/**
 * The single value with the most votes; `'split'` when the top count is tied;
 * `null` when there are no votes. One plant, one vote — secondaries don't vote.
 */
function plurality<T extends string>(votes: T[]): T | 'split' | null {
  if (votes.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  let top = 0;
  let winner: T | null = null;
  let tie = false;
  for (const [v, n] of counts) {
    if (n > top) {
      top = n;
      winner = v;
      tie = false;
    } else if (n === top) {
      tie = true;
    }
  }
  return tie ? 'split' : winner;
}

/** The values sharing the top vote count — the tied camps of a split. */
function topCamps<T extends string>(votes: T[]): T[] {
  const counts = new Map<T, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return [...counts.keys()].filter((k) => counts.get(k) === top);
}

/**
 * The sub-interval the most ranges cover (max-overlap zone). Coverage only rises at
 * a left endpoint, so evaluating each range's `lo` finds the max; the zone is the
 * intersection of the ranges covering that point. `split` when two disjoint zones
 * tie for the max — no single majority band.
 */
function maxOverlapZone(ranges: Zone[]): { zone: Zone | null; split: boolean } {
  let best = 0;
  let zones: Zone[] = [];
  for (const [lo] of ranges) {
    const covering = ranges.filter(([rlo, rhi]) => rlo <= lo && lo <= rhi);
    const zone: Zone = [
      Math.max(...covering.map((r) => r[0])),
      Math.min(...covering.map((r) => r[1])),
    ];
    if (covering.length > best) {
      best = covering.length;
      zones = [zone];
    } else if (covering.length === best) {
      zones.push(zone);
    }
  }
  // Merge touching/overlapping zones; >1 component ⇒ no single majority band.
  zones.sort((a, b) => a[0] - b[0]);
  const merged: Zone[] = [];
  for (const z of zones) {
    const last = merged[merged.length - 1];
    if (last && z[0] <= last[1]) last[1] = Math.max(last[1], z[1]);
    else merged.push([...z]);
  }
  return merged.length === 1 ? { zone: merged[0], split: false } : { zone: null, split: true };
}

function rangeConsensus(ranges: Zone[]): Zone | 'split' {
  const { zone, split } = maxOverlapZone(ranges);
  return zone && !split ? zone : 'split';
}

/**
 * The build's dominant condition per stat — the majority each plant is scored
 * against. Categorical stats use the plurality of primaries; numeric stats use the
 * max-overlap zone. A candidate measured against this (`scorePlantVsConsensus`)
 * must not be in `plants` — it does not vote on its own measuring stick.
 */
export function deriveConsensus(plants: Plant[]): ConsensusProfile {
  return {
    light: plurality(plants.map((p) => p.light.primary)),
    soilMoisture: plurality(plants.map((p) => p.soilMoisture.primary)),
    phPreference: plurality(
      plants.map((p) => p.phPreference).filter((v): v is PhPreference => v != null),
    ),
    humidity: plants.length ? rangeConsensus(plants.map((p) => p.humidityPctRange)) : null,
    temperature: plants.length ? rangeConsensus(plants.map((p) => p.tempCRange)) : null,
  };
}

// ===========================================================================
// Per-plant scoring against the consensus (the shared penalty ladder)
// ===========================================================================

/**
 * Best (minimum) adjacency distance across the plant's primary/secondary values
 * vs the single consensus value, plus whether a secondary beat the primary. The
 * `*Values` helpers always return the primary at index 0.
 */
function bestAdjacency<T extends string>(
  plantVals: readonly T[],
  consensus: T,
  order: Record<T, number>,
): { bestDist: number; viaSecondary: boolean } {
  let bestDist = Infinity;
  for (const v of plantVals) bestDist = Math.min(bestDist, Math.abs(order[v] - order[consensus]));
  const primaryDist = Math.abs(order[plantVals[0]] - order[consensus]);
  return { bestDist, viaSecondary: bestDist < primaryDist };
}

/** Spread the optional `viaSecondary: true` only when set. */
function annotate(viaSecondary: boolean): { viaSecondary?: true } {
  return viaSecondary ? { viaSecondary: true } : {};
}

/** One stat's verdict against the consensus: a penalty, whether it's lethal, and the note. */
interface StatResult {
  penalty: number;
  survival: boolean;
  conflict: Conflict | null;
}
const NONE: StatResult = { penalty: 0, survival: false, conflict: null };
const survival = (penalty: number, conflict: Conflict): StatResult => ({ penalty, survival: true, conflict });
const ding = (penalty: number, conflict: Conflict): StatResult => ({ penalty, survival: false, conflict });

/** Light is lethal when one side is direct and the other is shade (low/medium). */
function lightLethal(a: LightLevel, b: LightLevel): boolean {
  return (a === 'direct' || b === 'direct') && (SHADE_LIGHTS.has(a) || SHADE_LIGHTS.has(b));
}

function scoreLight(plant: Plant, consensus: LightLevel): StatResult {
  const want = plant.light.primary;
  const slots = { plant: plant.commonName, want: humanize(want), build: humanize(consensus) };
  if (lightLethal(want, consensus)) {
    return survival(LIGHT_SURVIVAL_PENALTY, conflict('light', 'incompatible', 'compat.light.lethal', slots, plant));
  }
  const { bestDist, viaSecondary } = bestAdjacency(lightValues(plant.light), consensus, LIGHT_ORDER);
  if (bestDist === 0) {
    if (!viaSecondary) return NONE;
    return ding(LIGHT_CAUTION_PENALTY, {
      ...conflict('light', 'caution', 'compat.light.secondary', slots, plant),
      viaSecondary: true,
    });
  }
  if (bestDist === 1) {
    return ding(LIGHT_CAUTION_PENALTY, {
      ...conflict('light', 'caution', 'compat.light.deviate', slots, plant),
      ...annotate(viaSecondary),
    });
  }
  return ding(LIGHT_INCOMPATIBLE_PENALTY, {
    ...conflict('light', 'incompatible', 'compat.light.deviateFar', slots, plant),
    ...annotate(viaSecondary),
  });
}

function scoreMoisture(plant: Plant, consensus: MoistureLevel): StatResult {
  const want = plant.soilMoisture.primary;
  const slots = { plant: plant.commonName, want: humanize(want), build: humanize(consensus) };
  if (Math.abs(MOISTURE_ORDER[want] - MOISTURE_ORDER[consensus]) >= MOISTURE_SURVIVAL_GAP) {
    return survival(MOISTURE_SURVIVAL_PENALTY, conflict('soil_moisture', 'incompatible', 'compat.moisture.lethal', slots, plant));
  }
  const { bestDist, viaSecondary } = bestAdjacency(moistureValues(plant.soilMoisture), consensus, MOISTURE_ORDER);
  if (bestDist === 0) {
    if (!viaSecondary) return NONE;
    return ding(MOISTURE_ONE_STEP_PENALTY, {
      ...conflict('soil_moisture', 'caution', 'compat.moisture.secondary', slots, plant),
      viaSecondary: true,
    });
  }
  if (bestDist === 1) {
    return ding(MOISTURE_ONE_STEP_PENALTY, {
      ...conflict('soil_moisture', 'caution', 'compat.moisture.deviate', slots, plant),
      ...annotate(viaSecondary),
    });
  }
  return ding(MOISTURE_TWO_STEP_PENALTY, {
    ...conflict('soil_moisture', 'caution', 'compat.moisture.deviateFar', slots, plant),
    ...annotate(viaSecondary),
  });
}

function scorePh(plant: Plant, consensus: PhPreference): StatResult {
  const want = plant.phPreference;
  if (!want) return NONE; // a plant with no pH preference is not scored on pH
  const slots = { plant: plant.commonName, want: humanize(want), build: humanize(consensus) };
  const dist = Math.abs(PH_ORDER[want] - PH_ORDER[consensus]);
  if (dist >= PH_SURVIVAL_GAP) {
    return survival(PH_SURVIVAL_PENALTY, conflict('soil_ph', 'incompatible', 'compat.ph.lethal', slots, plant));
  }
  if (dist === 1) {
    return ding(PH_CAUTION_PENALTY, conflict('soil_ph', 'caution', 'compat.ph.deviate', slots, plant));
  }
  return NONE;
}

/** A numeric range disjoint from the consensus zone is lethal (no shared value, ADR 0008). */
function scoreRange(plant: Plant, range: Zone, zone: Zone, factor: string, penalty: number, key: CopyKey): StatResult {
  if (rangesOverlap(range[0], range[1], zone[0], zone[1])) return NONE;
  return survival(
    penalty,
    conflict(factor, 'incompatible', key, { plant: plant.commonName, min: range[0], max: range[1], bmin: zone[0], bmax: zone[1] }, plant),
  );
}

function scoreContainer(plant: Plant, container: Container): StatResult {
  if ((container.opening === 'sealed' || container.opening === 'lidded') && !plant.closedTerrariumOk) {
    return survival(CONTAINER_TYPE_SURVIVAL_PENALTY, conflict('container_type', 'incompatible', 'compat.container.closed', { plant: plant.commonName }, plant));
  }
  if (container.opening === 'open' && !plant.openTerrariumOk) {
    return ding(CONTAINER_TYPE_OPEN_PENALTY, conflict('container_type', 'caution', 'compat.container.open', { plant: plant.commonName }, plant));
  }
  return NONE;
}

function scoreGas(plant: Plant, container: Container): StatResult {
  if (container.opening === 'sealed' && container.volumeL < GAS_EXCHANGE_SEALED_THRESHOLD_L && plant.growthRate === 'fast') {
    return ding(GAS_EXCHANGE_PENALTY, conflict('gas_exchange', 'caution', 'compat.gasExchange', { plant: plant.commonName }, plant));
  }
  return NONE;
}

/** Build a Conflict from a copy key + slots, affecting just this plant. */
function conflict(factor: string, severity: Severity, key: CopyKey, slots: Record<string, string | number>, plant?: Plant): Conflict {
  return { factor, severity, message: copy(key, slots), affectedPlants: plant ? [plant.slug] : [] };
}

/**
 * Score one plant against the build consensus on the v1 ladder. Container-fit and
 * gas-exchange are per-plant; crowding and ties are build-level (handled in
 * `checkGroup`). `'split'`/`null` consensus stats are skipped — a tie penalises no
 * plant. The score clamps to {@link PLANT_SURVIVAL_CEILING} if anything is lethal.
 */
export function scorePlantVsConsensus(plant: Plant, consensus: ConsensusProfile, container?: Container): PlantScore {
  const results: StatResult[] = [];
  if (consensus.light && consensus.light !== 'split') results.push(scoreLight(plant, consensus.light));
  if (consensus.soilMoisture && consensus.soilMoisture !== 'split') results.push(scoreMoisture(plant, consensus.soilMoisture));
  if (consensus.phPreference && consensus.phPreference !== 'split') results.push(scorePh(plant, consensus.phPreference));
  if (Array.isArray(consensus.humidity)) {
    results.push(scoreRange(plant, plant.humidityPctRange, consensus.humidity, 'humidity', HUMIDITY_PENALTY, 'compat.humidity.lethal'));
  }
  if (Array.isArray(consensus.temperature)) {
    results.push(scoreRange(plant, plant.tempCRange, consensus.temperature, 'temperature', TEMPERATURE_PENALTY, 'compat.temp.lethal'));
  }
  if (container) {
    results.push(scoreContainer(plant, container));
    results.push(scoreGas(plant, container));
  }

  let score = 100;
  let survivalCritical = false;
  const conflicts: Conflict[] = [];
  for (const r of results) {
    score -= r.penalty;
    if (r.survival) survivalCritical = true;
    if (r.conflict) conflicts.push(r.conflict);
  }
  if (survivalCritical) score = Math.min(score, PLANT_SURVIVAL_CEILING);
  conflicts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return { slug: plant.slug, score: Math.max(0, Math.trunc(score)), conflicts, survivalCritical };
}

// ===========================================================================
// Split (tie) severity — scaled by the distance between the tied camps
// ===========================================================================

type SplitSeverity = 'caution' | 'incompatible' | 'survival';

/** A categorical tie's severity: survival at the lethal gap, else 1 step → caution, 2+ → incompatible. */
function categoricalSplit<T extends string>(camps: T[], order: Record<T, number>, survivalGap: number): SplitSeverity {
  let maxDist = 0;
  for (let i = 0; i < camps.length; i++) {
    for (let j = i + 1; j < camps.length; j++) {
      maxDist = Math.max(maxDist, Math.abs(order[camps[i]] - order[camps[j]]));
    }
  }
  if (maxDist >= survivalGap) return 'survival';
  return maxDist >= 2 ? 'incompatible' : 'caution';
}

// ===========================================================================
// Group evaluation
// ===========================================================================

/**
 * Evaluate a full group of plants within a container against the build consensus.
 * Build score = weakest plant − build-level penalties (crowding, ties), clamped to
 * the survival ceiling when any plant is lethal or a tie is a survival gap.
 *
 * @throws if `plants` is empty.
 */
export function checkGroup(plants: Plant[], container: Container): GroupReport {
  if (plants.length === 0) {
    throw new Error('Cannot evaluate an empty plant list.');
  }

  const consensus = deriveConsensus(plants);
  const plantScores = plants.map((p) => scorePlantVsConsensus(p, consensus, container));
  const envEnvelope = deriveEnvelope(plants);
  const allSlugs = plants.map((p) => p.slug);

  const buildWarnings: Conflict[] = [];
  let buildPenalty = 0;
  let buildSurvival = plantScores.some((p) => p.survivalCritical);

  const addSplit = (sev: SplitSeverity, factor: string, key: CopyKey, slots: Record<string, string | number>) => {
    buildWarnings.push({
      factor,
      severity: sev === 'survival' ? 'incompatible' : sev,
      message: copy(key, slots),
      affectedPlants: allSlugs,
    });
    if (sev === 'survival') buildSurvival = true;
    else buildPenalty += sev === 'incompatible' ? BUILD_INCOMPATIBLE_PENALTY : BUILD_CAUTION_PENALTY;
  };

  // --- Split (tie) warnings — one per stat with no clear majority ---------
  if (consensus.light === 'split') {
    const camps = topCamps(plants.map((p) => p.light.primary));
    addSplit(categoricalSplit(camps, LIGHT_ORDER, LIGHT_SURVIVAL_GAP), 'light', 'compat.split.light', {
      traits: camps.map(humanize).join(' / '),
    });
  }
  if (consensus.soilMoisture === 'split') {
    const camps = topCamps(plants.map((p) => p.soilMoisture.primary));
    addSplit(categoricalSplit(camps, MOISTURE_ORDER, MOISTURE_SURVIVAL_GAP), 'soil_moisture', 'compat.split.soilMoisture', {
      traits: camps.map(humanize).join(' / '),
    });
  }
  if (consensus.phPreference === 'split') {
    const camps = topCamps(plants.map((p) => p.phPreference).filter((v): v is PhPreference => v != null));
    addSplit(categoricalSplit(camps, PH_ORDER, PH_SURVIVAL_GAP), 'soil_ph', 'compat.split.ph', {
      traits: camps.map(humanize).join(' / '),
    });
  }
  // Disjoint numeric zones share no survivable value (ADR 0008) → always a survival gap.
  if (consensus.humidity === 'split') addSplit('survival', 'humidity', 'compat.split.humidity', {});
  if (consensus.temperature === 'split') addSplit('survival', 'temperature', 'compat.split.temperature', {});

  // --- Crowding (build-level; floor area per plant, not volume — ADR 0008) -
  if (plants.length >= 2) {
    const floorArea = floorAreaCm2(container.shape, parseDimensionsStr(container.shape, container.dimensionsCm));
    const areaPerPlant = floorArea / plants.length;
    if (areaPerPlant < CROWDING_AREA_ERROR_CM2) {
      buildWarnings.push({
        factor: 'crowding',
        severity: 'incompatible',
        message: copy('compat.crowding.error', { count: plants.length, area: Math.round(floorArea) }),
        affectedPlants: allSlugs,
      });
      buildSurvival = true;
    } else if (areaPerPlant < CROWDING_AREA_CAUTION_CM2) {
      buildWarnings.push({
        factor: 'crowding',
        severity: 'caution',
        message: copy('compat.crowding.caution', { count: plants.length, area: Math.round(floorArea) }),
        affectedPlants: allSlugs,
      });
      buildPenalty += BUILD_CAUTION_PENALTY;
    }
  }

  // --- Build score: weakest link − build penalties, survival clamp --------
  let overallScore = Math.min(...plantScores.map((p) => p.score)) - buildPenalty;
  if (buildSurvival) overallScore = Math.min(overallScore, PLANT_SURVIVAL_CEILING);
  overallScore = Math.max(0, Math.trunc(overallScore));

  return { overallScore, plantScores, consensus, buildWarnings, envEnvelope };
}
