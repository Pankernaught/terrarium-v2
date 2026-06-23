/**
 * The verdict band: the Eco-balance meter + one plain-English sentence — the
 * single most "premium" element on build detail. Renders a `VerdictSummary`
 * (from `summarizeVerdict`) over the meter; when scoring failed it shows the real
 * `diagnostic` instead of a meter, so a broken build reads as a diagnostic, not a
 * silent grey badge.
 */
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { ecoBandLabel } from '@/logic/eco';
import type { ScoredBuild } from '@/logic/score-build';
import { useTokens } from '@/hooks/use-tokens';

import { Card } from './card';
import { EcoMeter } from './eco-meter';
import { Text } from './text';

export function VerdictBand({ scored }: { scored: ScoredBuild }) {
  const { c } = useTokens();

  // No plants yet — a prompt, not a fake 100%/healthy meter. Must read the same
  // as the plants step's empty Eco-balance bar (both source the verdict sentence).
  if (scored.empty) {
    return (
      <Card style={styles.card}>
        <Text variant="overline" role="textMuted">
          Eco-balance
        </Text>
        <Text variant="body" role="textMuted">
          {scored.verdict?.sentence ?? 'No plants yet — add a few to see how they balance.'}
        </Text>
      </Card>
    );
  }

  // Scoring failed — surface the diagnostic plainly (no grey badge).
  if (scored.score === null || scored.verdict === null) {
    return (
      <Card style={styles.card}>
        <View style={[styles.diagPill, { backgroundColor: c.surfaceSunken }]}>
          <Text variant="caption" role="accent">
            ⚠ Couldn’t score this build
          </Text>
        </View>
        <Text variant="body" role="textMuted">
          {scored.diagnostic ?? 'Scoring is unavailable for this build.'}
        </Text>
      </Card>
    );
  }

  const { score, verdict } = scored;
  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <Text variant="overline" role="textMuted">
          Eco-balance · {ecoBandLabel(verdict.band)}
        </Text>
        <Text variant="caption">{Math.round(score)}%</Text>
      </View>
      <EcoMeter score={score} />
      <Text variant="body">{verdict.sentence}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diagPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs, borderRadius: Radii.pill },
});
