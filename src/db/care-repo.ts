/**
 * Care-mark repository (reminders + timeline).
 *
 * A care-mark row models **one scheduled occurrence** of a care task. The model
 * is intentionally minimal — there is no separate "schedule" entity, just rows:
 *
 *   - **`dueAt`** is when the occurrence fires.
 *   - **`completedAt` is the pending flag** — `null` while the occurrence is
 *     waiting, set when the user marks it done.
 *   - A build's reminders are **"enabled" iff it has at least one pending row**
 *     (`completedAt IS NULL`). There is no boolean column; presence of pending
 *     rows *is* the enabled state. So pending rows must be cheap to query
 *     (`pendingForBuild` / `listPending`) and cheap to clear (`disableForBuild`).
 *   - **Mark-done = complete + append next.** Completing the current occurrence
 *     stamps its `completedAt` and inserts the *next* pending occurrence
 *     (`dueAt = completedAt + intervalDays`), so a build that is "on" always has
 *     exactly one pending row per kind rolling forward. History (completed rows)
 *     is never mutated — the timeline reads it.
 *
 * `kind` is the task-type string (`'watering-inspection' | 'lid-opening' |
 * 'trimming'` today) but is treated as a free string here — the repo never
 * imports a logic module. `plantSlug` is `null` for build-level tasks.
 *
 * Imports are restricted to `drizzle-orm`, `./schema`, and `./ids` — the repo
 * never reaches a concrete driver, `src/data`, or `src/logic` (the +interval
 * arithmetic is inlined for that reason).
 */
import { and, asc, eq, isNull } from 'drizzle-orm';

import { newId } from './ids';
import { type CareMark, careMarks, type TerrariumDb } from './schema';

const MS_PER_DAY = 86_400_000;

export interface NewCareMarkInput {
  buildId: string;
  kind: string;
  dueAt: Date;
  plantSlug?: string | null;
  note?: string | null;
}

export interface CareRepository {
  /** Insert a pending occurrence (completedAt = null). Returns the new row. */
  add(input: NewCareMarkInput): Promise<CareMark>;
  /** All rows for a build, createdAt asc then dueAt asc. */
  listForBuild(buildId: string): Promise<CareMark[]>;
  /** Pending rows (completedAt IS NULL) for a build, dueAt asc. */
  pendingForBuild(buildId: string): Promise<CareMark[]>;
  /** Pending rows across ALL builds, dueAt asc — feeds the notification budget refill. */
  listPending(): Promise<CareMark[]>;
  /**
   * Mark a pending row done: set its completedAt (default now) and insert the NEXT
   * pending occurrence with dueAt = completedAt + intervalDays. Returns the NEW
   * pending row (so the caller can (re)schedule its notification). Throws if the id
   * is unknown.
   */
  markDone(id: string, intervalDays: number, at?: Date): Promise<CareMark>;
  /** Toggle-off: delete only the PENDING rows for a build (history survives). */
  disableForBuild(buildId: string): Promise<void>;
  /** Build deleted: delete ALL rows for a build. */
  purgeForBuild(buildId: string): Promise<void>;
}

export function createCareRepository(db: TerrariumDb): CareRepository {
  /** A single care-mark row, or `undefined` when absent. */
  async function getMark(id: string): Promise<CareMark | undefined> {
    const [row] = await db.select().from(careMarks).where(eq(careMarks.id, id));
    return row;
  }

  const repo: CareRepository = {
    async add(input) {
      const mark: CareMark = {
        id: newId(),
        buildId: input.buildId,
        plantSlug: input.plantSlug ?? null,
        kind: input.kind,
        note: input.note ?? null,
        dueAt: input.dueAt,
        completedAt: null,
        createdAt: new Date(),
      };
      await db.insert(careMarks).values(mark);
      return mark;
    },

    listForBuild(buildId) {
      return db
        .select()
        .from(careMarks)
        .where(eq(careMarks.buildId, buildId))
        .orderBy(asc(careMarks.createdAt), asc(careMarks.dueAt));
    },

    pendingForBuild(buildId) {
      return db
        .select()
        .from(careMarks)
        .where(and(eq(careMarks.buildId, buildId), isNull(careMarks.completedAt)))
        .orderBy(asc(careMarks.dueAt));
    },

    listPending() {
      return db
        .select()
        .from(careMarks)
        .where(isNull(careMarks.completedAt))
        .orderBy(asc(careMarks.dueAt));
    },

    async markDone(id, intervalDays, at = new Date()) {
      const mark = await getMark(id);
      if (!mark) throw new Error(`Care mark ${id} not found.`);

      // Complete the current occurrence — history rows are never mutated again.
      await db.update(careMarks).set({ completedAt: at }).where(eq(careMarks.id, id));

      // Append the next pending occurrence, interval-shifted from completion
      // (arithmetic inlined to keep the repo free of `src/logic`).
      const nextDue = new Date(at.getTime() + intervalDays * MS_PER_DAY);
      const next: CareMark = {
        id: newId(),
        buildId: mark.buildId,
        plantSlug: mark.plantSlug,
        kind: mark.kind,
        note: mark.note,
        dueAt: nextDue,
        completedAt: null,
        createdAt: new Date(),
      };
      await db.insert(careMarks).values(next);
      return next;
    },

    async disableForBuild(buildId) {
      await db
        .delete(careMarks)
        .where(and(eq(careMarks.buildId, buildId), isNull(careMarks.completedAt)));
    },

    async purgeForBuild(buildId) {
      await db.delete(careMarks).where(eq(careMarks.buildId, buildId));
    },
  };

  return repo;
}
