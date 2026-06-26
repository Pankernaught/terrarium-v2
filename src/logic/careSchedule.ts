/**
 * Care-reminder scheduling.
 *
 * `care.ts` (`generateCareGuide`) emits *static tip text* — it has no notion of
 * *when* to do anything. This module adds the missing cadence: it decides **which**
 * recurring care tasks a build needs and **how often**, then reuses the guide's
 * prose as each reminder's body.
 *
 * **Three task types only, all build-level:**
 *   - **watering-inspection** — "look, don't pour." A reminder to *inspect* moisture
 *     and decide, **never a fixed watering timer** (a fixed timer overwaters and
 *     kills terrariums — the load-bearing call). Always present.
 *   - **lid-opening** — vent / air out, by opening type × volume. Open containers
 *     are already open, so they get no lid task.
 *   - **trimming** — only when growth rates are *mixed* (reuses `generateCareGuide`'s
 *     mixed-growth detection), paced by the fastest grower present.
 *
 * **Intervals are a provisional, curator-tunable lookup table** (task type × coarse
 * bucket → days), *not* a "smart" function implying false precision — the numbers
 * exist nowhere in v1, so they are treated like the scoring constants: provisional
 * and easy to retune. **First occurrence is due one interval after build creation**
 * (don't nag on save) — and because the device schedules these as native repeating
 * triggers, that "first fire one interval out" falls out for free.
 *
 * Pure: this module imports only `src/types` + the sibling `care.ts`. It reaches
 * **no** driver, `src/db`, or `src/data` — the budget guard below operates on plain
 * `{ buildId, type, dueAt }` descriptors so it stays CI-verifiable in the node
 * runner (`expo-notifications` never loads here).
 */
import type { Container, GrowthRate, MoistureLevel, Plant } from '../types';
import { generateCareGuide } from './care';

export type CareTaskType = 'settle-in' | 'watering-inspection' | 'lid-opening' | 'trimming';

/**
 * Per-task, owner-set customization that overrides the derived defaults. Persisted
 * on the build (`builds.care_overrides`) so it survives a reminders off→on cycle —
 * unlike the live `care_marks` rows, which only exist while reminders are on.
 *
 *   - `intervalDays` — replaces the derived cadence for this task. Absent → use the
 *     suggested bucket value. Clamped to {@link MIN_CARE_INTERVAL_DAYS}…{@link
 *     MAX_CARE_INTERVAL_DAYS} when applied.
 *   - `muted` — the owner has silenced *this* task without disabling the whole
 *     build. A muted task is never seeded as a pending occurrence.
 *
 * Manual *reschedule* (nudging the next occurrence's due date) is **not** here —
 * that edits the live `care_marks` row's `dueAt` directly and only exists while the
 * occurrence does.
 */
export interface CareTaskOverride {
  intervalDays?: number;
  muted?: boolean;
}

/** Sparse map of task type → its override. Absent keys use the derived defaults. */
export type CareOverrides = Partial<Record<CareTaskType, CareTaskOverride>>;

/** Cadence override bounds — keep a custom interval sane (daily … quarterly). */
export const MIN_CARE_INTERVAL_DAYS = 1;
export const MAX_CARE_INTERVAL_DAYS = 90;

/** Round to whole days and clamp into the supported cadence range. */
export function clampCareInterval(days: number): number {
  const whole = Math.round(days);
  if (whole < MIN_CARE_INTERVAL_DAYS) return MIN_CARE_INTERVAL_DAYS;
  if (whole > MAX_CARE_INTERVAL_DAYS) return MAX_CARE_INTERVAL_DAYS;
  return whole;
}

// --- Cadence as a count × unit (Care-tab input only) -------------------------
// Storage stays a plain day-count (`intervalDays`); these just let the editor
// offer "every N days/weeks/months" instead of one-day-at-a-time stepping.
// ponytail: a month is a flat 30 days — good enough for a reminder cadence; no
// calendar math, and it keeps MAX (90d) a clean 3 months.

export type CareIntervalUnit = 'days' | 'weeks' | 'months';
export const CARE_INTERVAL_UNITS: readonly CareIntervalUnit[] = ['days', 'weeks', 'months'];
const UNIT_DAYS: Record<CareIntervalUnit, number> = { days: 1, weeks: 7, months: 30 };

/** The largest unit a day-count divides cleanly into (months → weeks → days). */
export function splitInterval(days: number): { count: number; unit: CareIntervalUnit } {
  if (days % UNIT_DAYS.months === 0) return { count: days / UNIT_DAYS.months, unit: 'months' };
  if (days % UNIT_DAYS.weeks === 0) return { count: days / UNIT_DAYS.weeks, unit: 'weeks' };
  return { count: days, unit: 'days' };
}

/** A whole count in `unit`, expressed (and clamped) as days. Count floored to ≥1. */
export function intervalToDays(count: number, unit: CareIntervalUnit): number {
  return clampCareInterval(Math.max(1, Math.round(count)) * UNIT_DAYS[unit]);
}

/** How many whole `unit`s a day-count is, for the stepper display (≥1). */
export function intervalCount(days: number, unit: CareIntervalUnit): number {
  return Math.max(1, Math.round(days / UNIT_DAYS[unit]));
}

/** Largest whole count allowed in `unit` — the stepper's upper bound. */
export function maxIntervalCount(unit: CareIntervalUnit): number {
  return Math.floor(MAX_CARE_INTERVAL_DAYS / UNIT_DAYS[unit]);
}

/** All task kinds, in display order (establishment first, then calmest → most active). */
export const CARE_TASK_TYPES: readonly CareTaskType[] = [
  'settle-in',
  'watering-inspection',
  'lid-opening',
  'trimming',
];

const DAY_MS = 86_400_000;

/** First fire of the one-time settle-in, and how long it stays in the schedule. */
const SETTLE_FIRST_DAYS = 2;
const SETTLE_WINDOW_DAYS = 14;

/** Human label for a task type (Care tab + notification title). */
export const CARE_TASK_LABEL: Record<CareTaskType, string> = {
  'settle-in': 'Settle in',
  'watering-inspection': 'Watering check',
  'lid-opening': 'Air it out',
  trimming: 'Trim & tidy',
};

/**
 * The `generateCareGuide` category each *steady-state* task reuses as its
 * notification body. `settle-in` is absent on purpose — its body is authored copy
 * (establishment prose), not a guide tip, so it carries an empty `body` here.
 */
const BODY_CATEGORY: Partial<Record<CareTaskType, string>> = {
  'watering-inspection': 'Watering',
  'lid-opening': 'Humidity',
  trimming: 'Trimming',
};

// --- The provisional cadence table (days). Retune freely. --------------------

/**
 * watering-**inspection** cadence: **container openness is the primary axis**,
 * wettest moisture the secondary modifier. Openness dominates water loss — a sealed
 * system recycles its own water (transpire → condense → run back) and takes water on
 * the scale of months; an open one dries like a pot. So the row is the opening and
 * the column is the wettest plant, and the moisture spread *narrows* as the container
 * seals (a sealed system self-regulates). This is an inspection rhythm, **not** a
 * watering schedule. (ADR 0014.)
 */
const WATERING_INSPECTION_DAYS: Record<Container['opening'], Record<MoistureLevel, number>> = {
  open: { wet: 3, moist: 5, moderate: 8, dry: 12 },
  lidded: { wet: 16, moist: 20, moderate: 26, dry: 32 },
  sealed: { wet: 45, moist: 60, moderate: 75, dry: 90 },
};

type VolumeBucket = 'small' | 'medium' | 'large';

/**
 * Venting cadence by volume — **lidded only**. A balanced sealed loop is the one you
 * should barely ever open (routine venting of a healthy closed system is an
 * anti-pattern); its venting is covered by the Settle-in window + the "fogged 48h+ →
 * vent" troubleshooting prose. Open containers are already open. (ADR 0014.)
 */
const LID_OPENING_DAYS: Record<VolumeBucket, number> = { small: 7, medium: 12, large: 18 };

/** Trimming cadence by the fastest grower present (only when growth is mixed). */
const TRIMMING_DAYS: Record<GrowthRate, number> = {
  fast: 10,
  moderate: 18,
  slow: 30,
};

// --- Bucket helpers ----------------------------------------------------------

const MOISTURE_ORDER: readonly MoistureLevel[] = ['dry', 'moderate', 'moist', 'wet'];
const GROWTH_ORDER: readonly GrowthRate[] = ['slow', 'moderate', 'fast'];

/** The wettest primary moisture requirement across the plants. */
function wettestMoisture(plants: Plant[]): MoistureLevel {
  return plants
    .map((p) => p.soilMoisture.primary)
    .reduce((a, b) => (MOISTURE_ORDER.indexOf(b) > MOISTURE_ORDER.indexOf(a) ? b : a));
}

/** The fastest growth rate across the plants. */
function fastestGrowth(plants: Plant[]): GrowthRate {
  return plants
    .map((p) => p.growthRate)
    .reduce((a, b) => (GROWTH_ORDER.indexOf(b) > GROWTH_ORDER.indexOf(a) ? b : a));
}

/** Coarse volume bucket: small < 5 L ≤ medium ≤ 20 L < large. */
export function volumeBucket(volumeL: number): VolumeBucket {
  if (volumeL < 5) return 'small';
  if (volumeL <= 20) return 'medium';
  return 'large';
}

// --- The schedule ------------------------------------------------------------

/** One recurring care task with its cadence and first-fire time. */
export interface CareTask {
  type: CareTaskType;
  /** The coarse bucket that selected the interval (transparency + tests). */
  bucket: string;
  /** The effective cadence — an owner override if set, else the derived default. */
  intervalDays: number;
  /** True when the owner has silenced this task (never seeded as a pending row). */
  muted: boolean;
  /** Notification body — reused verbatim from `generateCareGuide` (empty for one-time tasks). */
  body: string;
  /** First fire: one interval after build creation (don't nag on save). */
  firstDueAt: number;
  /**
   * A task that fires **once and stops** (no recurring successor). Only `settle-in`
   * is one-time today: it carries no cadence semantics, its prose comes from copy,
   * and `markDone` completes it with no follow-up occurrence.
   */
  oneTime?: true;
}

/**
 * Derive the recurring care tasks for a build's plants + container.
 *
 * Returns `[]` when there are no plants (nothing to inspect, vent, or trim). The
 * tasks come back in `CARE_TASK_TYPES` order.
 *
 * Owner `overrides` (cadence / mute) are folded in here so the effective schedule
 * is the single thing the Care tab, the seeding logic, and the notification budget
 * all read — `task.intervalDays` is already the overridden value and `task.muted`
 * already reflects the owner's choice. Muted tasks are still **returned** (so the
 * editor can list and un-mute them); the caller skips them when seeding occurrences.
 *
 * @param plants    the build's resolved plants (empty → `[]`).
 * @param container the build's resolved container.
 * @param createdAt the build's creation time — `firstDueAt = createdAt + interval`.
 * @param overrides per-task owner customization, or omitted for pure defaults.
 * @param now       evaluation time, for the one-time settle-in age gate (defaults to
 *                  real now; tests pass an explicit value).
 */
export function buildCareSchedule(
  plants: Plant[],
  container: Container,
  createdAt: Date,
  overrides?: CareOverrides,
  now: Date = new Date(),
): CareTask[] {
  if (plants.length === 0) return [];

  // One guide pass supplies every task's body text.
  const guide = generateCareGuide(plants, container);
  const bodyOf = (type: CareTaskType): string =>
    guide.find((t) => t.category === BODY_CATEGORY[type])?.tip ?? '';

  const base = createdAt.getTime();
  const tasks: CareTask[] = [];

  const push = (type: CareTaskType, bucket: string, defaultInterval: number) => {
    const override = overrides?.[type];
    const intervalDays =
      override?.intervalDays != null ? clampCareInterval(override.intervalDays) : defaultInterval;
    tasks.push({
      type,
      bucket,
      intervalDays,
      muted: override?.muted ?? false,
      body: bodyOf(type),
      firstDueAt: base + intervalDays * DAY_MS,
    });
  };

  // 0. settle-in — a one-time establishment nudge, chronologically first. Seeded for
  // every container but only while the build is inside its ~two-week break-in window,
  // so it ages out (drops from the schedule) once the build is established. Its prose
  // is authored copy (enclosed/open by `bucket`), so it carries an empty `body`.
  if (now.getTime() < base + SETTLE_WINDOW_DAYS * DAY_MS) {
    tasks.push({
      type: 'settle-in',
      bucket: container.opening,
      intervalDays: SETTLE_FIRST_DAYS,
      muted: false,
      body: '',
      firstDueAt: base + SETTLE_FIRST_DAYS * DAY_MS,
      oneTime: true,
    });
  }

  // 1. watering-inspection — always; paced by opening (primary) × moisture (secondary).
  const moisture = wettestMoisture(plants);
  push(
    'watering-inspection',
    `${container.opening}-${moisture}`,
    WATERING_INSPECTION_DAYS[container.opening][moisture],
  );

  // 2. lid-opening — lidded only (sealed vents as-needed, open is already open).
  if (container.opening === 'lidded') {
    const vol = volumeBucket(container.volumeL);
    push('lid-opening', `lidded-${vol}`, LID_OPENING_DAYS[vol]);
  }

  // 3. trimming — only when growth rates are mixed (reuses the guide's rule).
  const growthRates = new Set(plants.map((p) => p.growthRate));
  if (growthRates.size > 1) {
    const fastest = fastestGrowth(plants);
    push('trimming', fastest, TRIMMING_DAYS[fastest]);
  }

  return tasks;
}

/**
 * Next due time after a task is marked done: one interval from the mark-done
 * timestamp (which also handles early completion). Returns epoch ms.
 */
export function nextDueAfter(completedAt: Date, intervalDays: number): number {
  return completedAt.getTime() + intervalDays * DAY_MS;
}

// --- Slot-budget guard --------------------------------------------------------

/**
 * iOS caps an app at **64 pending local notifications**; the 65th is silently
 * dropped. We target a softer **~50-slot budget** (≈14 headroom for the permission
 * prompt, future features, OS slop). Android has no cap, so the guard simply never
 * trips there — no Android-specific branch.
 */
export const PENDING_BUDGET = 50;
export const IOS_PENDING_CAP = 64;

/** A pending reminder slot: one (terrarium × task), keyed by its next due time. */
export interface PendingTask {
  buildId: string;
  type: CareTaskType;
  /** When this reminder next fires (epoch ms) — the budget priority key. */
  dueAt: number;
}

/** The result of fitting pending tasks into the budget. */
export interface BudgetPlan {
  /** The soonest-due tasks that fit the budget — these get native triggers. */
  scheduled: PendingTask[];
  /** Tasks past the budget — deferred, refilled as scheduled ones complete. */
  deferred: PendingTask[];
  /** Distinct builds with ≥1 scheduled task — "active on your N nearest" copy. */
  scheduledBuildCount: number;
  /** Distinct builds with ≥1 deferred task — drives the Care-tab disclosure. */
  deferredBuildCount: number;
}

const distinctBuilds = (tasks: PendingTask[]): number =>
  new Set(tasks.map((t) => t.buildId)).size;

/**
 * Fit all pending reminders into the slot budget by **soonest-due across all
 * (terrarium, task)**: schedule up to `budget`, defer the rest. Stable on ties
 * (input order preserved) so the selection is deterministic. The caller refills on
 * app-open + on each fire and discloses the overflow in the Care tab — never a
 * silent 65th-drop.
 */
export function planNotificationBudget(
  pending: PendingTask[],
  budget: number = PENDING_BUDGET,
): BudgetPlan {
  // Stable sort by dueAt asc (Array.prototype.sort is stable in modern engines;
  // the index tiebreak makes it explicit regardless).
  const ordered = pending
    .map((task, index) => ({ task, index }))
    .sort((a, b) => a.task.dueAt - b.task.dueAt || a.index - b.index)
    .map(({ task }) => task);

  const scheduled = ordered.slice(0, Math.max(0, budget));
  const deferred = ordered.slice(Math.max(0, budget));

  return {
    scheduled,
    deferred,
    scheduledBuildCount: distinctBuilds(scheduled),
    deferredBuildCount: distinctBuilds(deferred),
  };
}
