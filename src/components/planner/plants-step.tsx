/**
 * Plants step — the signature interaction (Premium §4.4). The owner picks plants
 * from an icon-first selector; each add writes `draft.plantSlugs` **and** seeds a
 * `placement` (so it appears in the shared preview to drag into place), each
 * remove clears both. Compatibility is **live**: `recommend()` suggests good
 * companions and `scoreBuild` drives the Eco-balance meter as the selection
 * changes. A survival-critical conflict fires `notificationAsync(Warning)` and
 * pulses the meter red (§3.6 / §4.4). The meter shows the headline verdict; the
 * **full pairwise matrix is a Tier-3 expand** (decision 15 — primary conflicts
 * lead, the matrix annotates via-secondary).
 *
 * Drag-to-place itself lives in the persistent {@link PlannerPreview} (the planner
 * owns it and passes `draggableKind="plant"` on this step); this body owns
 * *selection* + the live compatibility read-outs.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Card, Chip, EcoMeter, haptics, SectionLabel, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { useTokens } from '@/hooks/use-tokens';
import { resolveBuildContainer } from '@/logic/containers';
import { ecoBandLabel } from '@/logic/eco';
import { defaultPlacement, removePlacement, upsertPlacement } from '@/logic/placement';
import { recommend } from '@/logic/recommend';
import { scoreBuild } from '@/logic/score-build';
import type { GroupReport } from '@/types/results';
import type { Plant } from '@/types';

import type { StepProps } from './step';

const MAX_RECOMMENDATIONS = 5;

/** Any incompatible (survival-critical) conflict anywhere in the report. */
function hasSurvivalCritical(report: GroupReport): boolean {
  if (report.containerFitIssues.some((c) => c.severity === 'incompatible')) return true;
  const slugs = Object.keys(report.pairMatrix);
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const cell = report.pairMatrix[slugs[i]]?.[slugs[j]];
      if (cell?.survivalCritical) return true;
    }
  }
  return false;
}

export function PlantsStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();

  const catalog = useMemo(() => loadPlants(), []);
  const containers = useMemo(() => loadContainers(), []);
  const [query, setQuery] = useState('');
  const [matrixOpen, setMatrixOpen] = useState(false);

  const selectedSlugs = new Set(draft.plantSlugs);
  const container = resolveBuildContainer(draft, containers);

  // Live score over the draft (the same pure path the dashboard + detail use).
  const scored = useMemo(
    () => scoreBuild(draft, catalog, containers),
    [draft, catalog, containers],
  );
  const survivalCritical = scored.report ? hasSurvivalCritical(scored.report) : false;

  // Survival-critical pulse: a red flash + warning haptic when it newly trips.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!survivalCritical) return;
    haptics.warn();
    pulse.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 460 }));
    // pulse is a stable shared-value ref; not an effect dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survivalCritical]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Live recommendations from the chosen container + already-selected plants.
  const recommendations = useMemo(() => {
    if (!container) return [];
    return recommend(plants, container, catalog, MAX_RECOMMENDATIONS);
  }, [container, plants, catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (p) => p.commonName.toLowerCase().includes(q) || p.slug.includes(q),
    );
  }, [catalog, query]);

  function addPlant(slug: string) {
    if (selectedSlugs.has(slug)) return;
    haptics.select();
    const nextSlugs = [...draft.plantSlugs, slug];
    const placement = defaultPlacement(slug, draft.placements.filter((p) => !p.slug.startsWith('hardscape:')).length);
    update({ plantSlugs: nextSlugs, placements: upsertPlacement(draft.placements, placement) });
  }

  function removePlant(slug: string) {
    haptics.select();
    update({
      plantSlugs: draft.plantSlugs.filter((s) => s !== slug),
      placements: removePlacement(draft.placements, slug),
    });
  }

  function toggle(slug: string) {
    if (selectedSlugs.has(slug)) removePlant(slug);
    else addPlant(slug);
  }

  return (
    <View style={styles.root}>
      {/* Live Eco-balance — the heartbeat of this step. */}
      <Card style={styles.card}>
        <View style={styles.meterHead}>
          <SectionLabel>Eco-balance</SectionLabel>
          {scored.score != null ? (
            <Text variant="caption" role="textMuted">
              {ecoBandLabel(scored.band ?? 'caution')} · {Math.round(scored.score)}%
            </Text>
          ) : null}
        </View>

        {scored.score != null ? (
          <View>
            <EcoMeter score={scored.score} height={12} />
            {/* Red pulse overlay on a survival-critical conflict. */}
            <Animated.View
              pointerEvents="none"
              style={[styles.glow, { backgroundColor: c.accent }, glowStyle]}
            />
          </View>
        ) : (
          <Text variant="caption" role="accent">
            ⚠ {scored.diagnostic}
          </Text>
        )}

        <Text variant="body" role={survivalCritical ? 'accent' : 'text'}>
          {scored.verdict?.sentence ?? 'Add plants to see how they balance.'}
        </Text>

        {scored.report && draft.plantSlugs.length >= 2 ? (
          <Pressable onPress={() => { haptics.select(); setMatrixOpen((o) => !o); }} accessibilityRole="button" style={styles.matrixToggle}>
            <Text variant="caption" role="primary">
              {matrixOpen ? 'Hide pair checks' : 'Show all pair checks'}
            </Text>
          </Pressable>
        ) : null}

        {matrixOpen && scored.report ? <PairMatrix report={scored.report} plants={plants} /> : null}
      </Card>

      {/* Selected plants. */}
      {plants.length > 0 ? (
        <Card style={styles.card}>
          <SectionLabel>{`In this build · ${plants.length}`}</SectionLabel>
          <View style={styles.chipWrap}>
            {plants.map((p) => (
              <Chip
                key={p.slug}
                label={`${p.commonName}  ✕`}
                tone="sage"
                selected
                onPress={() => removePlant(p.slug)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {/* Recommendations (live, from the container + current selection). */}
      {recommendations.length > 0 ? (
        <Card style={styles.card}>
          <SectionLabel>Suggested companions</SectionLabel>
          <View style={styles.recCol}>
            {recommendations.map((r) => (
              <Pressable
                key={r.plant.slug}
                onPress={() => addPlant(r.plant.slug)}
                accessibilityRole="button"
                style={[styles.recRow, { borderColor: c.border }]}>
                <View style={styles.recMain}>
                  <Text variant="body">{r.plant.commonName}</Text>
                  {r.reasons[0] ? (
                    <Text variant="caption" role="textMuted" numberOfLines={1}>
                      {r.reasons[0]}
                    </Text>
                  ) : null}
                </View>
                <Chip label={`${r.fitScore}%`} tone="primary" />
              </Pressable>
            ))}
          </View>
        </Card>
      ) : container == null ? (
        <Card style={styles.card}>
          <Text variant="caption" role="textMuted">
            Set a container first to get live companion suggestions.
          </Text>
        </Card>
      ) : null}

      {/* The catalog selector. */}
      <Card style={styles.card}>
        <SectionLabel>Add plants</SectionLabel>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plants…"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="Search plants"
          style={[styles.search, { backgroundColor: c.surfaceSunken, borderColor: c.border, color: c.text }]}
        />
        <View style={styles.chipWrap}>
          {filtered.map((p) => {
            const on = selectedSlugs.has(p.slug);
            return (
              <Chip
                key={p.slug}
                label={p.commonName}
                tone="primary"
                selected={on}
                onPress={() => toggle(p.slug)}
              />
            );
          })}
          {filtered.length === 0 ? (
            <Text variant="caption" role="textMuted">
              No plants match “{query.trim()}”.
            </Text>
          ) : null}
        </View>
      </Card>
    </View>
  );
}

// --- Tier-3 pairwise matrix (primary conflicts lead; via-secondary annotated) ---

function PairMatrix({ report, plants }: { report: GroupReport; plants: readonly Plant[] }) {
  const { c } = useTokens();
  const rows: { a: Plant; b: Plant; score: number; verdict: string; lines: { msg: string; bad: boolean }[] }[] = [];
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const cell = report.pairMatrix[plants[i].slug]?.[plants[j].slug];
      if (!cell) continue;
      rows.push({
        a: plants[i],
        b: plants[j],
        score: cell.score,
        verdict: cell.verdict,
        lines: cell.conflicts.map((cf) => ({
          msg: cf.message + (cf.viaSecondary ? ' (via a secondary tolerance)' : ''),
          bad: cf.severity === 'incompatible',
        })),
      });
    }
  }

  return (
    <View style={styles.matrix}>
      {rows.map(({ a, b, score, verdict, lines }) => (
        <View key={`${a.slug}-${b.slug}`} style={styles.pairRow}>
          <View style={styles.pairHead}>
            <Text variant="caption" style={styles.pairNames}>
              {a.commonName} <Text role="textMuted">×</Text> {b.commonName}
            </Text>
            <Chip label={`${Math.round(score)}%`} tone={verdict === 'compatible' ? 'sage' : 'accent'} />
          </View>
          {lines.map((l, k) => (
            <View key={k} style={styles.conflictLine}>
              <View style={[styles.dot, { backgroundColor: l.bad ? c.accent : c.sage }]} />
              <Text variant="caption" role="textMuted" style={styles.conflictText}>
                {l.msg}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  meterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: Radii.pill },
  matrixToggle: { alignSelf: 'flex-start' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  recCol: { gap: Spacing.sm },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  recMain: { flex: 1, gap: 2 },
  search: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    fontSize: 16,
  },
  matrix: { gap: Spacing.md, marginTop: Spacing.xs },
  pairRow: { gap: Spacing.xs },
  pairHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pairNames: { flexShrink: 1 },
  conflictLine: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingLeft: Spacing.xs },
  dot: { width: 7, height: 7, borderRadius: Radii.pill, marginTop: 5 },
  conflictText: { flexShrink: 1, lineHeight: 18 },
});
