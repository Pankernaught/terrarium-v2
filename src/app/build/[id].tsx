/**
 * Build detail — the read-only build view (Premium §4.3). Replaces v1's 728-line
 * tabbed `pages/build_detail.py` with progressive disclosure:
 *
 *   hero → glance header → verdict band → Tier-2 (container facts + plant chips)
 *        → Tier-3 pairwise matrix behind a deliberate tap.
 *
 * Read-only by default; "Edit" re-opens the planner (Phase 6). Scoring runs
 * through the same pure `scoreBuild` the dashboard uses, so a broken build shows a
 * real diagnostic in the verdict band, never v1's silent grey badge.
 *
 * Persistence is the injected Phase-4 repos (`useRepos`) — no driver here, no
 * re-implemented store.
 */
import { Image } from 'expo-image';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Card,
  Chip,
  GlanceHeader,
  haptics,
  Screen,
  SectionLabel,
  StatStrip,
  type Stat,
  Text,
  VerdictBand,
} from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { useDbState, type Repos } from '@/db/provider';
import type { Build } from '@/db/schema';
import { resolveBuildContainer } from '@/logic/containers';
import { scoreBuild } from '@/logic/score-build';
import type { CompatibilityResult, Conflict } from '@/types/results';
import type { Plant } from '@/types/plant';
import { humanize } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';

export default function BuildDetailRoute() {
  const state = useDbState();
  if (state.status === 'loading') return <DetailMessage title="Loading…" />;
  if (state.status === 'error') return <DetailMessage title="Couldn’t open your library" body={state.error} />;
  return <BuildDetail repos={state.repos} />;
}

// --- Loaded ----------------------------------------------------------------

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; build: Build; heroUri: string | null };

function BuildDetail({ repos }: { repos: Repos }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTokens();

  const plants = useMemo(() => loadPlants(), []);
  const containers = useMemo(() => loadContainers(), []);

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const build = await repos.builds.load(id);
        const primary = await repos.photos.getPrimary(build.id);
        if (active) setLoad({ status: 'ready', build, heroUri: primary?.filePath ?? null });
      } catch {
        // load() throws a "not found" — surface it as a real missing state.
        if (active) setLoad({ status: 'missing' });
      }
    })();
    return () => {
      active = false;
    };
  }, [repos, id]);

  if (load.status === 'loading') return <DetailMessage title="Loading…" />;
  if (load.status === 'missing')
    return <DetailMessage title="Build not found" body="This terrarium may have been deleted." />;

  const { build, heroUri } = load;
  const scored = scoreBuild(build, plants, containers);
  const container = resolveBuildContainer(build, containers);
  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  const buildPlants = build.plantSlugs.map((slug) => bySlug.get(slug)).filter((p): p is Plant => !!p);

  function onEdit() {
    // "Edit" re-opens the planner on this build — the planner lands in Phase 6.
    Alert.alert('Edit', 'Editing a build opens in the planner, arriving in the next phase.');
  }

  return (
    <Screen edges={{ bottom: true }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
            <Text variant="caption" role="primary">
              ‹ Terrariums
            </Text>
          </Pressable>

          {/* Hero */}
          {heroUri ? (
            <Image source={{ uri: heroUri }} style={styles.hero} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.hero, styles.heroFallback, { backgroundColor: c.surfaceSunken }]}>
              <Text variant="display" role="textMuted">
                🌿
              </Text>
            </View>
          )}

          <GlanceHeader
            title={build.name}
            subtitle={subtitle(buildPlants.length, container?.name)}
            trailing={
              <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8} style={[styles.editBtn, { borderColor: c.border }]}>
                <Text variant="caption" role="primary">
                  Edit
                </Text>
              </Pressable>
            }
          />

          {/* Tier 1 — the verdict band (meter + plain-English sentence, or diagnostic). */}
          <VerdictBand scored={scored} />

          {/* Tier 2 — container facts + plant chips. */}
          <View style={styles.section}>
            <SectionLabel>Container</SectionLabel>
            {container ? (
              <Card style={styles.card}>
                <StatStrip items={containerStats(container)} />
              </Card>
            ) : (
              <Card style={styles.card}>
                <Text variant="body" role="textMuted">
                  No container set yet.
                </Text>
              </Card>
            )}
          </View>

          <View style={styles.section}>
            <SectionLabel>{`Plants · ${buildPlants.length}`}</SectionLabel>
            {buildPlants.length === 0 ? (
              <Text variant="body" role="textMuted">
                No plants added yet.
              </Text>
            ) : (
              <View style={styles.chips}>
                {buildPlants.map((p) => (
                  <Chip
                    key={p.slug}
                    label={p.commonName}
                    tone="sage"
                    // Cast: the typed-routes manifest regenerates for plant/[slug] on `expo start`.
                    onPress={() => router.push(`/plant/${p.slug}` as Href)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Tier 3 — the full pairwise breakdown, behind a deliberate tap. */}
          {scored.report && buildPlants.length >= 2 ? (
            <PairwiseMatrix report={scored.report} plants={buildPlants} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

function subtitle(plantCount: number, containerName?: string): string {
  const plantPart = plantCount === 1 ? '1 plant' : `${plantCount} plants`;
  return containerName ? `${plantPart} · ${containerName}` : plantPart;
}

function containerStats(container: ReturnType<typeof resolveBuildContainer>): Stat[] {
  if (!container) return [];
  return [
    { label: 'Shape', value: humanize(container.shape) },
    { label: 'Opening', value: humanize(container.opening) },
    { label: 'Volume', value: `${container.volumeL.toFixed(1)} L` },
    { label: 'Dimensions', value: container.dimensionsCm },
  ];
}

// --- Tier 3: pairwise matrix -----------------------------------------------

const VERDICT_TONE = {
  compatible: 'primary',
  caution: 'accent',
  incompatible: 'accent',
} as const;

function PairwiseMatrix({ report, plants }: { report: NonNullable<ReturnType<typeof scoreBuild>['report']>; plants: Plant[] }) {
  const [open, setOpen] = useState(false);

  // Upper-triangle unique pairs, with the cell from the engine's matrix.
  const pairs: { a: Plant; b: Plant; cell: CompatibilityResult }[] = [];
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const cell = report.pairMatrix[plants[i].slug]?.[plants[j].slug];
      if (cell) pairs.push({ a: plants[i], b: plants[j], cell });
    }
  }

  function toggle() {
    haptics.select();
    setOpen((o) => !o);
  }

  return (
    <View style={styles.section}>
      <Pressable onPress={toggle} accessibilityRole="button" style={styles.tier3Head}>
        <SectionLabel>Pairwise compatibility</SectionLabel>
        <Text variant="caption" role="primary">
          {open ? 'Hide' : `Show all ${pairs.length}`}
        </Text>
      </Pressable>

      {open ? (
        <Card style={styles.card}>
          <View style={{ gap: Spacing.md }}>
            {pairs.map(({ a, b, cell }) => (
              <View key={`${a.slug}-${b.slug}`} style={styles.pairRow}>
                <View style={styles.pairHead}>
                  <Text variant="body" style={styles.pairNames}>
                    {a.commonName} <Text role="textMuted">×</Text> {b.commonName}
                  </Text>
                  <Chip label={`${Math.round(cell.score)}% · ${humanize(cell.verdict)}`} tone={VERDICT_TONE[cell.verdict]} />
                </View>
                {cell.conflicts.map((conflict, k) => (
                  <ConflictLine key={k} conflict={conflict} />
                ))}
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function ConflictLine({ conflict }: { conflict: Conflict }) {
  const { c } = useTokens();
  const dot = conflict.severity === 'incompatible' ? c.accent : c.sage;
  return (
    <View style={styles.conflictLine}>
      <View style={[styles.conflictDot, { backgroundColor: dot }]} />
      <Text variant="caption" role="textMuted" style={styles.conflictText}>
        {conflict.message}
        {conflict.viaSecondary ? ' (via a secondary tolerance)' : ''}
      </Text>
    </View>
  );
}

// --- Shared small states ---------------------------------------------------

function DetailMessage({ title, body }: { title: string; body?: string }) {
  const router = useRouter();
  return (
    <Screen edges={{ bottom: true }}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
          <Text variant="caption" role="primary">
            ‹ Terrariums
          </Text>
        </Pressable>
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
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.sm },
  back: { alignSelf: 'flex-start' },
  hero: { width: '100%', height: 200, borderRadius: Radii.lg },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radii.pill, borderWidth: 1 },
  section: { gap: Spacing.sm },
  card: { padding: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tier3Head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pairRow: { gap: Spacing.xs },
  pairHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pairNames: { flexShrink: 1 },
  conflictLine: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingLeft: Spacing.xs },
  conflictDot: { width: 7, height: 7, borderRadius: Radii.pill, marginTop: 6 },
  conflictText: { flexShrink: 1, lineHeight: 18 },
});
