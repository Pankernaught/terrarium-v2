/**
 * The Tier-1 plain-English verdict (Premium §2 "calm microcopy"): one sentence
 * that does more for "premium" than any meter. Derived purely from a `GroupReport`
 * so it is deterministic and unit-testable — no rendering, no `src/db`/`src/data`.
 *
 * The sentence leads with the band, then names the single most important issue
 * (survival-critical first, then the worst caution), so the user reads the verdict
 * and the one thing to look at — not a wall of conflicts.
 */
import type { Conflict, GroupReport } from '@/types/results';

import { ecoBand, type EcoBand } from './eco';

/** Collect every conflict in the report (container fit + the upper-triangle pairs). */
function allConflicts(report: GroupReport): Conflict[] {
  const out: Conflict[] = [...report.containerFitIssues];
  const slugs = Object.keys(report.pairMatrix);
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const cell = report.pairMatrix[slugs[i]]?.[slugs[j]];
      if (cell) out.push(...cell.conflicts);
    }
  }
  return out;
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
    return { band, sentence: 'No plants yet — add a few to see how they balance.', issueCount: 0 };
  }

  const conflicts = allConflicts(report);
  const critical = conflicts.filter((c) => c.severity === 'incompatible');
  const cautions = conflicts.filter((c) => c.severity === 'caution');

  if (critical.length > 0) {
    return {
      band,
      sentence: `At risk — ${critical[0].message}`,
      issueCount: conflicts.length,
    };
  }

  if (cautions.length === 1) {
    return { band, sentence: `Mostly healthy — ${cautions[0].message}`, issueCount: 1 };
  }

  if (cautions.length > 1) {
    return {
      band,
      sentence: `Mostly healthy — ${cautions[0].message} (+${cautions.length - 1} more to review)`,
      issueCount: cautions.length,
    };
  }

  return { band, sentence: 'Thriving balance — every plant suits this setup.', issueCount: 0 };
}
