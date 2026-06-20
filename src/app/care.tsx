/**
 * Care tab — deliberately the calmest screen: no sound, minimal motion,
 * `notificationAsync(Success)` on mark-done, gentle (never alarmist) nudges.
 *
 * Per terrarium it shows the derived reminder schedule (3 build-level tasks —
 * watering-**inspection**, lid-opening, trimming) with a single per-terrarium
 * on/off toggle and a mark-done button per task. The schedule itself is *derived*
 * every render from the pure `@/logic/careSchedule`; persistence is just the
 * **presence of pending `care_marks` rows** — enabling seeds them (and asks
 * notification permission at that moment), disabling clears them.
 *
 * Notifications are reconciled against the OS on focus + after every change through
 * the device-only `@/lib/notifications`: the soonest-due **~50-slot budget guard**
 * picks what to arm and reports any overflow, which this screen discloses — never a
 * silent 65th-drop.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Card, GlanceHeader, haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { type Repos, useDbState } from '@/db/provider';
import type { Build, CareMark } from '@/db/schema';
import { useTokens } from '@/hooks/use-tokens';
import {
  buildCareSchedule,
  CARE_TASK_LABEL,
  type BudgetPlan,
  type CareTask,
  type CareTaskType,
  type PendingTask,
} from '@/logic/careSchedule';
import { resolveBuildContainer } from '@/logic/containers';
import {
  configureCareNotifications,
  ensureCarePermission,
  syncCareNotifications,
} from '@/lib/notifications';

export default function CareScreen() {
  const state = useDbState();

  useEffect(() => {
    configureCareNotifications();
  }, []);

  if (state.status === 'loading') return <CareMessage title="Care" body="Loading your terrariums…" />;
  if (state.status === 'error') return <CareMessage title="Care" body={state.error} accent />;
  return <Care repos={state.repos} />;
}

// --- Loaded ------------------------------------------------------------------

/** A terrarium with its derived schedule + which tasks currently have a pending row. */
interface CareRow {
  build: Build;
  schedule: CareTask[];
  /** Pending occurrence per task type (the next reminder), if reminders are on. */
  pendingByType: Map<CareTaskType, CareMark>;
  enabled: boolean;
}

function Care({ repos }: { repos: Repos }) {
  const [rows, setRows] = useState<CareRow[] | null>(null);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);

  /** Build every row's derived schedule + pending state from the store. */
  const fetchRows = useCallback(async (): Promise<CareRow[]> => {
    const plants = loadPlants();
    const containers = loadContainers();
    const bySlug = new Map(plants.map((p) => [p.slug, p]));
    const builds = await repos.builds.list();

    return Promise.all(
      builds.map(async (build): Promise<CareRow> => {
        const container = resolveBuildContainer(build, containers);
        const buildPlants = build.plantSlugs
          .map((slug) => bySlug.get(slug))
          .filter((p): p is NonNullable<typeof p> => !!p);

        const schedule =
          container && buildPlants.length > 0
            ? buildCareSchedule(buildPlants, container, build.createdAt)
            : [];

        const pending = await repos.careMarks.pendingForBuild(build.id);
        const pendingByType = new Map<CareTaskType, CareMark>();
        for (const mark of pending) pendingByType.set(mark.kind as CareTaskType, mark);

        return { build, schedule, pendingByType, enabled: pending.length > 0 };
      }),
    );
  }, [repos]);

  /** Reconcile the OS notification schedule with all pending rows (budget guard). */
  const resync = useCallback(
    async (current: CareRow[]) => {
      const meta = new Map<string, { title: string; body: string; intervalDays: number }>();
      for (const row of current) {
        for (const task of row.schedule) {
          meta.set(`${row.build.id}:${task.type}`, {
            title: `${CARE_TASK_LABEL[task.type]} · ${row.build.name}`,
            body: task.body,
            intervalDays: task.intervalDays,
          });
        }
      }

      const pending = await repos.careMarks.listPending();
      const tasks: PendingTask[] = pending
        .filter((m) => m.dueAt != null)
        .map((m) => ({ buildId: m.buildId, type: m.kind as CareTaskType, dueAt: m.dueAt!.getTime() }));

      const next = await syncCareNotifications(tasks, (t) => meta.get(`${t.buildId}:${t.type}`) ?? FALLBACK_META);
      setPlan(next);
    },
    [repos],
  );

  const reload = useCallback(async () => {
    const next = await fetchRows();
    setRows(next);
    await resync(next).catch(() => {}); // device-only; a scheduling hiccup never blocks the UI.
  }, [fetchRows, resync]);

  // Refill on every focus (app-open / tab-return).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchRows().then((next) => {
        if (!active) return;
        setRows(next);
        resync(next).catch(() => {});
      });
      return () => {
        active = false;
      };
    }, [fetchRows, resync]),
  );

  async function toggle(row: CareRow) {
    if (row.enabled) {
      await repos.careMarks.disableForBuild(row.build.id);
      haptics.select();
      await reload();
      return;
    }
    // Enabling: ask permission at the obvious moment (first enable, not on launch),
    // then seed the schedule as pending rows. Permission refusal leaves reminders off.
    const granted = await ensureCarePermission();
    if (!granted) {
      Alert.alert(
        'Reminders need permission',
        'Allow notifications for Terrarium in Settings to get gentle care reminders.',
      );
      return;
    }
    for (const task of row.schedule) {
      await repos.careMarks.add({ buildId: row.build.id, kind: task.type, dueAt: new Date(task.firstDueAt) });
    }
    haptics.commit();
    await reload();
  }

  async function markDone(row: CareRow, task: CareTask) {
    const mark = row.pendingByType.get(task.type);
    if (!mark) return;
    await repos.careMarks.markDone(mark.id, task.intervalDays);
    haptics.success(); // the one acknowledgement this calm screen makes.
    await reload();
  }

  if (rows === null) return <CareMessage title="Care" body="Loading your terrariums…" />;

  const schedulable = rows.filter((r) => r.schedule.length > 0);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <GlanceHeader title="Care" subtitle="Gentle reminders for your terrariums" />

          {plan && plan.deferredBuildCount > 0 ? <OverflowNotice plan={plan} /> : null}

          {schedulable.length === 0 ? (
            <EmptyState hasBuilds={rows.length > 0} />
          ) : (
            schedulable.map((row) => (
              <CareBuildCard
                key={row.build.id}
                row={row}
                onToggle={() => toggle(row)}
                onMarkDone={(task) => markDone(row, task)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const FALLBACK_META = {
  title: 'Terrarium care',
  body: 'Time to check on your terrarium.',
  intervalDays: 7,
};

// --- Pieces -----------------------------------------------------------------

function CareBuildCard({
  row,
  onToggle,
  onMarkDone,
}: {
  row: CareRow;
  onToggle: () => void;
  onMarkDone: (task: CareTask) => void;
}) {
  const { c } = useTokens();
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <Text variant="subhead" style={styles.cardTitle}>
          {row.build.name}
        </Text>
        <Switch
          value={row.enabled}
          onValueChange={onToggle}
          trackColor={{ true: c.primary, false: c.surfaceSunken }}
          thumbColor={c.onPrimary}
          accessibilityLabel={`Reminders for ${row.build.name}`}
        />
      </View>

      {row.enabled ? (
        <View style={styles.tasks}>
          {row.schedule.map((task) => (
            <TaskRow
              key={task.type}
              task={task}
              pending={row.pendingByType.get(task.type) ?? null}
              onMarkDone={() => onMarkDone(task)}
            />
          ))}
        </View>
      ) : (
        <Text variant="caption" role="textMuted">
          {`Reminders off · ${row.schedule.length} ${row.schedule.length === 1 ? 'task' : 'tasks'} ready when you are`}
        </Text>
      )}
    </Card>
  );
}

function TaskRow({
  task,
  pending,
  onMarkDone,
}: {
  task: CareTask;
  pending: CareMark | null;
  onMarkDone: () => void;
}) {
  const { c } = useTokens();
  const due = pending?.dueAt ?? null;
  return (
    <View style={[styles.taskRow, { borderTopColor: c.border }]}>
      <View style={styles.taskText}>
        <Text variant="body">{CARE_TASK_LABEL[task.type]}</Text>
        <Text variant="caption" role="textMuted">
          {due ? `Every ${task.intervalDays} days · ${dueLabel(due)}` : `Every ${task.intervalDays} days`}
        </Text>
      </View>
      <Text
        variant="caption"
        role="primary"
        style={[styles.doneBtn, { borderColor: c.border }]}
        onPress={onMarkDone}
        accessibilityRole="button">
        Mark done
      </Text>
    </View>
  );
}

function OverflowNotice({ plan }: { plan: BudgetPlan }) {
  const { c } = useTokens();
  const n = plan.scheduledBuildCount;
  return (
    <View style={[styles.notice, { backgroundColor: c.surfaceSunken }]}>
      <Text variant="caption" role="textMuted" style={styles.noticeText}>
        {`Reminders are active on your ${n} nearest-due ${n === 1 ? 'terrarium' : 'terrariums'}; the others resume automatically as these complete.`}
      </Text>
    </View>
  );
}

function EmptyState({ hasBuilds }: { hasBuilds: boolean }) {
  return (
    <Card style={styles.card}>
      <SectionLabel>Nothing to tend yet</SectionLabel>
      <Text variant="body" role="textMuted" style={styles.emptyBody}>
        {hasBuilds
          ? 'Add a container and at least one plant to a terrarium and its care schedule will appear here.'
          : 'Save your first terrarium in the planner and gentle care reminders will appear here.'}
      </Text>
    </Card>
  );
}

function CareMessage({ title, body, accent }: { title: string; body: string; accent?: boolean }) {
  return (
    <Screen>
      <View style={styles.inner}>
        <GlanceHeader title={title} />
        <Card style={styles.card}>
          {accent ? (
            <Text variant="subhead" role="accent">
              Couldn’t open your library
            </Text>
          ) : null}
          <Text variant="body" role="textMuted">
            {body}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

/** Gentle relative due text — "Due now" / "in 1 day" / "in N days". */
function dueLabel(dueAt: Date): string {
  const days = Math.round((dueAt.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return 'Due now';
  if (days === 1) return 'in 1 day';
  return `in ${days} days`;
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.md },
  notice: { padding: Spacing.md, borderRadius: Radii.md },
  noticeText: { lineHeight: 18 },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  cardTitle: { flexShrink: 1 },
  tasks: { marginTop: Spacing.xs },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taskText: { flexShrink: 1, gap: 2 },
  doneBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyBody: { lineHeight: 22 },
});
