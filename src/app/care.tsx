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
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Card, Collapse, GlanceHeader, haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { type Repos, useDbState } from '@/db/provider';
import type { Build, CareMark } from '@/db/schema';
import { useTokens } from '@/hooks/use-tokens';
import {
  buildCareSchedule,
  CARE_INTERVAL_UNITS,
  CARE_TASK_LABEL,
  clampCareInterval,
  intervalCount,
  intervalToDays,
  maxIntervalCount,
  splitInterval,
  type BudgetPlan,
  type CareIntervalUnit,
  type CareOverrides,
  type CareTask,
  type CareTaskOverride,
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
  /** The effective schedule — owner overrides (cadence / mute) already folded in. */
  schedule: CareTask[];
  /** Suggested (un-overridden) cadence per task — drives "Reset to suggested". */
  suggestedByType: Map<CareTaskType, number>;
  /** Pending occurrence per task type (the next reminder), if reminders are on. */
  pendingByType: Map<CareTaskType, CareMark>;
  enabled: boolean;
}

const DAY_MS = 86_400_000;

function Care({ repos }: { repos: Repos }) {
  const [rows, setRows] = useState<CareRow[] | null>(null);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  /** The one expanded (open-for-editing) build card, by id, or `null`. */
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

        const haveSchedule = container && buildPlants.length > 0;
        // The effective schedule carries the owner's overrides; the suggested pass
        // (no overrides) gives the baseline cadence each task can be reset to.
        const schedule = haveSchedule
          ? buildCareSchedule(buildPlants, container, build.createdAt, build.careOverrides ?? undefined)
          : [];
        const suggested = haveSchedule
          ? buildCareSchedule(buildPlants, container, build.createdAt)
          : [];
        const suggestedByType = new Map<CareTaskType, number>(
          suggested.map((t) => [t.type, t.intervalDays]),
        );

        const pending = await repos.careMarks.pendingForBuild(build.id);
        const pendingByType = new Map<CareTaskType, CareMark>();
        for (const mark of pending) pendingByType.set(mark.kind as CareTaskType, mark);

        return { build, schedule, suggestedByType, pendingByType, enabled: pending.length > 0 };
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
    // Seed only the tasks the owner hasn't muted (muted ones stay off until un-muted).
    for (const task of row.schedule) {
      if (task.muted) continue;
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

  /** Persist a build's care overrides, collapsing an empty map back to `null`. */
  async function writeOverrides(buildId: string, next: CareOverrides) {
    await repos.builds.update(buildId, {
      careOverrides: Object.keys(next).length > 0 ? next : null,
    });
  }

  /** Change a task's cadence. Storing the suggested value clears the override. */
  async function setCadence(row: CareRow, task: CareTask, days: number) {
    const clamped = clampCareInterval(days);
    const suggested = row.suggestedByType.get(task.type);
    const next = mergeOverride(row.build.careOverrides ?? {}, task.type, {
      intervalDays: clamped === suggested ? undefined : clamped,
    });
    haptics.select();
    await writeOverrides(row.build.id, next);
    await reload();
  }

  /** Mute / un-mute one task. While reminders are on, this also adds/clears its row. */
  async function toggleMute(row: CareRow, task: CareTask) {
    const nextMuted = !task.muted;
    const next = mergeOverride(row.build.careOverrides ?? {}, task.type, {
      muted: nextMuted ? true : undefined,
    });
    await writeOverrides(row.build.id, next);
    if (row.enabled) {
      if (nextMuted) await repos.careMarks.disableKind(row.build.id, task.type);
      else
        await repos.careMarks.add({
          buildId: row.build.id,
          kind: task.type,
          dueAt: dueInDays(task.intervalDays),
        });
    }
    haptics.select();
    await reload();
  }

  /** Nudge the next occurrence's due date by whole days (never into the past). */
  async function rescheduleTask(row: CareRow, task: CareTask, deltaDays: number) {
    const mark = row.pendingByType.get(task.type);
    if (!mark?.dueAt) return;
    await repos.careMarks.reschedule(mark.id, nudgeDue(mark.dueAt, deltaDays));
    haptics.select();
    await reload();
  }

  /** Clear a task's overrides, restoring its suggested cadence (and un-muting it). */
  async function resetTask(row: CareRow, task: CareTask) {
    const next = { ...(row.build.careOverrides ?? {}) };
    delete next[task.type];
    await writeOverrides(row.build.id, next);
    // If it was muted while reminders are on, bring its occurrence back on the
    // suggested cadence.
    if (row.enabled && task.muted) {
      const suggested = row.suggestedByType.get(task.type) ?? task.intervalDays;
      await repos.careMarks.add({
        buildId: row.build.id,
        kind: task.type,
        dueAt: dueInDays(suggested),
      });
    }
    haptics.select();
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
                expanded={expandedId === row.build.id}
                onExpandToggle={() =>
                  setExpandedId((id) => (id === row.build.id ? null : row.build.id))
                }
                onToggle={() => toggle(row)}
                onMarkDone={(task) => markDone(row, task)}
                onSetCadence={(task, days) => setCadence(row, task, days)}
                onToggleMute={(task) => toggleMute(row, task)}
                onReschedule={(task, delta) => rescheduleTask(row, task, delta)}
                onReset={(task) => resetTask(row, task)}
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

/**
 * Merge a patch into one task's override, pruning back to a clean map: an `undefined`
 * field clears that part, and a task with nothing left (default cadence, not muted)
 * drops out entirely. Returns a new map (never mutates the input).
 */
function mergeOverride(
  current: CareOverrides,
  type: CareTaskType,
  patch: Partial<CareTaskOverride>,
): CareOverrides {
  const merged: CareTaskOverride = { ...current[type], ...patch };
  const cleaned: CareTaskOverride = {};
  if (merged.intervalDays != null) cleaned.intervalDays = merged.intervalDays;
  if (merged.muted) cleaned.muted = true;

  const next: CareOverrides = { ...current };
  if (cleaned.intervalDays == null && !cleaned.muted) delete next[type];
  else next[type] = cleaned;
  return next;
}

/** Collapsed one-liner: the calm at-a-glance state for a build's reminders. */
function summaryText(row: CareRow): string {
  if (!row.enabled) {
    const n = row.schedule.length;
    return `Reminders off · ${n} ${n === 1 ? 'task' : 'tasks'} ready when you are`;
  }
  const dues = row.schedule
    .filter((t) => !t.muted)
    .map((t) => row.pendingByType.get(t.type)?.dueAt)
    .filter((d): d is Date => !!d);
  if (dues.length === 0) return 'On · every task muted';
  const soonest = dues.reduce((a, b) => (b < a ? b : a));
  return `On · next ${dueLabel(soonest)}`;
}

// --- Pieces -----------------------------------------------------------------

function CareBuildCard({
  row,
  expanded,
  onExpandToggle,
  onToggle,
  onMarkDone,
  onSetCadence,
  onToggleMute,
  onReschedule,
  onReset,
}: {
  row: CareRow;
  expanded: boolean;
  onExpandToggle: () => void;
  onToggle: () => void;
  onMarkDone: (task: CareTask) => void;
  onSetCadence: (task: CareTask, days: number) => void;
  onToggleMute: (task: CareTask) => void;
  onReschedule: (task: CareTask, deltaDays: number) => void;
  onReset: (task: CareTask) => void;
}) {
  const { c } = useTokens();
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        {/* Tap the name to open the build; the chevron is the customize/expand toggle. */}
        <Pressable
          style={styles.headName}
          onPress={() => {
            haptics.select();
            router.push(`/build/${row.build.id}` as Href);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${row.build.name}`}>
          <Text variant="subhead" numberOfLines={1}>
            {row.build.name}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            haptics.select();
            onExpandToggle();
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${expanded ? 'Collapse' : 'Customize'} ${row.build.name}`}
          hitSlop={12}>
          <Text
            variant="body"
            role="textMuted"
            style={[styles.chevron, expanded && styles.chevronOpen]}>
            ›
          </Text>
        </Pressable>
        <Switch
          value={row.enabled}
          onValueChange={onToggle}
          trackColor={{ true: c.primary, false: c.surfaceSunken }}
          accessibilityLabel={`Reminders for ${row.build.name}`}
        />
      </View>

      {expanded ? null : (
        <Text variant="caption" role="textMuted">
          {summaryText(row)}
        </Text>
      )}

      <Collapse open={expanded}>
        <View style={styles.editor}>
          {row.schedule.map((task) => (
            <TaskEditor
              key={task.type}
              task={task}
              suggested={row.suggestedByType.get(task.type)}
              pending={row.pendingByType.get(task.type) ?? null}
              enabled={row.enabled}
              onMarkDone={() => onMarkDone(task)}
              onSetCadence={(days) => onSetCadence(task, days)}
              onToggleMute={() => onToggleMute(task)}
              onReschedule={(delta) => onReschedule(task, delta)}
              onReset={() => onReset(task)}
            />
          ))}
          <Text variant="caption" role="textMuted" style={styles.editorHint}>
            {row.enabled
              ? 'Cadence changes apply to upcoming reminders.'
              : 'Turn reminders on to start this cycle.'}
          </Text>
        </View>
      </Collapse>
    </Card>
  );
}

function TaskEditor({
  task,
  suggested,
  pending,
  enabled,
  onMarkDone,
  onSetCadence,
  onToggleMute,
  onReschedule,
  onReset,
}: {
  task: CareTask;
  suggested: number | undefined;
  pending: CareMark | null;
  enabled: boolean;
  onMarkDone: () => void;
  onSetCadence: (days: number) => void;
  onToggleMute: () => void;
  onReschedule: (deltaDays: number) => void;
  onReset: () => void;
}) {
  const { c } = useTokens();
  const label = CARE_TASK_LABEL[task.type];
  const hasCadenceOverride = suggested != null && task.intervalDays !== suggested;
  const due = pending?.dueAt ?? null;

  // The cadence stepper works in whole `unit`s; `intervalDays` stays the stored
  // truth. `unit` is local input state, seeded from the stored value's cleanest
  // unit so e.g. 14 days opens as "2 weeks".
  const [unit, setUnit] = useState<CareIntervalUnit>(() => splitInterval(task.intervalDays).unit);
  const count = intervalCount(task.intervalDays, unit);

  function chooseUnit(next: CareIntervalUnit) {
    if (next === unit) return;
    setUnit(next);
    // Snap the stored days onto a whole multiple of the new unit so the display
    // always matches storage (skip the write when it already divides cleanly).
    const snapped = intervalToDays(intervalCount(task.intervalDays, next), next);
    if (snapped !== task.intervalDays) onSetCadence(snapped);
  }

  return (
    <View style={[styles.taskEditor, { borderTopColor: c.border }]}>
      <View style={styles.taskEditorHead}>
        <Text variant="body" style={task.muted ? styles.mutedName : styles.taskName} numberOfLines={1}>
          {label}
        </Text>
        <PillButton
          label={task.muted ? 'Muted' : 'Mute'}
          active={task.muted}
          onPress={onToggleMute}
          accessibilityLabel={`${task.muted ? 'Unmute' : 'Mute'} ${label}`}
        />
      </View>

      {task.muted ? (
        <Text variant="caption" role="textMuted">
          Won’t remind until you un-mute.
        </Text>
      ) : (
        <>
          <View style={styles.controlRow}>
            <Text variant="caption" role="textMuted">
              Check every
            </Text>
            <Stepper
              value={`${count} ${unitWord(unit, count)}`}
              onDecrement={() => onSetCadence(intervalToDays(count - 1, unit))}
              onIncrement={() => onSetCadence(intervalToDays(count + 1, unit))}
              decDisabled={count <= 1}
              incDisabled={count >= maxIntervalCount(unit)}
            />
          </View>
          <View style={styles.unitRow}>
            {CARE_INTERVAL_UNITS.map((u) => (
              <PillButton
                key={u}
                label={UNIT_TITLE[u]}
                active={u === unit}
                onPress={() => chooseUnit(u)}
                accessibilityLabel={`Set cadence in ${u}`}
                hitSlop={UNIT_PILL_HITSLOP}
              />
            ))}
          </View>

          {enabled && due ? (
            <View style={styles.controlRow}>
              <Text variant="caption" role="textMuted">
                {`Next ${dueLabel(due)}`}
              </Text>
              <Stepper onDecrement={() => onReschedule(-1)} onIncrement={() => onReschedule(1)} />
            </View>
          ) : null}

          <View style={styles.taskEditorFoot}>
            {hasCadenceOverride ? (
              // Pressable (not a bare Text onPress) so it can carry a 44pt hitSlop.
              // Slop is vertical-heavy — only non-tappable labels sit above/below it.
              <Pressable
                onPress={onReset}
                accessibilityRole="button"
                hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }}>
                <Text variant="caption" role="primary">
                  {`Reset to suggested (${suggested} days)`}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            {enabled && due ? (
              // Top slop kept small (4) so it doesn't overlap the reschedule stepper's
              // "+" sitting one 8px row-gap above it.
              <Pressable
                onPress={onMarkDone}
                accessibilityRole="button"
                hitSlop={{ top: 4, bottom: 10, left: 8, right: 8 }}
                style={[styles.doneBtn, { borderColor: c.border }]}>
                <Text variant="caption" role="primary">
                  Mark done
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

/** A −/value/+ control. Omit `value` for an arrows-only nudge (reschedule). */
function Stepper({
  value,
  onDecrement,
  onIncrement,
  decDisabled,
  incDisabled,
}: {
  value?: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <RoundButton label="−" onPress={onDecrement} disabled={decDisabled} />
      {value != null ? (
        <Text variant="body" style={styles.stepperValue}>
          {value}
        </Text>
      ) : null}
      <RoundButton label="+" onPress={onIncrement} disabled={incDisabled} />
    </View>
  );
}

// The −/+ buttons are a compact 32px. Grow the touch target by slopping OUTWARD
// (left for −, right for +, never between them) so it reaches 44pt wide without the
// two buttons of an arrows-only stepper overlapping in their 8px gap. Vertical slop
// is 4 — exactly half a row gap — so two vertically-stacked steppers meet but never
// overlap. (Full 44pt height would need a wider row gap; see styles.taskEditor.)
const ROUND_HITSLOP_MINUS = { top: 4, bottom: 4, left: 12, right: 0 };
const ROUND_HITSLOP_PLUS = { top: 4, bottom: 4, left: 0, right: 12 };

function RoundButton({
  label,
  onPress,
  disabled,
}: {
  label: '−' | '+';
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Increase' : 'Decrease'}
      hitSlop={label === '−' ? ROUND_HITSLOP_MINUS : ROUND_HITSLOP_PLUS}
      style={[styles.roundBtn, { borderColor: c.border }, disabled && styles.roundBtnDisabled]}>
      <Text variant="body" role={disabled ? 'textMuted' : 'primary'} style={styles.roundBtnLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function PillButton({
  label,
  active,
  onPress,
  accessibilityLabel,
  // Default tuned for the Mute pill (slops up into the head row); the unit pills
  // pass a balanced slop since they sit between two steppers.
  hitSlop = { top: 12, bottom: 4, left: 8, right: 8 },
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  hitSlop?: { top: number; bottom: number; left: number; right: number };
}) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={[
        styles.pill,
        { borderColor: c.border, backgroundColor: active ? c.surfaceSunken : 'transparent' },
      ]}>
      <Text variant="caption" role={active ? 'textMuted' : 'primary'}>
        {label}
      </Text>
    </Pressable>
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

/** A due date `days` from now — module-level so the `Date.now()` call isn't render-scoped. */
function dueInDays(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

/** Nudge an existing due date by whole days, never landing in the past. */
function nudgeDue(from: Date, deltaDays: number): Date {
  return new Date(Math.max(from.getTime() + deltaDays * DAY_MS, Date.now()));
}

const UNIT_TITLE: Record<CareIntervalUnit, string> = { days: 'Days', weeks: 'Weeks', months: 'Months' };

/** Singular/plural unit word for the stepper value ("1 day" / "2 weeks"). */
function unitWord(unit: CareIntervalUnit, count: number): string {
  const word = unit === 'days' ? 'day' : unit === 'weeks' ? 'week' : 'month';
  return count === 1 ? word : `${word}s`;
}

// Unit pills sit between the cadence stepper and the "Next due" stepper (both 8px
// gaps), so vertical slop stays at 4 to meet — never overlap — either.
const UNIT_PILL_HITSLOP = { top: 4, bottom: 4, left: 8, right: 8 };

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
  headName: { flex: 1 },
  chevron: { fontSize: 18 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },

  // --- Expanded editor ---
  editor: { marginTop: Spacing.xs },
  editorHint: { marginTop: Spacing.sm, fontStyle: 'italic' },
  taskEditor: {
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  taskEditorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  taskName: { flexShrink: 1 },
  mutedName: { flexShrink: 1, opacity: 0.55 },
  taskEditorFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  unitRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepperValue: { minWidth: 64, textAlign: 'center' },
  roundBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnDisabled: { opacity: 0.4 },
  roundBtnLabel: { lineHeight: 20 },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  doneBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyBody: { lineHeight: 22 },
});
