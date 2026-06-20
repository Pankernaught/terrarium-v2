/**
 * Terrariums — the dashboard. A responsive, centered grid of build cards.
 *
 * This replaces v1's `pages/home.py` mega-callback (`handle_builds_and_actions`,
 * which folded load + rename + delete + duplicate into one Output owner): here
 * those are plain repository calls. And it kills the `except Exception: pass` at
 * `home.py:189` — a scoring failure renders a real "Needs review" Eco chip + a
 * surfaced diagnostic, never a silent grey badge.
 *
 * Loading / error / empty all have honest states (no lingering spinners):
 * a flash of skeleton cards, a plain diagnostic, or an empty-state nudge.
 */
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ActionSheet, Card, GlanceHeader, haptics, Screen, Text } from '@/components/ui';
import { BuildCard } from '@/components/build-card';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { type Repos, useDbState } from '@/db/provider';
import type { Build } from '@/db/schema';
import { shareBuildPdf, shareBuildTxt } from '@/lib/export';
import { resolveBuildSummary } from '@/logic/export-txt';
import { scoreBuild, type ScoredBuild } from '@/logic/score-build';
import { useTokens } from '@/hooks/use-tokens';

const GRID_GAP = Spacing.lg;
const TWO_COL_MIN = 560;

interface Row {
  build: Build;
  scored: ScoredBuild;
  heroUri: string | null;
}

export default function TerrariumsScreen() {
  const state = useDbState();

  if (state.status === 'loading') return <DashboardSkeleton />;
  if (state.status === 'error') return <DashboardError message={state.error} />;
  return <Dashboard repos={state.repos} />;
}

// --- Ready ------------------------------------------------------------------

function Dashboard({ repos }: { repos: Repos }) {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Seed catalogs are static — load once and reuse for every build's score.
  const plants = useMemo(() => loadPlants(), []);
  const containers = useMemo(() => loadContainers(), []);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [overflowFor, setOverflowFor] = useState<Row | null>(null);
  // Optimistic delete: the row is gone from the grid while an undo window is open.
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pure data load (no setState) — so the mount effect's update is visibly after
  // the await, not a synchronous setState-in-effect.
  const fetchRows = useCallback(async (): Promise<Row[]> => {
    const builds = await repos.builds.list();
    return Promise.all(
      builds.map(async (build): Promise<Row> => {
        const primary = await repos.photos.getPrimary(build.id);
        return {
          build,
          scored: scoreBuild(build, plants, containers),
          heroUri: primary?.filePath ?? null,
        };
      }),
    );
  }, [repos, plants, containers]);

  const reload = useCallback(async () => setRows(await fetchRows()), [fetchRows]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchRows().then((next) => {
        if (active) setRows(next);
      });
      return () => {
        active = false;
      };
    }, [fetchRows]),
  );

  // --- Grid geometry: centered, capped, 1–2 columns ---
  const avail = Math.min(width - 2 * Spacing.md, MaxContentWidth);
  const cols = avail >= TWO_COL_MIN ? 2 : 1;
  const cardW = (avail - GRID_GAP * (cols - 1)) / cols;

  // --- Overflow actions ---
  async function onDuplicate(row: Row) {
    await repos.builds.duplicate(row.build.id, `${row.build.name} (copy)`);
    haptics.success();
    await reload();
  }

  function onExport(row: Row) {
    const data = resolveBuildSummary(row.build, plants, containers);
    Alert.alert('Export', `Choose a format for “${row.build.name}”.`, [
      { text: 'Text (.txt)', onPress: () => shareBuildTxt(data).catch(reportExportError) },
      { text: 'PDF', onPress: () => shareBuildPdf(data).catch(reportExportError) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function startDelete(row: Row) {
    haptics.destructive();
    setRows((cur) => cur?.filter((r) => r.build.id !== row.build.id) ?? cur);
    setPendingDelete(row);
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = setTimeout(() => commitDelete(row), 5000);
  }

  async function commitDelete(row: Row) {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setPendingDelete(null);
    await repos.builds.delete(row.build.id);
    // Cascade: drop the build's care reminders so no orphan pending rows linger
    // (its native triggers get re-reconciled to the budget next Care-tab focus).
    await repos.careMarks.purgeForBuild(row.build.id);
  }

  function undoDelete() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setPendingDelete(null);
    reload();
  }

  useEffect(() => () => void (deleteTimer.current && clearTimeout(deleteTimer.current)), []);

  if (rows === null) return <DashboardSkeleton />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, { width: avail }]}>
          <GlanceHeader
            title="Terrariums"
            subtitle={rows.length === 0 ? undefined : `${rows.length} ${rows.length === 1 ? 'build' : 'builds'}`}
            trailing={<NewButton onPress={() => router.push('/planner' as Href)} />}
          />

          {rows.length === 0 ? (
            <EmptyState onCreate={() => router.push('/planner' as Href)} />
          ) : (
            <View style={[styles.grid, { columnGap: GRID_GAP, rowGap: GRID_GAP }]}>
              {rows.map((row) => (
                <BuildCard
                  key={row.build.id}
                  name={row.build.name}
                  plantCount={row.build.plantSlugs.length}
                  scored={row.scored}
                  heroUri={row.heroUri}
                  width={cardW}
                  // Cast: the typed-routes manifest regenerates for build/[id] on `expo start`.
                  onPress={() => router.push(`/build/${row.build.id}` as Href)}
                  onOverflow={() => setOverflowFor(row)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ⋮ overflow — the single action menu (Duplicate / Export / Delete) */}
      <ActionSheet
        visible={overflowFor !== null}
        onClose={() => setOverflowFor(null)}
        title={overflowFor?.build.name}
        actions={
          overflowFor
            ? [
                { label: 'Duplicate', onPress: () => onDuplicate(overflowFor) },
                { label: 'Export', onPress: () => onExport(overflowFor) },
                { label: 'Delete', destructive: true, onPress: () => startDelete(overflowFor) },
              ]
            : []
        }
      />

      {/* Undo snackbar — the SQLite delete commits only after the window closes */}
      {pendingDelete ? (
        <UndoSnackbar label={`Deleted “${pendingDelete.build.name}”`} onUndo={undoDelete} />
      ) : null}
    </Screen>
  );
}

function reportExportError(err: unknown) {
  Alert.alert('Export failed', err instanceof Error ? err.message : String(err));
}

// --- Pieces -----------------------------------------------------------------

function NewButton({ onPress }: { onPress: () => void }) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={[styles.newBtn, { backgroundColor: c.primary }]}>
      <Text variant="caption" style={{ color: c.onPrimary, fontWeight: '600' }}>
        + New
      </Text>
    </Pressable>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { c } = useTokens();
  return (
    <Card style={styles.empty}>
      <Text variant="subhead">No terrariums yet</Text>
      <Text variant="body" role="textMuted" style={styles.emptyBody}>
        Build your first terrarium in the planner — pick a container, add plants, and watch the
        Eco-balance settle.
      </Text>
      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        style={[styles.emptyCta, { backgroundColor: c.primary }]}>
        <Text variant="body" style={{ color: c.onPrimary, fontWeight: '600' }}>
          New terrarium
        </Text>
      </Pressable>
    </Card>
  );
}

function UndoSnackbar({ label, onUndo }: { label: string; onUndo: () => void }) {
  const { c } = useTokens();
  return (
    <View style={styles.snackWrap} pointerEvents="box-none">
      <View style={[styles.snack, { backgroundColor: c.text }]}>
        <Text variant="body" style={{ color: c.background, flexShrink: 1 }}>
          {label}
        </Text>
        <Pressable onPress={onUndo} accessibilityRole="button" hitSlop={8}>
          <Text variant="caption" style={{ color: c.background, textDecorationLine: 'underline' }}>
            UNDO
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DashboardSkeleton() {
  const { c } = useTokens();
  const { width } = useWindowDimensions();
  const avail = Math.min(width - 2 * Spacing.md, MaxContentWidth);
  const cols = avail >= TWO_COL_MIN ? 2 : 1;
  const cardW = (avail - GRID_GAP * (cols - 1)) / cols;
  return (
    <Screen>
      <View style={[styles.inner, { width: avail }]}>
        <GlanceHeader title="Terrariums" />
        <View style={[styles.grid, { columnGap: GRID_GAP, rowGap: GRID_GAP }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.skeleton, { width: cardW, backgroundColor: c.surfaceSunken }]} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <Screen>
      <View style={styles.inner}>
        <GlanceHeader title="Terrariums" />
        <Card style={styles.empty}>
          <Text variant="subhead" role="accent">
            Couldn’t open your library
          </Text>
          <Text variant="body" role="textMuted" style={styles.emptyBody}>
            {message}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  empty: { padding: Spacing.lg, gap: Spacing.sm },
  emptyBody: { lineHeight: 22 },
  emptyCta: { alignSelf: 'flex-start', marginTop: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radii.md },
  newBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: Radii.pill },
  skeleton: { height: 240, borderRadius: Radii.lg, opacity: 0.6 },
  snackWrap: { position: 'absolute', left: Spacing.md, right: Spacing.md, bottom: Spacing.lg },
  snack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
  },
});
