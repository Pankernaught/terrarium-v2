/**
 * The Tier-1 plain-English verdict: one sentence that does more for "premium" than
 * any meter. Derived purely from a `GroupReport`
 * so it is deterministic and unit-testable — no rendering, no `src/db`/`src/data`.
 *
 * The sentence leads with the band, then names the single most important issue
 * (survival-critical first, then the worst caution), so the user reads the verdict
 * and the one thing to look at — not a wall of conflicts.
 */
import type { Conflict, GroupReport } from '@/types/results';

import { copy } from '../lib/copy';
import { ecoBand, type EcoBand } from './eco';

/** Collect every conflict in the report (per-plant deviations + build-level warnings). */
function allConflicts(report: GroupReport): Conflict[] {
  return [...report.buildWarnings, ...report.plantScores.flatMap((p) => p.conflicts)];
}

export interface VerdictSummary {
  band: EcoBand;
  sentence: string;
  /** Count of distinct surfaced issues (for a "+N more" affordance). */
  issueCount: number;
}

/**
 * Build the one-line verdict for a scored group.
 *
 * `plantCount === 0` is the empty-build case (v1 scores it 100): a neutral
 * "add plants" nudge rather than a false "Healthy".
 */
export function summarizeVerdict(report: GroupReport, plantCount: number): VerdictSummary {
  const band = ecoBand(report.overallScore);

  if (plantCount === 0) {
    return {
      band,
      sentence: copy('verdict.empty'),
      issueCount: 0,
    };
  }

  const conflicts = allConflicts(report);
  const critical = conflicts.filter((c) => c.severity === 'incompatible');
  const cautions = conflicts.filter((c) => c.severity === 'caution');

  if (critical.length > 0) {
    return {
      band,
      sentence: copy('verdict.critical', { message: critical[0].message }),
      issueCount: conflicts.length,
    };
  }

  if (cautions.length === 1) {
    return { band, sentence: copy('verdict.caution', { message: cautions[0].message }), issueCount: 1 };
  }

  if (cautions.length > 1) {
    return {
      band,
      sentence: copy('verdict.cautionMore', { message: cautions[0].message, count: cautions.length - 1 }),
      issueCount: cautions.length,
    };
  }

  return { band, sentence: copy('verdict.thriving'), issueCount: 0 };
}
