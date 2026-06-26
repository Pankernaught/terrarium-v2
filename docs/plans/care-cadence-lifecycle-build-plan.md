# Care cadence & lifecycle — build plan

Implements [ADR 0014](../adr/0014-care-cadence-container-first-lifecycle.md). Two
phases, shipped in order: **(A)** container-first watering + inverted/trimmed
airing (cadence tables + prose) → **(B)** the one-time Settle-in lifecycle (engine
capability + task + Build Guide content). Each phase is independently shippable
and CI-green on its own.

Ponytail notes: Phase A is table + prose edits to the pure engines — no new
mechanism. Phase B adds exactly one engine concept (a task that fires once and
stops) and reuses everything else (pending-row seeding, budget guard, the
expanded card). No new table, no migration, no new dependency, no new route. The
pure engines (`care.ts`, `careSchedule.ts`) stay CI-verifiable in the node runner.

## Shared code map

- [src/logic/careSchedule.ts](../../src/logic/careSchedule.ts) — `CareTaskType`,
  `CARE_TASK_TYPES`, `CARE_TASK_LABEL`, `BODY_CATEGORY`, `WATERING_INSPECTION_DAYS`,
  `LID_OPENING_DAYS`, `TRIMMING_DAYS`, `wettestMoisture`, `volumeBucket`,
  `buildCareSchedule`, `CareTask`, `MAX_CARE_INTERVAL_DAYS` (= 90, unchanged).
- [src/logic/care.ts](../../src/logic/care.ts) — `generateCareGuide`; the Watering
  branch (~36–72) becomes container-first.
- [src/db/care-repo.ts](../../src/db/care-repo.ts) — `markDone(id, intervalDays,
  at?)` (~120) gains a `null`-interval no-successor path.
- [src/app/care.tsx](../../src/app/care.tsx) — `fetchRows` (~87), `toggle` seeding
  (~167), `markDone` (~190), `TaskEditor` (~445, one-time branch). Phase 1+4 of
  ADR 0013 already landed here (guide block, accordion, short notif bodies).
- [src/data/copy.json](../../src/data/copy.json) + [copy.ts](../../src/lib/copy.ts)
  — authored strings; `care.notif.body.<task-type>` keys exist from ADR 0013.
- The Build Guide screen + its copy (one-time work-through, ADR 0009) — Phase B's
  "Your first two weeks" step.

> **AGENTS.md:** read the versioned Expo 56 docs before writing any Expo code.

---

## Phase A — container-first watering + inverted/trimmed airing · difficulty 2

Fixes the two horticulturally-backwards cadence tables and the watering prose.
Pure-engine + prose + tests; no UI mechanism changes.

### Tasks

1. **Watering becomes 2-D (`opening × moisture`).** Replace
   `WATERING_INSPECTION_DAYS: Record<MoistureLevel, number>` with
   `Record<Container['opening'], Record<MoistureLevel, number>>`:

   ```
   open:   { wet 3,  moist 5,  moderate 8,  dry 12 }
   lidded: { wet 16, moist 20, moderate 26, dry 32 }
   sealed: { wet 45, moist 60, moderate 75, dry 90 }
   ```

   In `buildCareSchedule`, select the row by `container.opening` and the column by
   `wettestMoisture(plants)` (keep that helper). Bucket string →
   `${container.opening}-${moisture}`.

2. **Airing becomes lidded-only.** Drop the `sealed` row from `LID_OPENING_DAYS`
   (now `Record<VolumeBucket, number>` = `{ small 7, medium 12, large 18 }`).
   Replace the `opening === 'sealed' || 'lidded'` guard with
   `container.opening === 'lidded'`. Open + sealed get no vent task. Bucket string
   → `lidded-${vol}`.

3. **Watering prose goes container-first** in `generateCareGuide`. Switch the
   Watering branch on `container.opening` *before* moisture:
   - **sealed:** recycles its own water; rarely add any (often only every few
     months); read the glass, don't water on a timer; light fog clearing by midday
     is healthy; bone-dry walls → light mist; fogged 48h+ → vent first. (+ optional
     dry-leaning clause.)
   - **lidded:** holds most moisture; needs water far less than a potted plant —
     occasional top-ups over weeks; add a little only when the surface looks dry and
     condensation is low. (+ short moisture clause.)
   - **open:** keep today's moisture-based prose (it's correct for an open planting).

   Keep the `CareTip[]` shape and the `Watering` category label (so `BODY_CATEGORY`
   and the card still resolve it). Don't touch Humidity/Light/Trimming branches.

4. **Trimming unchanged** — leave `TRIMMING_DAYS` and the mixed-growth gate alone.

### Test / check

- `careSchedule.test.ts`: for equal moisture, `open < lidded < sealed` watering
  interval; a sealed build yields **no** `lid-opening` task; a lidded build does; an
  open build has neither vent nor... (only watering [+ trimming if mixed]). Update
  any existing assertions that hard-coded the old `WATERING_INSPECTION_DAYS` /
  `LID_OPENING_DAYS` numbers.
- `care.test.ts`: a sealed guide's Watering tip mentions the closed-loop framing
  (assert a stable substring, e.g. "recycles"); an open guide keeps moisture prose.
- Device check: a sealed build's Watering check cadence reads in weeks/months and
  it has no "Air it out" task; a lidded build vents on the 7/12/18 cadence.

### Done when

The two tables are container-first/lidded-only, the Watering prose reads correctly
per opening, sealed builds carry no vent task; `npm test` / `tsc` green.

---

## Phase B — the Settle-in one-time lifecycle · difficulty 3

Adds the establishment task and the single engine concept it needs. Depends on
Phase A only for the long sealed intervals that make it worthwhile.

### Tasks

1. **One-time engine capability.**
   - `care-repo.ts`: widen `markDone(id, intervalDays: number | null, at?)`.
     `null` → stamp `completedAt`, append **no** successor (return the completed
     row, or a sentinel — match how callers use the result). Keep history immutable.
   - `careSchedule.ts`: `CareTask` gains `oneTime?: true`.
   - `careSchedule.ts`: `buildCareSchedule(plants, container, createdAt, overrides?,
     now = new Date())` — new trailing optional `now` (backward compatible).

2. **Emit the Settle-in task.** In `buildCareSchedule`, push `settle-in` **first**
   (before watering), for every container, but only while
   `now.getTime() < createdAt.getTime() + SETTLE_WINDOW_DAYS * DAY_MS`
   (`SETTLE_WINDOW_DAYS = 14`). Set `oneTime: true`,
   `firstDueAt = createdAt + SETTLE_FIRST_DAYS * DAY_MS` (`SETTLE_FIRST_DAYS = 2`),
   no `intervalDays` cadence semantics, `bucket` = the opening (for the
   enclosed/open prose split). Add `'settle-in'` to `CareTaskType`,
   `CARE_TASK_TYPES` (first), `CARE_TASK_LABEL` (`'Settle in'`). It has **no**
   `BODY_CATEGORY` entry — its body comes from copy, not `generateCareGuide`.

3. **Seed + complete it (`care.tsx`).**
   - `toggle` (enable): when a `settle-in` task is present in `row.schedule`, seed
     it with `dueAt = new Date(Math.max(task.firstDueAt, Date.now()))` (never past).
   - `markDone`: if `task.oneTime`, call `markDone(mark.id, null)` — no successor;
     the row completes and the task ages out on next `fetchRows`.
   - The notification `meta` body for `settle-in` → `copy('care.notif.body.settle-in',
     { build })`.

4. **Render it (`TaskEditor`).** Special-case `task.oneTime`: show the settle-in
   prose (from copy, by `bucket` enclosed/open) + a single **"Got it"** (mark-done);
   hide the cadence stepper, unit pills, reschedule, and mute. Reuse `GlossaryText`
   so any `[[slug]]` links resolve (the `TermSheet` is already wired in the card).

5. **Build Guide "Your first two weeks" step.** Add the full establishment
   narrative (48h phase: lid cracked if heavily fogged, watch overheating,
   transplant-shock wilt; day-2–14 phase: check for mold/over-condensation, **don't
   add water yet**, reseal once fog clears by midday) as a Build Guide step, copy in
   `copy.json`. The settle-in in-card prose is the condensed version that points here.

6. **Copy keys.** `care.notif.body.settle-in` (short, `{build}`-templated, e.g.
   "Check in on your new {build}"), `care.settle.card.enclosed` / `…open` (in-card
   prose), and the Build Guide step copy.

### Test / check

- `care-repo.test.ts`: `markDone(id, null)` stamps `completedAt` and creates **no**
  new pending row (`pendingForBuild` empty after); a completed one-time row survives
  `disableForBuild` (history). The existing recurring `markDone` case stays green.
- `careSchedule.test.ts`: a fresh build (`now = createdAt`) includes a `settle-in`
  task with `oneTime` and `firstDueAt ≈ createdAt + 2d`; a build with
  `now = createdAt + 20d` does **not**. Settle-in is first in the returned order.
- `copy.test.ts`: `care.notif.body.settle-in` and the in-card prose keys exist and
  template `{build}` where applicable.
- Device check: a brand-new build shows a "Settle in" task due in ~2 days with no
  cadence controls; "Got it" clears it and it doesn't return; an older build never
  shows it.

### Done when

A new build gets one early "Settle in" reminder that ages out after ~2 weeks; the
engine supports a fire-once task; the Build Guide carries the first-two-weeks
narrative; tests green.

---

## Out of scope (don't gold-plate)

- A two-phase settle-in (separate day-2 + day-14 pushes) — single occurrence with
  full-arc prose is the call (ADR 0014 §3).
- Raising `MAX_CARE_INTERVAL_DAYS` past 90 for true semi-annual sealed checks —
  deferred (ADR 0014 Consequences); quarterly is the ceiling for a glance.
- Per-plant care depth and "last done" history — those are ADR 0013 Phases 2 & 3,
  tracked in [care-depth-build-plan.md](care-depth-build-plan.md), not this plan.
- Touching the budget guard, mute, reschedule, or the trimming logic.
- New care categories (fertilizing / algae / pest / seasonal) — separate, larger.
