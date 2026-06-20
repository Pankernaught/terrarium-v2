/**
 * Build detail — the read-only build view. Replaces v1's 728-line tabbed
 * `pages/build_detail.py` with progressive disclosure:
 *
 *   hero → glance header → verdict band → Tier-2 (container facts + plant chips)
 *        → Tier-3 pairwise matrix behind a deliberate tap.
 *
 * Read-only by default; "Edit" re-opens the planner. Scoring runs through the
 * same pure `scoreBuild` the dashboard uses, so a broken build shows a real
 * diagnostic in the verdict band, never v1's silent grey badge.
 *
 * Persistence is the injected repos (`useRepos`) — no driver here, no
 * re-implemented store.
 */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ActionSheet,
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
import { PlantSheet } from '@/components/plant-sheet';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { useDbState, type Repos } from '@/db/provider';
import type { Build, BuildPhoto } from '@/db/schema';
import { resolveBuildContainer } from '@/logic/containers';
import { resolveBuildSummary } from '@/logic/export-txt';
import { shareBuildPdf, shareBuildTxt } from '@/lib/export';
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
  | { status: 'ready'; build: Build; heroUri: string | null; photos: BuildPhoto[]; primaryId: string | null };

function BuildDetail({ repos }: { repos: Repos }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTokens();

  const plants = useMemo(() => loadPlants(), []);
  const containers = useMemo(() => loadContainers(), []);

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [sheetPlant, setSheetPlant] = useState<Plant | null>(null);

  // Pure fetch (no setState) — adding/changing photos can change the primary, so
  // we refresh the hero, the list, and the primary pointer together.
  const fetchReady = useCallback(async (): Promise<LoadState> => {
    const build = await repos.builds.load(id);
    const [primary, photos] = await Promise.all([
      repos.photos.getPrimary(build.id),
      repos.photos.list(build.id),
    ]);
    return {
      status: 'ready',
      build,
      heroUri: primary?.filePath ?? null,
      photos,
      primaryId: primary?.id ?? null,
    };
  }, [repos, id]);

  const reload = useCallback(async () => {
    try {
      setLoad(await fetchReady());
    } catch {
      setLoad({ status: 'missing' });
    }
  }, [fetchReady]);

  useEffect(() => {
    let active = true;
    fetchReady()
      .then((next) => {
        if (active) setLoad(next);
      })
      .catch(() => {
        // load() throws a "not found" — surface it as a real missing state.
        if (active) setLoad({ status: 'missing' });
      });
    return () => {
      active = false;
    };
  }, [fetchReady]);

  // --- Photo actions -------------------------------------------------------

  async function onSetPrimary(buildId: string, photoId: string) {
    await repos.photos.setPrimary(buildId, photoId);
    haptics.select();
    await reload();
  }

  async function addFrom(source: 'camera' | 'library') {
    if (load.status !== 'ready') return;
    const buildId = load.build.id;
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo access needed',
          source === 'camera'
            ? 'Allow camera access in Settings to take a progress photo.'
            : 'Allow photo-library access in Settings to choose a progress photo.',
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (result.canceled || !result.assets?.length) return;
      await repos.photos.add(buildId, result.assets[0].uri);
      haptics.commit();
      await reload();
    } catch (err) {
      Alert.alert('Couldn’t add photo', err instanceof Error ? err.message : String(err));
    }
  }

  if (load.status === 'loading') return <DetailMessage title="Loading…" />;
  if (load.status === 'missing')
    return <DetailMessage title="Build not found" body="This terrarium may have been deleted." />;

  const { build, heroUri, photos, primaryId } = load;
  const scored = scoreBuild(build, plants, containers);
  const container = resolveBuildContainer(build, containers);
  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  const buildPlants = build.plantSlugs.map((slug) => bySlug.get(slug)).filter((p): p is Plant => !!p);

  function onEdit() {
    // "Edit" re-opens the planner on this build (shell this phase; interactive in 6).
    router.push(`/planner?build=${build.id}` as Href);
  }

  function onExport() {
    const data = resolveBuildSummary(build, plants, containers);
    Alert.alert('Export', `Choose a format for “${build.name}”.`, [
      { text: 'Text (.txt)', onPress: () => shareBuildTxt(data).catch(reportExportError) },
      { text: 'PDF', onPress: () => shareBuildPdf(data).catch(reportExportError) },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
              <View style={styles.headerActions}>
                <Pressable onPress={onExport} accessibilityRole="button" hitSlop={8} style={[styles.editBtn, { borderColor: c.border }]}>
                  <Text variant="caption" role="primary">
                    Export
                  </Text>
                </Pressable>
                <Pressable onPress={onEdit} accessibilityRole="button" hitSlop={8} style={[styles.editBtn, { borderColor: c.border }]}>
                  <Text variant="caption" role="primary">
                    Edit
                  </Text>
                </Pressable>
              </View>
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
                    onPress={() => setSheetPlant(p)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Photo timeline — progress photos grouped by day; tap to set the cover. */}
          <PhotoTimeline
            photos={photos}
            primaryId={primaryId}
            onSetPrimary={(photoId) => onSetPrimary(build.id, photoId)}
            onAdd={() => setAddSheetOpen(true)}
          />

          {/* Tier 3 — the full pairwise breakdown, behind a deliberate tap. */}
          {scored.report && buildPlants.length >= 2 ? (
            <PairwiseMatrix report={scored.report} plants={buildPlants} />
          ) : null}
        </View>
      </ScrollView>

      {/* Add-photo source picker — camera or library, both via expo-image-picker. */}
      <ActionSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        title="Add a progress photo"
        actions={[
          { label: 'Take photo', onPress: () => addFrom('camera') },
          { label: 'Choose from library', onPress: () => addFrom('library') },
        ]}
      />

      <PlantSheet
        plant={sheetPlant}
        onClose={() => setSheetPlant(null)}
        context="browse"
      />
    </Screen>
  );
}

function reportExportError(err: unknown) {
  Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
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

// --- Photo timeline --------------------------------------------------------

interface PhotoDay {
  key: string;
  label: string;
  photos: BuildPhoto[];
}

const DAY_LABEL = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Group photos by calendar day, newest day first and newest-within-day first.
 * `list()` returns earliest-first, so we walk it in reverse.
 */
function groupByDay(photos: BuildPhoto[]): PhotoDay[] {
  const days: PhotoDay[] = [];
  const byKey = new Map<string, PhotoDay>();
  for (let i = photos.length - 1; i >= 0; i--) {
    const photo = photos[i];
    const d = photo.takenAt;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let day = byKey.get(key);
    if (!day) {
      day = { key, label: DAY_LABEL.format(d), photos: [] };
      byKey.set(key, day);
      days.push(day);
    }
    day.photos.push(photo);
  }
  return days;
}

function PhotoTimeline({
  photos,
  primaryId,
  onSetPrimary,
  onAdd,
}: {
  photos: BuildPhoto[];
  primaryId: string | null;
  onSetPrimary: (photoId: string) => void;
  onAdd: () => void;
}) {
  const { c } = useTokens();
  const days = useMemo(() => groupByDay(photos), [photos]);

  return (
    <View style={styles.section}>
      <View style={styles.tier3Head}>
        <SectionLabel>Photo timeline</SectionLabel>
        <Pressable onPress={onAdd} accessibilityRole="button" hitSlop={8} style={[styles.editBtn, { borderColor: c.border }]}>
          <Text variant="caption" role="primary">
            Add photo
          </Text>
        </Pressable>
      </View>

      {photos.length === 0 ? (
        <Text variant="body" role="textMuted">
          No progress photos yet — add your first.
        </Text>
      ) : (
        <View style={styles.timelineDays}>
          {days.map((day) => (
            <View key={day.key} style={styles.timelineDay}>
              <Text variant="caption" role="textMuted">
                {day.label}
              </Text>
              <View style={styles.thumbGrid}>
                {day.photos.map((photo) => (
                  <PhotoThumb
                    key={photo.id}
                    photo={photo}
                    isPrimary={photo.id === primaryId}
                    onSetPrimary={() => onSetPrimary(photo.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PhotoThumb({
  photo,
  isPrimary,
  onSetPrimary,
}: {
  photo: BuildPhoto;
  isPrimary: boolean;
  onSetPrimary: () => void;
}) {
  const { c } = useTokens();
  return (
    <Pressable
      // The primary is already the cover — only a non-primary tap changes it.
      onPress={isPrimary ? undefined : onSetPrimary}
      disabled={isPrimary}
      accessibilityRole={isPrimary ? 'image' : 'button'}
      accessibilityLabel={isPrimary ? 'Cover photo' : 'Set as cover photo'}
      style={styles.thumbWrap}>
      <Image
        source={{ uri: photo.filePath }}
        style={[styles.thumb, isPrimary && { borderWidth: 2, borderColor: c.primary }]}
        contentFit="cover"
        transition={120}
      />
      {isPrimary ? (
        <View style={[styles.coverBadge, { backgroundColor: c.primary }]}>
          <Text variant="overline" style={{ color: c.onPrimary }}>
            Cover
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
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
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radii.pill, borderWidth: 1 },
  section: { gap: Spacing.sm },
  card: { padding: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tier3Head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timelineDays: { gap: Spacing.md },
  timelineDay: { gap: Spacing.sm },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: 100, height: 100, borderRadius: Radii.md },
  coverBadge: {
    position: 'absolute',
    left: Spacing.xs,
    bottom: Spacing.xs,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  pairRow: { gap: Spacing.xs },
  pairHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pairNames: { flexShrink: 1 },
  conflictLine: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingLeft: Spacing.xs },
  conflictDot: { width: 7, height: 7, borderRadius: Radii.pill, marginTop: 6 },
  conflictText: { flexShrink: 1, lineHeight: 18 },
});
