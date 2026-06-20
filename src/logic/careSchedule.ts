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

export type CareTaskType = 'watering-inspection' | 'lid-opening' | 'trimming';

/** All three task kinds, in display order (calmest → most active). */
export const CARE_TASK_TYPES: readonly CareTaskType[] = [
  'watering-inspection',
  'lid-opening',
  'trimming',
];

const DAY_MS = 86_400_000;

/** Human label for a task type (Care tab + notification title). */
export const CARE_TASK_LABEL: Record<CareTaskType, string> = {
  'watering-inspection': 'Watering check',
  'lid-opening': 'Air it out',
  trimming: 'Trim & tidy',
};

/** The `generateCareGuide` category each task reuses as its notification body. */
const BODY_CATEGORY: Record<CareTaskType, string> = {
  'watering-inspection': 'Watering',
  'lid-opening': 'Humidity',
  trimming: 'Trimming',
};

// --- The provisional cadence table (days). Retune freely. --------------------

/**
 * watering-**inspection** cadence by the *wettest* moisture profile present:
 * moisture-loving mixes signal sooner, so they're checked more often; dry profiles
 * are checked rarely. This is an inspection rhythm, **not** a watering schedule.
 */
const WATERING_INSPECTION_DAYS: Record<MoistureLevel, number> = {
  wet: 4,
  moist: 6,
  moderate: 9,
  dry: 14,
};

type VolumeBucket = 'small' | 'medium' | 'large';

/** Venting cadence by opening × volume. Open containers never appear here. */
const LID_OPENING_DAYS: Record<'sealed' | 'lidded', Record<VolumeBucket, number>> = {
  sealed: { small: 7, medium: 12, large: 18 },
  lidded: { small: 10, medium: 16, large: 24 },
};

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
  intervalDays: number;
  /** Notification body — reused verbatim from `generateCareGuide`. */
  body: string;
  /** First fire: one interval after build creation (don't nag on save). */
  firstDueAt: number;
}

/**
 * Derive the recurring care tasks for a build's plants + container.
 *
 * Returns `[]` when there are no plants (nothing to inspect, vent, or trim). The
 * tasks come back in `CARE_TASK_TYPES` order.
 *
 * @param plants    the build's resolved plants (empty → `[]`).
 * @param container the build's resolved container.
 * @param createdAt the build's creation time — `firstDueAt = createdAt + interval`.
 */
export function buildCareSchedule(
  plants: Plant[],
  container: Container,
  createdAt: Date,
): CareTask[] {
  if (plants.length === 0) return [];

  // One guide pass supplies every task's body text.
  const guide = generateCareGuide(plants, container);
  const bodyOf = (type: CareTaskType): string =>
    guide.find((t) => t.category === BODY_CATEGORY[type])?.tip ?? '';

  const base = createdAt.getTime();
  const tasks: CareTask[] = [];

  const push = (type: CareTaskType, bucket: string, intervalDays: number) => {
    tasks.push({
      type,
      bucket,
      intervalDays,
      body: bodyOf(type),
      firstDueAt: base + intervalDays * DAY_MS,
    });
  };

  // 1. watering-inspection — always (every terrarium needs moisture checks).
  const moisture = wettestMoisture(plants);
  push('watering-inspection', moisture, WATERING_INSPECTION_DAYS[moisture]);

  // 2. lid-opening — only enclosed containers (sealed / lidded).
  if (container.opening === 'sealed' || container.opening === 'lidded') {
    const vol = volumeBucket(container.volumeL);
    push('lid-opening', `${container.opening}-${vol}`, LID_OPENING_DAYS[container.opening][vol]);
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
