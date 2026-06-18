/**
 * Care-reminder notifications — the device edge for Phase 7 (decision 16).
 *
 * **Device-only.** This module imports `expo-notifications`, which has no node
 * binding, so it must never be pulled into the Vitest runner. Everything *decidable*
 * — which reminders fit the slot budget, what each fires, when it's next due — lives
 * in the pure `@/logic/careSchedule` (CI-tested); this file is the thin, untestable
 * native shell that calls the OS scheduler with that plan.
 *
 * **Model A (decision 16):** every enabled `(terrarium × task)` is **one native
 * *repeating* trigger** — a `TIME_INTERVAL { repeats: true }` that counts as one
 * permanent pending slot and fires even if the app is never opened (the dormant-user
 * case a care app most needs). iOS caps pending at 64; we keep a **~50-slot
 * soonest-due budget guard** (`planNotificationBudget`) and **refill on app-open +
 * on each mark-done**, disclosing any overflow in the Care tab — never a silent
 * 65th-drop. Android has no cap, so the guard simply never trips.
 *
 * **Known trade-off (documented):** a repeating `TIME_INTERVAL` fires one interval
 * from *scheduling*, so the "first fire one interval after creation" rule falls out
 * for free, but re-syncing on every app-open re-anchors the cadence. That is the
 * decision-16 design (refill-on-open); a per-occurrence DATE-trigger refinement is a
 * v2.1 escape hatch. The per-terrarium toggle remains the user's pressure valve.
 */
import * as Notifications from 'expo-notifications';

import {
  type BudgetPlan,
  type PendingTask,
  planNotificationBudget,
} from '@/logic/careSchedule';

const DAY_SECONDS = 86_400;

/** What a given pending slot should fire — resolved by the caller from its data. */
export interface CareNotificationMeta {
  title: string;
  body: string;
  intervalDays: number;
}

/**
 * Configure foreground presentation once (call on Care-tab mount). Without a
 * handler, a reminder that fires while the app is open is silently swallowed.
 */
export function configureCareNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false, // §4.6 — the calmest screen: no sound.
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ensure we may post local notifications, asking **only if not already decided**
 * (decision 13 — request after the first build, never on launch; the caller gates
 * this behind an explicit enable tap). Returns whether reminders are permitted.
 */
export async function ensureCarePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Reconcile the OS schedule with the current pending tasks: fit them to the budget
 * (soonest-due first), cancel everything, and re-arm the budgeted set as repeating
 * triggers. Returns the `BudgetPlan` so the Care tab can disclose any overflow.
 *
 * Cancel-all + reschedule keeps the mapping trivial (no per-slot identifier
 * bookkeeping); it is cheap at v2.0's 1–10-terrarium scale.
 *
 * @param pending all pending `(terrarium × task)` slots across the library.
 * @param meta    resolves a slot's fire content + cadence (title/body/intervalDays).
 */
export async function syncCareNotifications(
  pending: PendingTask[],
  meta: (task: PendingTask) => CareNotificationMeta,
): Promise<BudgetPlan> {
  const plan = planNotificationBudget(pending);

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const task of plan.scheduled) {
    const { title, body, intervalDays } = meta(task);
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, Math.round(intervalDays * DAY_SECONDS)),
        repeats: true,
      },
    });
  }

  return plan;
}

/** Cancel every pending care reminder (e.g. the user disabled their last terrarium). */
export async function cancelAllCareNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
