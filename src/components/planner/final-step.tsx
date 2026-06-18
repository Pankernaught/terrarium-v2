/**
 * Final step — the planner's review screen (Container · Substrate · Hardscape ·
 * Plants · **Final**). The owner names the build, reads the Eco-balance verdict,
 * scans the chosen plants, and previews a static, read-only **build guide
 * projection** of what the saved build will look like.
 *
 * Strictly presentational and side-effect-light: it neither saves nor navigates —
 * the planner screen's nav button owns the save (Phase 6 chat 2). The only `update`
 * here is the name field. Scoring + guide are derived live off the pure
 * `@/logic` modules over the seed bundle (`loadPlants` / `loadContainers`,
 * decision 11 — no DB round-trip); nothing from `@/db` is imported.
 */
import { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, SectionLabel, Text, VerdictBand } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { loadContainers, loadPlants } from '@/data';
import { componentLabel } from '@/data/substrate-components';
import { resolveBuildContainer } from '@/logic/containers';
import { generateBuildGuide, type BuildStep, type SubstrateMixGuide } from '@/logic/guide';
import { hasHardscape } from '@/logic/placement';
import { scoreBuild } from '@/logic/score-build';
import { describeMix, formatMixRecipe, mixSubstrate } from '@/logic/substrateMixer';

import { DEFAULT_DRAINAGE_MATERIAL } from './draft';
import type { StepProps } from './step';

export function FinalStep({ draft, plants, update }: StepProps) {
  const { c } = useTokens();

  // Seed bundle (decision 11): one read each, memoised — no DB round-trip.
  const seedPlants = useMemo(() => loadPlants(), []);
  const seedContainers = useMemo(() => loadContainers(), []);

  // The draft is structurally a valid `ScorableBuild` (snapshot fields + plantSlugs).
  const scored = useMemo(
    () => scoreBuild(draft, seedPlants, seedContainers),
    [draft, seedPlants, seedContainers],
  );

  const container = useMemo(
    () => resolveBuildContainer(draft, seedContainers),
    [draft, seedContainers],
  );

  // A custom substrate-mixer recipe → the concrete recipe + soft character for the
  // guide's Substrate-Layer line (decision 10). Pre-formatted here (labels live in
  // src/data) so `@/logic/guide` stays import-pure. Null mix → undefined → the guide
  // keeps its generic substrateTags sentence.
  const substrateMix = useMemo<SubstrateMixGuide | undefined>(() => {
    const mix = draft.substrateMix;
    if (!mix) return undefined;
    const recipe = formatMixRecipe(mix, componentLabel);
    if (!recipe) return undefined;
    return { recipe, character: describeMix(mixSubstrate(mix)) };
  }, [draft.substrateMix]);

  // Build the read-only guide projection. `generateBuildGuide` THROWS on empty
  // plants, so only call it with plants + a resolved container, wrapped in try/catch.
  // We deliberately omit substrateDepth/drainageDepth: the guide's opts take preset
  // depth STRINGS ("3-5cm"), not the draft's numeric cm — let the guide compute them.
  const guide = useMemo<BuildStep[] | null>(() => {
    if (plants.length === 0 || !container) return null;
    try {
      return generateBuildGuide(plants, container, {
        drainageMaterial: DEFAULT_DRAINAGE_MATERIAL,
        includeHardscape: hasHardscape(draft.placements),
        substrateMix,
      });
    } catch {
      return null;
    }
  }, [plants, container, draft.placements, substrateMix]);

  const canGuide = plants.length > 0 && container != null;

  return (
    <View style={styles.root}>
      {/* 1. Name */}
      <Card style={styles.card}>
        <SectionLabel>Name</SectionLabel>
        <TextInput
          value={draft.name}
          onChangeText={(text) => update({ name: text })}
          placeholder="Untitled terrarium"
          placeholderTextColor={c.textMuted}
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

      {/* 4. Build guide projection (static, read-only) */}
      <Card style={styles.card}>
        <SectionLabel>Build guide</SectionLabel>
        {canGuide ? (
          guide ? (
            <View style={styles.steps}>
              {guide.map((s) => (
                <View key={s.step} style={styles.stepRow}>
                  <View style={[styles.stepNum, { backgroundColor: c.surfaceSunken }]}>
                    <Text variant="caption" role="sage">
                      {s.step}
                    </Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text variant="body" style={styles.stepTitle}>
                      {s.title}
                    </Text>
                    <Text variant="caption" role="textMuted">
                      {s.instruction}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="caption" role="textMuted">
              The build guide can’t be generated for this build just yet.
            </Text>
          )
        ) : (
          <Text variant="caption" role="textMuted">
            Finish the earlier steps — pick a container and at least one plant — to
            preview the build guide here.
          </Text>
        )}
      </Card>

      {/* 5. Save hint */}
      <Text variant="caption" role="textMuted" style={styles.saveHint}>
        Tapping Save below finishes the build.
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
  steps: { gap: Spacing.md },
  stepRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: { flex: 1, gap: Spacing.xs },
  stepTitle: { fontWeight: '600' },
  saveHint: { textAlign: 'center' },
});
