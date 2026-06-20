/**
 * In-memory result/view types for the compatibility engine (port of
 * `engine/models/results.py`). These are never persisted — they are the return
 * shapes of the engine functions — so they are plain TS types, not zod schemas
 * (no external input crosses this boundary; the engine guarantees the invariants).
 */
import type { LightLevel, MoistureLevel, Plant } from './plant';

export type Severity = 'caution' | 'incompatible';
export type Verdict = 'compatible' | 'caution' | 'incompatible';

/** A discrete environmental or structural incompatibility issue. */
export interface Conflict {
  factor: string;
  severity: Severity;
  message: string;
  affectedPlants: string[];
  /**
   * Set on a light/moisture conflict whose best-matching pair was reached via a
   * secondary condition — a UI annotation ("via secondary"), not an extra penalty.
   * Suppressed when the factor is survival-critical.
   */
  viaSecondary?: boolean;
}

/** The pairwise compatibility contract response. Score is always in [0, 100]. */
export interface CompatibilityResult {
  score: number;
  verdict: Verdict;
  conflicts: Conflict[];
  survivalCritical: boolean;
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

/** The evaluation report for a complete container system. */
export interface GroupReport {
  overallScore: number;
  pairMatrix: Record<string, Record<string, CompatibilityResult>>;
  containerFitIssues: Conflict[];
  envEnvelope: EnvEnvelope;
}

/** A single plant recommendation with its fit score and supporting notes. */
export interface Recommendation {
  plant: Plant;
  fitScore: number;
  reasons: string[];
  cautions: Conflict[];
}
