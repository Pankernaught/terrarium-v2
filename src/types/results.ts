/**
 * In-memory result/view types for the compatibility engine (port of
 * `engine/models/results.py`). These are never persisted — they are the return
 * shapes of the engine functions — so they are plain TS types, not zod schemas
 * (no external input crosses this boundary; the engine guarantees the invariants).
 */
import type { LightLevel, MoistureLevel, PhPreference, Plant } from './plant';

export type Severity = 'caution' | 'incompatible';

/** A discrete environmental or structural incompatibility issue. */
export interface Conflict {
  factor: string;
  severity: Severity;
  message: string;
  affectedPlants: string[];
  /**
   * Set on a light/moisture conflict whose match with the build consensus was
   * reached only via a secondary condition — a UI annotation ("via secondary"),
   * not an extra penalty. Suppressed when the factor is survival-critical.
   */
  viaSecondary?: boolean;
}

/**
 * One plant scored against the build consensus (ADR 0017). `score` is 100 minus
 * its own deviations, clamped to {@link PLANT_SURVIVAL_CEILING} when any conflict
 * is survival-critical (it will die in this box). Matching plants keep their 100
 * regardless of how off a sibling is — only the deviant loses points.
 */
export interface PlantScore {
  slug: string;
  score: number;
  conflicts: Conflict[];
  survivalCritical: boolean;
}

/**
 * The build's dominant condition per stat — the majority the plants are scored
 * against. A categorical value is the plurality of primaries; a numeric range is
 * the max-overlap zone. `'split'` means no majority held (a tie); `null` means the
 * stat had no votes — every stat for an empty selection (the recommender's first
 * pick), or only pH when no plant declares one. Surfaced live on the planner card.
 */
export interface ConsensusProfile {
  light: LightLevel | 'split' | null;
  soilMoisture: MoistureLevel | 'split' | null;
  phPreference: PhPreference | 'split' | null;
  humidity: [number, number] | 'split' | null;
  temperature: [number, number] | 'split' | null;
}

/** Overlapping environmental ranges for a combination of plants. */
export interface EnvEnvelope {
  humidityMin: number;
  humidityMax: number;
  tempMin: number;
  tempMax: number;
  compatibleLights: LightLevel[];
  compatibleMoisture: MoistureLevel[];
}

/**
 * The evaluation report for a complete container system (ADR 0017 consensus model).
 *
 * `overallScore` is the weakest plant's score minus build-level penalties, so one
 * off plant no longer drags down the plants that fit. `plantScores` is the per-plant
 * roster; `consensus` is the dominant profile they were scored against;
 * `buildWarnings` holds the build-level issues (a "split" trait with no majority,
 * and crowding). `envEnvelope` still answers "shared survivable range" for display.
 */
export interface GroupReport {
  overallScore: number;
  plantScores: PlantScore[];
  consensus: ConsensusProfile;
  buildWarnings: Conflict[];
  envEnvelope: EnvEnvelope;
}

/** A single plant recommendation with its fit score and supporting notes. */
export interface Recommendation {
  plant: Plant;
  fitScore: number;
  reasons: string[];
  cautions: Conflict[];
}
