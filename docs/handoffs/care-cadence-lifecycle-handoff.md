# Care cadence & lifecycle — handoff

Handoff for whoever implements [ADR 0014](../adr/0014-care-cadence-container-first-lifecycle.md)
against the [build plan](../plans/care-cadence-lifecycle-build-plan.md). The
decisions are made (two grilling rounds with the owner); this doc is the context
to start cold without re-deriving them.

## The ask (verbatim intent)

> our notifications and prose are way too unclear about how water in a terrarium
> (especially closed and lidded) works. Closed terrariums receive water in terms
> of months, if even that. The watering check should be most often for open
> terrariums, and then should increase exponentially for anything lidded or
> closed, and then the soil moisture levels should be considered after that.

Then, on airing:

> it makes no sense to have sealed terrariums airing on a shorter schedule than
> lidded, if at all? That task should happen once per year for these systems at
> maximum. Furthermore, we are going to have to talk about the typical terrarium
> integration period somewhere (initial 48 hours, and then the next two weeks).

## The two findings that frame everything

1. **The cadence tables are physically backwards.** `WATERING_INSPECTION_DAYS`
   keys *only* off the wettest plant's moisture (4–14d) and ignores
   `container.opening` — the variable that actually dominates water loss. And
   `LID_OPENING_DAYS` makes **sealed vent more often than lidded**, when a balanced
   closed loop is the one you should barely ever open. Both are in
   [careSchedule.ts](../../src/logic/careSchedule.ts); the prose mirrors the flaw in
   `generateCareGuide`'s Watering branch ([care.ts](../../src/logic/care.ts)).
2. **Correct intervals create an establishment gap.** Once sealed watering is
   45–90d, a new sealed build's first reminder would be months out — nothing during
   the first-48h / two-week break-in when things actually die. So break-in needs an
   explicit early touch.

## DECIDED (owner-confirmed; don't re-litigate unless you disagree)

- **Container openness is the primary watering axis; moisture is secondary.** 2-D
  `opening × moisture` table; moisture's spread *narrows* as the container seals.
  Numbers in ADR 0014 §1 / build-plan Phase A.
- **Sealed gets no recurring "Air it out" task.** (Owner picked "Drop it —
  as-needed only" over an annual nudge.) Move the frequent venting numbers to
  lidded; venting for sealed is the Settle-in window + the "fogged 48h+ → vent"
  troubleshooting prose. `MAX_CARE_INTERVAL_DAYS` stays 90 (no need to express
  >90-day intervals once sealed has no vent task and watering caps at 90).
- **Establishment is a dedicated one-time "Settle in" task.** (Owner picked the
  dedicated task over front-loading existing tasks or content-only.) **Single**
  occurrence (~day 2), prose spans the whole two-week arc — not two pushes. Ages
  out after ~14 days via an age gate in `buildCareSchedule`.
- **The engine gains exactly one concept: a task that fires once and stops.**
  `CareTask.oneTime`, `markDone(id, null)` → no successor, `buildCareSchedule(…,
  now?)` for the age gate. Nothing else about the model changes.
- **Establishment narrative lives in the Build Guide** (one-time work-through, ADR
  0009), not the steady-state guide. The Settle-in task is the *reminder* to read
  it; the ongoing "What to do" card stays steady-state only.

## OPEN / judgement calls for the implementer

1. **Exact `SETTLE_FIRST_DAYS` / `SETTLE_WINDOW_DAYS`.** Planned 2 and 14; tune if a
   day-3 first touch or a 10/21-day window reads better. The age gate is the only
   thing that depends on `SETTLE_WINDOW_DAYS`.
2. **`markDone(id, null)` return shape.** Recurring `markDone` returns the new
   pending row so the caller can (re)schedule its notification. The one-time path
   has no successor — return the completed row, `null`, or a small discriminated
   result; pick whatever keeps `care.tsx`'s `markDone`/`reload` flow cleanest.
3. **Settle-in copy split.** Planned `enclosed` vs `open` (the lid-cracking /
   overheating advice is enclosed-only). Collapse to one string if the prose reads
   fine unified.
4. **`TaskEditor` one-time layout.** The settle-in row hides cadence/mute/reschedule
   and shows prose + a single "Got it". Keep it the quietest row on the calmest
   screen (see the `care.tsx` header comment); match the guide-tip accordion styling
   already in the card if it fits.

## Code map (the anchors you'll touch)

- **`src/logic/careSchedule.ts`** — `WATERING_INSPECTION_DAYS` → 2-D;
  `LID_OPENING_DAYS` → lidded-only; `CareTaskType` + `CARE_TASK_TYPES` +
  `CARE_TASK_LABEL` gain `'settle-in'`; `CareTask` gains `oneTime?`;
  `buildCareSchedule` emits the age-gated settle-in and takes `now`.
- **`src/logic/care.ts`** — Watering branch (~36–72) container-first.
- **`src/db/care-repo.ts`** — `markDone` (~120) null-interval no-successor path.
- **`src/app/care.tsx`** — `fetchRows` (~87), `toggle` seeding (~167–188),
  `markDone` (~190, route `oneTime` → `null`), `resync` `meta` body (~127, add
  settle-in), `TaskEditor` (~445, one-time branch). The guide accordion +
  `TermSheet` wiring from the prior task are already here to reuse.
- **`src/data/copy.json`** — `care.notif.body.settle-in`, `care.settle.card.*`,
  Build Guide step copy.
- **Build Guide screen + copy** — "Your first two weeks" step.

## Constraints / notes

- **Ponytail active.** Phase A is table + prose. Phase B adds one engine concept and
  reuses everything else. No new table, migration, route, or dependency. If a phase
  grows one, stop and re-check against ADR 0014's Consequences / Out-of-scope.
- The pure engines (`care.ts`, `careSchedule.ts`) stay CI-verifiable in the node
  runner — don't make them import `src/db`, `src/data`, or `expo-notifications`.
  The age gate's `now` default (`new Date()`) is fine — tests pass an explicit `now`.
- Don't touch the cadence-override engine, mute, reschedule, the 50-slot budget
  guard, or the trimming logic — out of scope and solid.
- **Already shipped on this branch (`feat/care-depth-surface`):** ADR 0013 Phase
  1+4 — the guide is surfaced in the expanded Care card (accordion per category,
  glossary-linked), and notifications carry short `care.notif.body.<task-type>`
  bodies. Build on that; don't rebuild it. ADR 0013 Phases 2 (per-plant depth) and
  3 ("last done") are still unbuilt and tracked separately.
- **Pre-existing red CI (not yours):** `src/logic/recommend.ts` has a `tsc` error
  (`Cannot find name 'np'`), and `care.test.ts` + two `copy.test.ts` cases fail on
  the base tree (schema-factory + copy wording drift). Don't chase these.
