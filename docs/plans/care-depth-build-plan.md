# Care depth & surfacing — build plan

Implements [ADR 0013](../adr/0013-care-guide-surface-and-depth.md). Three phases,
shipped in order: **(1+4)** surface the guide + shorten notifications →
**(2)** per-plant depth → **(3)** "last done" history. Each phase is independently
shippable and CI-green on its own.

Ponytail notes: every phase is render-side reuse of data already computed or
already stored. No new tables, no migration, no new route, no new dependency. The
pure engines (`care.ts`, `careSchedule.ts`) keep their contracts.

## Shared code map

- [src/logic/care.ts](../../src/logic/care.ts) — `generateCareGuide(plants,
  container) → CareTip[]` (`{ category, tip }`). Categories: Watering, Humidity,
  Light, Trimming (Trimming only on mixed growth). **Throws on empty plants.**
- [src/logic/careSchedule.ts](../../src/logic/careSchedule.ts) — `buildCareSchedule`,
  `CARE_TASK_LABEL`, `CareTask.body` (reused guide prose), `BODY_CATEGORY`.
- [src/app/care.tsx](../../src/app/care.tsx) — the Care tab. Key anchors:
  - `CareRow` interface (~67–76) — add fields here.
  - `fetchRows` (~87–119) — already resolves `container` + `buildPlants` per row;
    add the `generateCareGuide` call and (phase 3) the last-done read here.
  - `resync` (~122–144) — builds notification `meta`; `body: task.body` (~130) is
    what phase 4 changes.
  - `CareBuildCard` (~351) / `Collapse` (~420) — the expanded card; guide block
    goes at the top of the editor `View`.
  - `TaskEditor` (~445) — per-task editor; phase 3's "Last done" line goes here.
  - "Customize" affordance label (~397) — relabel to "Details".
- [src/data/copy.json](../../src/data/copy.json) + [copy.ts](../../src/lib/copy.ts)
  — authored strings, `{slot}` templates, typed keys. `care.notif.*` keys exist.
- [src/db/care-repo.ts](../../src/db/care-repo.ts) — `listForBuild` already returns
  completed + pending rows; `disableForBuild` deletes only pending. History is
  already persisted.

---

## Phase 1 + 4 — surface the guide, shorten notifications · difficulty 2

The highest impact-to-effort step: render content that already exists, and stop
overstuffing the push.

### Tasks

1. **Carry the guide on each row.** In `CareRow`, add `guide: CareTip[]`. In
   `fetchRows`, when `haveSchedule`, set `guide = generateCareGuide(buildPlants,
   container)`; else `guide = []`. (Import `generateCareGuide` + `CareTip`.)
2. **Render it in the expanded card.** At the top of the `Collapse` editor block
   in `CareBuildCard`, add a read-only "What to do" section: a `SectionLabel`
   then one labeled paragraph per `CareTip` (`category` as the label, `tip` as
   the body). Reuse `<GlossaryText>` for the body so any `[[slug]]` in the prose
   linkifies through `<TermSheet>` (wire `termSlug` state as `browse.tsx` does) —
   the guide prose is plain today, but this makes phase 2's plant `notes` (which
   *do* carry markup) render correctly with no rework.
3. **Relabel the affordance.** Chevron `accessibilityLabel` and intent move from
   "Customize" to "Details" (~397) so readers, not just tweakers, open the card.
4. **Short notification bodies.** Add copy keys
   `care.notif.body.watering-inspection`, `care.notif.body.lid-opening`,
   `care.notif.body.trimming`, each a one-liner templated with `{build}`
   (e.g. `"Check moisture on {build}"`, `"Time to vent {build}"`,
   `"Give {build} a trim"`). In `resync`, replace `body: task.body` with
   `copy('care.notif.body.' + task.type, { build: row.build.name })`. Keep
   `care.notif.body` as the `FALLBACK_META` body.

### Test / check

- `care.test.ts` already covers `generateCareGuide`. Add one assertion that every
  `CareTaskType` has a `care.notif.body.<type>` key (mirror however the copy
  catalog is currently integrity-checked) so a renamed task can't ship a missing
  notification string.
- Device check: enable reminders on a build, expand the card → guide prose shows
  with all four categories; trigger/inspect a scheduled notification → body is the
  short line, not the paragraph.

### Done when

Expanding a Care card shows the full derived guide (incl. Light, which has no
task); notifications fire with a one-line body; `npm test`/`tsc` green.

---

## Phase 2 — per-plant depth · difficulty 3

Turns the union blob into actual per-plant instruction. Render-side only.

### Tasks

1. **A per-plant care line helper.** New small pure helper (co-locate in
   `care.ts` or a render util) `plantCareLine(plant) → string` (or a structured
   `{ light, moisture, humidity, growth }` for chip rendering) built from
   `plant.light`, `plant.soilMoisture`, `plant.humidityPctRange`,
   `plant.growthRate`. Reuse the existing label helpers (`lightLabel`,
   `moistureLabel`, `humanize` from [src/lib/labels.ts](../../src/lib/labels.ts))
   so wording matches the plant sheet.
2. **Render per-plant block.** Below the build-level guide tips in the expanded
   card, add a "Each plant" section: one row per plant — common name + its care
   line, and its authored `notes` rendered through `<GlossaryText>` (notes already
   carry `[[slug]]` markup and specific care prose). `buildPlants` is already in
   `fetchRows`; carry the resolved `Plant[]` on `CareRow` (or reuse the slugs +
   the `bySlug` map already built in `fetchRows`).
3. The build-level category tips stay as the at-a-glance summary above. Do **not**
   touch `generateCareGuide`'s union logic or the scheduler — depth is additive.

### Test / check

- Unit-test `plantCareLine` for the four condition fields (one plant fixture per
  moisture/light extreme) — small `assert` self-check, no framework.
- Device check: a build mixing a wet/low plant and a dry/bright plant shows
  distinct per-plant lines, not one "mixed" blob.

### Done when

Each plant in a build has its own readable care line + notes in the Care card;
engines unchanged; tests green.

---

## Phase 3 — "last done" history · difficulty 2

Data already persists (completed `care_marks` survive enable/disable). This is a
read + a line of render.

### Tasks

1. **Repo read.** Add `lastDoneForBuild(buildId) → Map<kind, Date>` (or filter
   `listForBuild` for `completedAt != null`, newest per `kind`) to
   `CareRepository`. No schema change.
2. **Carry on the row.** Add `lastDoneByType: Map<CareTaskType, Date>` to
   `CareRow`, populated in `fetchRows`.
3. **Render.** In `TaskEditor`, when a last-done exists, show a muted
   "Last done {relative}" line (reuse the `dueLabel`-style relative formatter
   already in `care.tsx`, generalized to past tense, or add a `doneLabel`).

### Test / check

- `care-repo.test.ts` already exercises `markDone`; add a case asserting
  `lastDoneForBuild` returns the most recent `completedAt` per kind and that it
  survives `disableForBuild`.
- Device check: mark a task done → "Last done just now" appears; toggle reminders
  off and on → the last-done line persists.

### Done when

Each task shows when it was last completed; history survives a reminders off→on
cycle; tests green.

---

## Out of scope (don't gold-plate)

- A full completed-history audit list (one "last done" line is the QOL win).
- A new `/build/[id]/care-guide` route (ADR 0013 §2 keeps it in the Care tab).
- Snapshotting the guide (derive-on-render, per ADR 0013 §1).
- New care categories — fertilizing / algae / pest / seasonal (separate, larger
  effort; see the original recommendation #5).
- Touching the cadence engine, mute, reschedule, or the notification budget guard
  — those are solid.
