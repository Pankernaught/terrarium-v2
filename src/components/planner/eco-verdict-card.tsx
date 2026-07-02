/**
 * The planner's live Eco-balance verdict card (ADR 0016). Replaces the old
 * meter-bar + Pair-checks matrix: a score ring + a band/loop status line over a
 * per-plant roster, closing on the plain-English verdict sentence.
 *
 * Strictly presentational — the caller precomputes each {@link EcoRosterRow}
 * (fit + sorted conflicts) from the live `scoreBuild` derivation. The only state
 * here is which warning rows are expanded.
 *
 * Honest non-happy states: an empty build shows an "add plants" prompt (never a
 * confident 100 ring); an unscored build (no container) shows the diagnostic.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Collapse, EcoRing, SectionLabel, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { copy, type CopyKey } from '@/lib/copy';
import { humanize } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';
import { usePreferences } from '@/hooks/use-preferences';
import { ecoColor } from '@/logic/eco';
import { fmtTempRange, type Units } from '@/logic/units';
import type { ScoredBuild } from '@/logic/score-build';
import type { ContainerOpening } from '@/types';
import type { Conflict, ConsensusProfile } from '@/types/results';
import type { Plant } from '@/types/plant';

export interface EcoRosterRow {
  plant: Plant;
  fit: number | null;
  /** Worst-first; `[0]` is the inline reason, the rest reveal on expand. */
  conflicts: Conflict[];
}

/**
 * The dominant profile the build is scored against — "Light Medium · Soil Moist ·
 * pH Neutral · 18–24°C · 70–85%". A `'split'` stat (a tie) shows the split token;
 * stats with no votes (absent pH) are omitted. Updates free on every recompute.
 */
function consensusLine(consensus: ConsensusProfile, units: Units): string {
  const split = copy('eco.trait.split');
  const cat = (v: string | null) => (v == null ? null : v === 'split' ? split : humanize(v));
  const segs: string[] = [];
  const light = cat(consensus.light);
  if (light) segs.push(`Light ${light}`);
  const soil = cat(consensus.soilMoisture);
  if (soil) segs.push(`Soil ${soil}`);
  const ph = cat(consensus.phPreference);
  if (ph) segs.push(`pH ${ph}`);
  if (consensus.temperature) {
    segs.push(consensus.temperature === 'split' ? `Temp ${split}` : fmtTempRange(consensus.temperature[0], consensus.temperature[1], units));
  }
  if (consensus.humidity) {
    segs.push(consensus.humidity === 'split' ? `Humidity ${split}` : `${consensus.humidity[0]}–${consensus.humidity[1]}%`);
  }
  return segs.join('  ·  ');
}

const BAND_COPY: Record<NonNullable<ScoredBuild['band']>, CopyKey> = {
  healthy: 'eco.band.healthy',
  caution: 'eco.band.caution',
  critical: 'eco.band.critical',
};

export function EcoVerdictCard({
  scored,
  rows,
  opening,
  consensus,
  onPlantInfo,
  onPlantRemove,
}: {
  scored: ScoredBuild;
  rows: EcoRosterRow[];
  opening: ContainerOpening | null;
  /** The build's dominant per-stat profile (ADR 0017), shown live under the status. */
  consensus?: ConsensusProfile | null;
  onPlantInfo: (plant: Plant) => void;
  onPlantRemove: (plant: Plant) => void;
}) {
  const { c, scheme } = useTokens();
  const { units } = usePreferences();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Non-happy states degrade to a text-only prompt — no ring, no roster.
  if (scored.empty || scored.score == null || scored.band == null) {
    return (
      <Card style={styles.card}>
        <SectionLabel>Eco-balance</SectionLabel>
        <Text variant="body" role="textMuted">
          {scored.empty
            ? scored.verdict?.sentence ?? 'No plants yet — add a few to see how they balance.'
            : scored.diagnostic ?? 'Can’t score this build yet.'}
        </Text>
      </Card>
    );
  }

  const ringColor = ecoColor(scored.score, scheme);
  const loopKey: CopyKey = opening === 'open' ? 'eco.loop.open' : 'eco.loop.closed';
  const status = `${copy(BAND_COPY[scored.band])}${opening ? ` · ${copy(loopKey)}` : ''}`;

  function toggle(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  return (
    <Card style={styles.card}>
      <SectionLabel>Eco-balance</SectionLabel>

      {/* Ring + status + dominant profile (ADR 0017) */}
      <View style={styles.head}>
        <EcoRing score={scored.score} color={ringColor} trackColor={c.surfaceSunken} />
        <View style={styles.statusCol}>
          <Text variant="subhead" role="textMuted">
            {status}
          </Text>
          {consensus && consensusLine(consensus, units) ? (
            <Text variant="caption" role="textMuted">
              {consensusLine(consensus, units)}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Per-plant roster */}
      <View style={styles.roster}>
        {rows.map(({ plant, fit, conflicts }) => {
          const hasConflict = conflicts.length > 0;
          const fitColor = fit != null ? ecoColor(fit, scheme) : c.textMuted;
          const isOpen = expanded.has(plant.slug);
          const extra = conflicts.length - 1;

          return (
            <View key={plant.slug}>
              <Pressable
                onPress={() => (hasConflict ? toggle(plant.slug) : onPlantInfo(plant))}
                accessibilityRole="button"
                accessibilityState={hasConflict ? { expanded: isOpen } : undefined}
                accessibilityLabel={
                  hasConflict
                    ? `${plant.commonName}, ${conflicts[0].message}${extra > 0 ? `, ${extra} more` : ''}`
                    : `${plant.commonName}, fit ${fit ?? '—'}`
                }
                style={[
                  styles.row,
                  {
                    backgroundColor: c.surfaceSunken,
                    borderColor: hasConflict ? c.accent : c.border,
                  },
                ]}>
                <View
                  style={[
                    styles.marker,
                    { backgroundColor: hasConflict ? c.accent : c.sage },
                  ]}>
                  <Text variant="caption" style={{ color: c.onPrimary }}>
                    {hasConflict ? '!' : '✓'}
                  </Text>
                </View>

                <View style={styles.rowText}>
                  <Text variant="body" numberOfLines={isOpen ? undefined : 1}>
                    {plant.commonName}
                    {hasConflict ? (
                      <Text variant="body" style={{ color: c.accent }}>
                        {` — ${conflicts[0].message}`}
                        {extra > 0 ? ` (${extra} more)` : ''}
                      </Text>
                    ) : null}
                  </Text>
                </View>

                {fit != null ? (
                  <Text variant="caption" style={{ color: fitColor }}>
                    Fit {fit}
                  </Text>
                ) : null}
              </Pressable>

              {/* Remaining conflicts + actions reveal in place. */}
              {hasConflict ? (
                <Collapse open={isOpen} style={styles.collapse}>
                  <View style={styles.extraList}>
                    {conflicts.slice(1).map((cf, i) => (
                      <View key={i} style={styles.extraRow}>
                        <View style={[styles.dot, { backgroundColor: c.accent }]} />
                        <Text variant="caption" role="textMuted" style={styles.extraText}>
                          {cf.message}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => onPlantInfo(plant)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`View details for ${plant.commonName}`}>
                        <Text variant="caption" role="primary">View details</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onPlantRemove(plant)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${plant.commonName} from build`}>
                        <Text variant="caption" role="accent">Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </Collapse>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Verdict sentence */}
      {scored.verdict?.sentence ? (
        <Text variant="body" role="textMuted">
          {scored.verdict.sentence}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  statusCol: { flex: 1, gap: Spacing.xs },
  roster: { gap: Spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  marker: { width: 26, height: 26, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  collapse: { paddingLeft: Spacing.md + 26 + Spacing.sm },
  extraList: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  extraRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  extraText: { flex: 1, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.lg, paddingTop: Spacing.xs },
});
