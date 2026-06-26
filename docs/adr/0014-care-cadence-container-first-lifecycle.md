---
status: accepted
---

# Care cadence is container-first, and a new build runs a Settle-in → steady-state lifecycle

The reminder cadences in `careSchedule.ts` ([careSchedule.ts](../../src/logic/careSchedule.ts))
are horticulturally backwards in two ways: the **watering-inspection** interval
keys *only* off the wettest plant's soil-moisture and ignores the container
entirely, so a sealed jar of moisture-lovers nags every 4 days when a balanced
closed system takes water on the scale of *months*; and the **lid-opening**
("Air it out") table makes **sealed containers vent more often than lidded**,
when a balanced closed loop is the one you should almost never open. We will
(1) make **container openness the primary axis** of the watering cadence with
plant moisture as a secondary modifier, (2) **drop the recurring vent for sealed
containers** (as-needed only) and move the frequent venting numbers to lidded,
and (3) add a **one-time "Settle in" task** that gives a new build early
attention through its ~two-week establishment window, then ages out so the
steady-state tasks take over. Net effect: the number of recurring care tasks
scales *inversely* with how sealed the system is.

This is the first ADR to touch the cadence **shape**, not just its values — the
numbers were always flagged "provisional, curator-tunable" in the module header.
It revises an implementation assumption of [ADR 0013](0013-care-guide-surface-and-depth.md)
(that `generateCareGuide`'s Watering tip stays as-is) but keeps every public
contract: `CareTip[]` shape, `BODY_CATEGORY`, the budget guard, mute/reschedule.

## Context

`buildCareSchedule` ([careSchedule.ts:214](../../src/logic/careSchedule.ts))
derives three recurring task types from a build's plants + container. Two of the
three cadence tables are wrong on the physics:

- **Watering-inspection** uses `WATERING_INSPECTION_DAYS: Record<MoistureLevel,
  number>` (`wet 4 · moist 6 · moderate 9 · dry 14`). Container openness — the
  variable that *dominates* how a terrarium loses water — is absent. A sealed
  terrarium recycles its own water (transpire → condense on glass → run back to
  the substrate); once balanced it may take water only every few months, if at
  all. An open container dries like a potted plant. Keying the *inspection*
  rhythm off moisture alone is the bug.
- **Lid-opening** uses `LID_OPENING_DAYS` with `sealed { small 7, medium 12,
  large 18 }` vs `lidded { small 10, medium 16, large 24 }` — sealed vents *more*
  often than lidded. Backwards: routine scheduled venting of a healthy sealed
  system is an anti-pattern (you open it to *manage problems* — chronic fog,
  mold — not on a timer). The frequent numbers belong on lidded, which is built
  for gas exchange.

A third gap surfaces once watering is corrected: with sealed watering now
**45–90 days** out, the existing engine (`firstDueAt = createdAt + interval`)
would put a brand-new sealed terrarium's *first* reminder 1.5–3 months out —
nothing during the highest-risk **establishment window** (first 48 hours, then
~2 weeks) when mold, over-condensation, overheating, and transplant shock do
their damage. The long correct intervals *create* the need to handle break-in
explicitly.

One engine constraint shapes the fix: the scheduler only models **recurring**
tasks. `markDone` ([care-repo.ts:120](../../src/db/care-repo.ts)) always stamps
`completedAt` *and* appends the next pending occurrence, so a task that should
fire once and stop has no representation today.

## Decision

1. **Container openness is the primary axis of the watering-inspection cadence;
   plant moisture is the secondary modifier.** Replace the 1-D moisture table with
   a 2-D `opening × wettest-moisture` table. The wettest plant still selects the
   column; `container.opening` selects the row. Bands don't overlap, and the
   moisture spread *narrows* as the container seals (a sealed system self-regulates,
   so moisture preference matters least):

   | days | wet | moist | moderate | dry |
   |------|-----|-------|----------|-----|
   | **open**   | 3  | 5  | 8  | 12 |
   | **lidded** | 16 | 20 | 26 | 32 |
   | **sealed** | 45 | 60 | 75 | 90 |

   The selecting bucket becomes `${opening}-${moisture}` (transparency + tests),
   mirroring how `lid-opening` already encodes its bucket. `MAX_CARE_INTERVAL_DAYS`
   stays **90** — the sealed maximum lands exactly there, so the owner override
   clamp and the cadence stepper need no change.

2. **Sealed containers get no recurring "Air it out" task; venting is as-needed.**
   Drop the `sealed` row from the venting table and move the frequent numbers to
   `lidded` (`small 7 · medium 12 · large 18`). The `'sealed' | 'lidded'` branch
   collapses to a single `container.opening === 'lidded'` guard. Sealed venting is
   covered by (a) the Settle-in window below and (b) the troubleshooting prose
   already in the Watering/Humidity tips ("walls fogged solid for 48h+ → vent").
   Open containers keep having no vent task. This fixes the inversion by *removing*
   the wrong schedule rather than retuning it.

3. **A new build runs a one-time "Settle in" task across its establishment
   window.** A new `settle-in` task type — chronologically first — is seeded at
   reminders-enable with `firstDueAt ≈ createdAt + 2 days`, and is **age-gated**:
   `buildCareSchedule` includes it only while `now < createdAt + ~14 days`, so it
   drops out of the schedule once the build is established (no stale "settle in" on
   an old terrarium). It is a **single occurrence** whose prose spans the whole arc
   (48h phase + the two-week phase) — a second day-14 push is low-value (by then
   you've succeeded or already noticed trouble) and "fire N times then stop" is a
   heavier concept than "fire once." Its prose is container-aware as **enclosed vs
   open** (the lid-cracking / overheating advice only applies to enclosed builds).

4. **The cadence engine gains a minimal one-time-task capability.** `CareTask`
   gains `oneTime?: true`. `care-repo`'s `markDone` accepts `intervalDays:
   number | null`; `null` stamps `completedAt` and appends **no** successor.
   `buildCareSchedule` takes an optional `now = new Date()` for the age gate
   (backward-compatible; tests pass an explicit `now`). This is the smallest
   addition that lets one task fire once and stop without inventing a separate
   schedule entity — the rest of the model (pending-row-presence = enabled,
   budget guard, mute, reschedule) is untouched.

5. **Watering prose goes container-first; establishment content lives in the
   Build Guide.** `generateCareGuide`'s Watering branch switches on
   `container.opening` before moisture, so a sealed build reads "this recycles its
   own water — you'll rarely add any; read the glass" instead of a moisture-only
   instruction. The full **"Your first two weeks"** narrative lives in the Build
   Guide (the one-time work-through, [ADR 0009](0009-build-guide-sub-screen.md)),
   *not* in the steady-state guide — the Settle-in task is the *reminder* to read
   it, carrying a short notification body and condensed in-card prose that points
   to the Build Guide. The ongoing "What to do" card stays steady-state only
   (Watering / Humidity / Light / Trimming), so it doesn't carry break-in advice
   forever.

## Consequences

- **`careSchedule.ts`** — `CareTaskType` gains `'settle-in'` (added to
  `CARE_TASK_TYPES` first, `CARE_TASK_LABEL`); `WATERING_INSPECTION_DAYS` becomes
  the 2-D `opening × moisture` table; `LID_OPENING_DAYS` becomes lidded-only;
  `buildCareSchedule` emits the age-gated one-time settle-in and takes optional
  `now`. `CareTask` gains `oneTime?`.
- **`care.ts`** — the Watering tip derivation becomes container-first. The
  `CareTip[]` shape is unchanged; only the Watering branch logic changes.
- **`care-repo.ts`** — `markDone(id, intervalDays: number | null)`: `null` → no
  successor (the one-time path). No schema change.
- **`care.tsx`** — `fetchRows` includes the settle-in task (already has
  `container` + `buildPlants`); `toggle` seeds it with `dueAt = max(firstDueAt,
  now)` only when present; `markDone` routes `oneTime` tasks through the
  null-interval path; `TaskEditor` special-cases `oneTime` (no cadence stepper, no
  reschedule, no mute — prose + a single "Got it").
- **`src/data/copy.json`** — adds `care.notif.body.settle-in`, the settle-in
  in-card prose (enclosed / open variants), and the Build Guide step copy; all
  surface in the Plant Admin Copy tab ([ADR 0010](0010-ui-copy-catalog.md)). The
  `care.notif.body.<task-type>` watering/lid/trim keys from ADR 0013 stay.
- **Build Guide screen** — gains a "Your first two weeks" step.
- **Budget-guard side win:** sealed builds now schedule 45–90 days out, freeing
  near-term notification slots for the open terrariums that actually need them.
- **Trimming is unchanged** (mixed-growth only, paced by the fastest grower).
- **Deferred:** true semi-annual sealed checks (would need
  `MAX_CARE_INTERVAL_DAYS` raised to ~180, which also widens the owner stepper) —
  not worth it for a *glance*; quarterly is the ceiling. A two-phase settle-in
  (day-2 + day-14 pushes) is rejected here but reversible if the single occurrence
  proves too thin.
