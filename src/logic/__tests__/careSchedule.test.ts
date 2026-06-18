/**
 * Care scheduler suite (net-new, Phase 7). Covers the provisional cadence table,
 * the "first due one interval after creation" + "next due one interval after
 * mark-done" math, and the soonest-due slot-budget guard (decision 16) — all pure,
 * so this is the CI safety net for the parts `expo-notifications` can't exercise in
 * the node runner.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCareSchedule,
  type CareTask,
  type CareTaskType,
  IOS_PENDING_CAP,
  nextDueAfter,
  PENDING_BUDGET,
  type PendingTask,
  planNotificationBudget,
  volumeBucket,
} from '../careSchedule';
import { makeContainerSpec, makePlant } from './factories';

const DAY_MS = 86_400_000;
const CREATED = new Date('2026-01-01T00:00:00.000Z');

const byType = (tasks: CareTask[]) => new Map(tasks.map((t) => [t.type, t]));
const types = (tasks: CareTask[]) => tasks.map((t) => t.type);

describe('buildCareSchedule — which tasks apply', () => {
  it('returns [] when there are no plants', () => {
    expect(buildCareSchedule([], makeContainerSpec(), CREATED)).toEqual([]);
  });

  it('always includes a watering-inspection task', () => {
    const tasks = buildCareSchedule([makePlant()], makeContainerSpec(), CREATED);
    expect(types(tasks)).toContain('watering-inspection');
  });

  it('includes lid-opening for sealed and lidded, but not open containers', () => {
    const plant = makePlant();
    for (const opening of ['sealed', 'lidded'] as const) {
      const tasks = buildCareSchedule([plant], makeContainerSpec({ opening }), CREATED);
      expect(types(tasks)).toContain('lid-opening');
    }
    const open = buildCareSchedule(
      [plant],
      makeContainerSpec({ opening: 'open', suitableFor: 'open' }),
      CREATED,
    );
    expect(types(open)).not.toContain('lid-opening');
  });

  it('includes trimming only when growth rates are mixed', () => {
    const slow = makePlant({ slug: 'a', growthRate: 'slow' });
    const fast = makePlant({ slug: 'b', growthRate: 'fast' });

    const uniform = buildCareSchedule([slow, makePlant({ slug: 'c', growthRate: 'slow' })], makeContainerSpec(), CREATED);
    expect(types(uniform)).not.toContain('trimming');

    const mixed = buildCareSchedule([slow, fast], makeContainerSpec(), CREATED);
    expect(types(mixed)).toContain('trimming');
  });
});

describe('buildCareSchedule — provisional cadence buckets', () => {
  it('paces watering-inspection by the wettest plant present', () => {
    const wet = makePlant({ slug: 'w', soilMoisture: 'wet' });
    const dry = makePlant({ slug: 'd', soilMoisture: 'dry' });

    const wettish = byType(buildCareSchedule([wet, dry], makeContainerSpec(), CREATED)).get('watering-inspection')!;
    expect(wettish.bucket).toBe('wet');
    expect(wettish.intervalDays).toBe(4);

    const dryOnly = byType(buildCareSchedule([dry], makeContainerSpec(), CREATED)).get('watering-inspection')!;
    expect(dryOnly.bucket).toBe('dry');
    expect(dryOnly.intervalDays).toBe(14);
  });

  it('paces lid-opening by opening × volume bucket', () => {
    const plant = makePlant();
    const sealedSmall = byType(
      buildCareSchedule([plant], makeContainerSpec({ opening: 'sealed', volumeL: 3 }), CREATED),
    ).get('lid-opening')!;
    expect(sealedSmall.bucket).toBe('sealed-small');
    expect(sealedSmall.intervalDays).toBe(7);

    const liddedLarge = byType(
      buildCareSchedule([plant], makeContainerSpec({ opening: 'lidded', volumeL: 40 }), CREATED),
    ).get('lid-opening')!;
    expect(liddedLarge.bucket).toBe('lidded-large');
    expect(liddedLarge.intervalDays).toBe(24);
  });

  it('paces trimming by the fastest grower present', () => {
    const moderate = makePlant({ slug: 'm', growthRate: 'moderate' });
    const fast = makePlant({ slug: 'f', growthRate: 'fast' });
    const trim = byType(buildCareSchedule([moderate, fast], makeContainerSpec(), CREATED)).get('trimming')!;
    expect(trim.bucket).toBe('fast');
    expect(trim.intervalDays).toBe(10);
  });

  it('volumeBucket cuts at 5 L and 20 L', () => {
    expect(volumeBucket(4.9)).toBe('small');
    expect(volumeBucket(5)).toBe('medium');
    expect(volumeBucket(20)).toBe('medium');
    expect(volumeBucket(20.1)).toBe('large');
  });
});

describe('buildCareSchedule — first due + body text', () => {
  it('sets firstDueAt one interval after creation (does not nag on save)', () => {
    const tasks = buildCareSchedule([makePlant({ soilMoisture: 'moist' })], makeContainerSpec(), CREATED);
    const water = byType(tasks).get('watering-inspection')!;
    expect(water.intervalDays).toBe(6);
    expect(water.firstDueAt).toBe(CREATED.getTime() + 6 * DAY_MS);
    expect(water.firstDueAt).toBeGreaterThan(CREATED.getTime());
  });

  it('reuses the generateCareGuide prose as each task body', () => {
    const slow = makePlant({ slug: 's', growthRate: 'slow' });
    const fast = makePlant({ slug: 'f', growthRate: 'fast' });
    const tasks = byType(buildCareSchedule([slow, fast], makeContainerSpec({ opening: 'sealed' }), CREATED));

    // Watering body talks about the substrate; Humidity body about the sealed
    // container; Trimming body about mixed growth — each non-empty and on-topic.
    expect(tasks.get('watering-inspection')!.body).toMatch(/substrate/i);
    expect(tasks.get('lid-opening')!.body).toMatch(/sealed|humidity/i);
    expect(tasks.get('trimming')!.body).toMatch(/growth|prun/i);
  });
});

describe('nextDueAfter', () => {
  it('reschedules one interval from the mark-done timestamp', () => {
    const done = new Date('2026-03-10T08:30:00.000Z');
    expect(nextDueAfter(done, 7)).toBe(done.getTime() + 7 * DAY_MS);
  });
});

describe('planNotificationBudget — the slot-budget guard (decision 16)', () => {
  const task = (buildId: string, type: CareTaskType, dueAt: number): PendingTask => ({ buildId, type, dueAt });

  it('schedules everything when under budget', () => {
    const pending = [task('a', 'watering-inspection', 100), task('b', 'trimming', 50)];
    const plan = planNotificationBudget(pending);
    expect(plan.scheduled).toHaveLength(2);
    expect(plan.deferred).toHaveLength(0);
    expect(plan.deferredBuildCount).toBe(0);
  });

  it('prioritizes soonest-due and defers the rest in due order', () => {
    const pending = [
      task('late', 'watering-inspection', 300),
      task('soon', 'watering-inspection', 100),
      task('mid', 'watering-inspection', 200),
    ];
    const plan = planNotificationBudget(pending, 2);
    expect(plan.scheduled.map((t) => t.buildId)).toEqual(['soon', 'mid']);
    expect(plan.deferred.map((t) => t.buildId)).toEqual(['late']);
  });

  it('is stable on ties (input order preserved)', () => {
    const pending = [task('a', 'watering-inspection', 100), task('b', 'lid-opening', 100), task('c', 'trimming', 100)];
    const plan = planNotificationBudget(pending, 2);
    expect(plan.scheduled.map((t) => t.buildId)).toEqual(['a', 'b']);
  });

  it('a synthetic 25-terrarium account stays ≤64 pending and surfaces the overflow', () => {
    // 25 terrariums × 3 tasks = 75 candidate slots, well past the iOS cap.
    const pending: PendingTask[] = [];
    for (let i = 0; i < 25; i++) {
      const due = i * DAY_MS; // distinct due times, ascending by terrarium
      pending.push(task(`t${i}`, 'watering-inspection', due));
      pending.push(task(`t${i}`, 'lid-opening', due + 1));
      pending.push(task(`t${i}`, 'trimming', due + 2));
    }
    expect(pending).toHaveLength(75);

    const plan = planNotificationBudget(pending);
    expect(plan.scheduled).toHaveLength(PENDING_BUDGET);
    expect(plan.scheduled.length).toBeLessThanOrEqual(IOS_PENDING_CAP);
    // Overflow is disclosed, never silently dropped.
    expect(plan.deferred).toHaveLength(25);
    expect(plan.deferredBuildCount).toBeGreaterThan(0);
  });
});
