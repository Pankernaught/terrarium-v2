/**
 * Score a saved build into an Eco-balance result — the honest replacement for
 * v1's `pages/home.py:189` `except Exception: pass`, which blanked any scoring
 * failure to a silent grey "⚠". Here a resolution failure or a `checkGroup` throw
 * becomes a **surfaced `diagnostic` string**, never a swallowed exception.
 *
 * Pure + dependency-inverted (the seed `plants` / `containers` are passed in, like
 * `recommend()` / `resolveBuildContainer`), so it imports nothing from `src/db` or
 * `src/data` and unit-tests in the node runner. The `build` argument is typed
 * **structurally** (no `Build` import) to keep the engine-purity invariant intact.
 */
import type { Container } from '@/types/container';
import type { Plant } from '@/types/plant';
import type { GroupReport } from '@/types/results';

import { checkGroup } from './compatibility';
import { type BuildContainerSnapshot, resolveBuildContainer } from './containers';
import { ecoBand, type EcoBand } from './eco';
import { summarizeVerdict, type VerdictSummary } from './verdict';

/** The minimal build shape this needs — a snapshot plus its plant slugs. */
export type ScorableBuild = BuildContainerSnapshot & { plantSlugs: string[] };

export interface ScoredBuild {
  /** 0–100, or `null` when scoring could not run (see `diagnostic`). */
  score: number | null;
  band: EcoBand | null;
  report: GroupReport | null;
  verdict: VerdictSummary | null;
  /**
   * A human-readable reason scoring did not produce a score — surfaced in the UI
   * as a real diagnostic, never swallowed. `null` on success.
   */
  diagnostic: string | null;
}

/**
 * Resolve `build` against the seed `plants` / `containers` and score it.
 *
 * Faithful to v1's home-callback semantics, with the swallow removed:
 *  - an **empty** plant list scores **100** (v1 parity) with a neutral verdict;
 *  - a missing container, a missing plant record, or a `checkGroup` throw each
 *    return `score: null` plus a specific `diagnostic`.
 */
export function scoreBuild(
  build: ScorableBuild,
  plants: readonly Plant[],
  containers: readonly Container[],
): ScoredBuild {
  const empty: Omit<ScoredBuild, 'diagnostic'> = {
    score: null,
    band: null,
    report: null,
    verdict: null,
  };

  // Empty build: v1 scores this 100 (nothing to conflict).
  if (build.plantSlugs.length === 0) {
    return {
      score: 100,
      band: ecoBand(100),
      report: null,
      verdict: { band: ecoBand(100), sentence: 'No plants yet — add a few to see how they balance.', issueCount: 0 },
      diagnostic: null,
    };
  }

  const container = resolveBuildContainer(build, containers);
  if (!container) {
    return { ...empty, diagnostic: 'This build has no container, so it can’t be scored yet.' };
  }

  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  const resolved: Plant[] = [];
  const missing: string[] = [];
  for (const slug of build.plantSlugs) {
    const plant = bySlug.get(slug);
    if (plant) resolved.push(plant);
    else missing.push(slug);
  }
  if (missing.length > 0) {
    return {
      ...empty,
      diagnostic: `Missing plant data for: ${missing.join(', ')}. The plant catalog may be out of date.`,
    };
  }

  try {
    const report = checkGroup(resolved, container);
    const verdict = summarizeVerdict(report, resolved.length);
    return {
      score: report.overallScore,
      band: ecoBand(report.overallScore),
      report,
      verdict,
      diagnostic: null,
    };
  } catch (err) {
    // The v1 `except: pass` lived here. Surface it.
    const message = err instanceof Error ? err.message : String(err);
    return { ...empty, diagnostic: `Couldn’t score this build: ${message}` };
  }
}
