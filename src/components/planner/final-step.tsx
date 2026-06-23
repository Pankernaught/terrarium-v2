/**
 * Final step — the planner's review screen (Container · Substrate · Plants ·
 * **Final**). The owner names the build, reads the Eco-balance verdict, and
 * scans the chosen plants before saving.
 *
 * The build guide no longer lives here (ADR 0009): it's a derived, interactive
 * checklist on its own sub-screen (`/build/[id]/guide`), reached from Build
 * Detail after saving. The Save hint sets that expectation.
 *
 * Strictly presentational and side-effect-light: it neither saves nor navigates —
 * the planner screen's nav button owns the save. The only `update` here is the
 * name field. Scoring is derived live off the pure `@/logic` modules over the
 * seed bundle (`loadPlants` — no DB round-trip); nothing from
 * `@/db` is imported.
 */
import { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, SectionLabel, Text, VerdictBand } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { loadPlants } from '@/data';
import { scoreBuild } from '@/logic/score-build';

import type { StepProps } from './step';

export function FinalStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();

  // Seed bundle: one read, memoised — no DB round-trip.
  const seedPlants = useMemo(() => loadPlants(), []);

  // The draft is structurally a valid `ScorableBuild` (snapshot fields + plantSlugs).
  const scored = useMemo(() => scoreBuild(draft, seedPlants), [draft, seedPlants]);

  return (
    <View style={styles.root}>
      {/* 1. Name */}
      <Card style={styles.card}>
        <SectionLabel>Name</SectionLabel>
        <TextInput
          value={draft.name}
          onChangeText={(text) => update({ name: text })}
          placeholder="Name your terrarium"
          placeholderTextColor={c.textMuted}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
          accessibilityLabel="Build name"
          style={[
            styles.input,
            { backgroundColor: c.surfaceSunken, borderColor: c.border, color: c.text },
          ]}
        />
      </Card>

      {/* 2. Eco-balance verdict */}
      <VerdictBand scored={scored} />

      {/* 3. Plants */}
      <Card style={styles.card}>
        <SectionLabel>{`Plants · ${plants.length}`}</SectionLabel>
        {plants.length > 0 ? (
          <View style={styles.chipRow}>
            {plants.map((p) => (
              <Chip key={p.slug} label={p.commonName} tone="sage" />
            ))}
          </View>
        ) : (
          <Text variant="caption" role="textMuted">
            No plants added yet.
          </Text>
        )}
      </Card>

      {/* 4. Save hint — the step-by-step build guide is next, on the saved build. */}
      <Text variant="caption" role="textMuted" style={styles.saveHint}>
        Save to finish — your step-by-step build guide is next.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  saveHint: { textAlign: 'center' },
});
