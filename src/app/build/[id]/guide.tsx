/**
 * Build Guide — the one-time physical-assembly checklist for a saved Build
 * (ADR 0009). A focused, full-screen sub-screen off Build Detail, reached from
 * its "Build guide" section card.
 *
 * The guide is **derived live** from the saved Build, never stored: the same
 * `loadPlants` → `resolveBuildContainer` → `generateBuildGuide` path the planner's
 * Final step used to preview, reading the build's persisted depths + mix. Editing
 * the build re-derives it.
 *
 * Check state is **ephemeral** — you tick steps as you physically build; nothing
 * persists, and it resets on back-nav (it's not a tracked project). Ticking the
 * final step fires a completion haptic.
 *
 * Step instructions carry inline `[[slug]]` glossary markup, rendered through
 * `<GlossaryText>` → `<TermSheet>` (the `browse.tsx` wiring) so a term opens the
 * shared overlay without leaving the checklist.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { GlossaryText } from '@/components/glossary-text';
import { TermSheet } from '@/components/term-sheet';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { usePreferences } from '@/hooks/use-preferences';
import { copy } from '@/lib/copy';
import { loadPlants } from '@/data';
import { componentLabel } from '@/data/substrate-components';
import { useDbState, type Repos } from '@/db/provider';
import type { Build } from '@/db/schema';
import { resolveBuildContainer } from '@/logic/containers';
import { generateBuildGuide, type BuildStep, type SubstrateMixGuide } from '@/logic/guide';
import { describeMix, formatMixRecipe, mixSubstrate } from '@/logic/substrateMixer';
import type { Plant } from '@/types/plant';

export default function BuildGuideRoute() {
  const state = useDbState();
  if (state.status === 'loading') return <GuideMessage title={copy('build.loading.title')} />;
  if (state.status === 'error')
    return <GuideMessage title={copy('build.libError.title')} body={state.error} />;
  return <BuildGuide repos={state.repos} />;
}

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; build: Build };

function BuildGuide({ repos }: { repos: Repos }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { units } = usePreferences();

  const plants = useMemo(() => loadPlants(), []);

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [termSlug, setTermSlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    repos.builds
      .load(id)
      .then((build) => {
        if (active) setLoad({ status: 'ready', build });
      })
      .catch(() => {
        if (active) setLoad({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [repos, id]);

  if (load.status === 'loading') return <GuideMessage title={copy('build.loading.title')} />;
  if (load.status === 'missing')
    return <GuideMessage title={copy('build.notFound.title')} body={copy('build.notFound.body')} />;

  const { build } = load;
  const container = resolveBuildContainer(build);
  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  const buildPlants = build.plantSlugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is Plant => !!p);

  // A custom substrate-mixer recipe → concrete recipe + soft character for the
  // guide's Substrate-Layer line. Pre-formatted here (labels live in src/data) so
  // `@/logic/guide` stays import-pure. Mirrors final-step's projection.
  let substrateMix: SubstrateMixGuide | undefined;
  if (build.substrateMix) {
    const recipe = formatMixRecipe(build.substrateMix, componentLabel);
    if (recipe) substrateMix = { recipe, character: describeMix(mixSubstrate(build.substrateMix)) };
  }

  // `generateBuildGuide` THROWS on empty plants — guard + try/catch. Omit
  // `drainageMaterial` so the module's own markup-bearing default applies.
  let guide: BuildStep[] | null = null;
  if (buildPlants.length > 0 && container) {
    try {
      guide = generateBuildGuide(buildPlants, container, {
        substrateDepth: build.substrateDepth,
        drainageDepth: build.drainageDepth,
        charcoalDepth: build.charcoalDepth,
        substrateMix,
        units,
      });
    } catch {
      guide = null;
    }
  }

  return (
    <>
      <Screen edges={{ bottom: true }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <BackLink />
            <SectionLabel>Build guide</SectionLabel>
            <Text variant="headline">{build.name || 'Your terrarium'}</Text>

            {guide ? (
              <Checklist steps={guide} onPressTerm={setTermSlug} />
            ) : (
              <Text variant="body" role="textMuted">
                Add a container and at least one plant to generate a build guide.
              </Text>
            )}
          </View>
        </ScrollView>
      </Screen>
      <TermSheet slug={termSlug} onClose={() => setTermSlug(null)} />
    </>
  );
}

/**
 * The interactive checklist. Check state is local + ephemeral; ticking the last
 * open step fires a completion haptic.
 */
function Checklist({
  steps,
  onPressTerm,
}: {
  steps: BuildStep[];
  onPressTerm: (slug: string) => void;
}) {
  const { c } = useTokens();
  const [checked, setChecked] = useState<Set<number>>(() => new Set());

  function toggle(step: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(step)) {
        next.delete(step);
        haptics.select();
      } else {
        next.add(step);
        // Completing the final outstanding step → a small completion moment.
        if (next.size === steps.length) haptics.commit();
        else haptics.select();
      }
      return next;
    });
  }

  return (
    <View style={styles.steps}>
      {steps.map((s) => {
        const isDone = checked.has(s.step);
        return (
          <Pressable
            key={s.step}
            onPress={() => toggle(s.step)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone }}
            accessibilityLabel={s.title}
            style={styles.stepRow}>
            <View
              style={[
                styles.checkbox,
                { borderColor: isDone ? c.primary : c.border },
                isDone && { backgroundColor: c.primary },
              ]}>
              {isDone ? (
                <Text variant="caption" style={{ color: c.onPrimary }}>
                  ✓
                </Text>
              ) : null}
            </View>
            <View style={styles.stepBody}>
              <Text
                variant="body"
                style={[styles.stepTitle, isDone && styles.stepTitleDone]}>
                {s.title}
              </Text>
              <GlossaryText
                text={s.instruction}
                onPressTerm={onPressTerm}
                variant="caption"
                role="textMuted"
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function BackLink() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      hitSlop={8}
      style={styles.back}>
      <Text variant="caption" role="primary">
        ‹ Back
      </Text>
    </Pressable>
  );
}

function GuideMessage({ title, body }: { title: string; body?: string }) {
  return (
    <Screen edges={{ bottom: true }}>
      <View style={styles.inner}>
        <BackLink />
        <Text variant="headline">{title}</Text>
        {body ? (
          <Text variant="body" role="textMuted">
            {body}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.xl },
  inner: { padding: Spacing.lg, gap: Spacing.md },
  back: { alignSelf: 'flex-start' },
  steps: { gap: Spacing.sm },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: Radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBody: { flex: 1, gap: Spacing.xs },
  stepTitle: { fontWeight: '600' },
  stepTitleDone: { textDecorationLine: 'line-through', opacity: 0.6 },
});
