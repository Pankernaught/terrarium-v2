# Care depth & surfacing — handoff

Handoff for whoever implements [ADR 0013](../adr/0013-care-guide-surface-and-depth.md)
against the [build plan](../plans/care-depth-build-plan.md). The decisions are
made; this doc is the context to start cold without re-deriving them.

## The ask (verbatim intent)

> Make recommendations for improvements for the care feature. […] My noted pain
> point right now is that it's not in depth per care instruction, but I'm sure
> there is QOL to be done.

Then, after the ranked recommendation list: **do 1+4, then 2, then 3.**

## The one finding that frames everything

`generateCareGuide` ([care.ts](../../src/logic/care.ts)) is the richest care
content in the codebase, and it is rendered on **no screen** and is **not** in the
txt/PDF export. Grep confirms its only callers are
[careSchedule.ts](../../src/logic/careSchedule.ts) (which uses the prose as
notification bodies) and its own test. So:

- "Not in depth" is two problems: the depth that exists is **invisible**, and the
  depth that exists is **shallow** (one sentence per category, all plants
  collapsed via set membership).
- The fix is mostly *rendering data we already compute or already store* — not new
  engines. That's why every phase is difficulty 2–3, render-side.

## DECIDED (don't re-litigate unless you disagree)

- **Guide lives in the Care tab's expanded card, not a new route.** Build Guide
  got its own route (ADR 0009) because it's a one-time work-through checklist; the
  care guide is the ongoing read, and the Care tab is already the per-terrarium
  care home with plants + container resolved. Splitting "what" from "when" across
  two screens was rejected. The "Customize" affordance becomes "Details" so
  readers open it. One tap is fine — the gap is content, not tap depth.
- **Derive-on-render, never snapshot.** Same reasoning as ADR 0009: the guide is
  pure output of saved build data; a stored copy only rots.
- **Notifications get short authored bodies**, decoupled from the guide prose. The
  long text belongs in-app where it can be read; the banner just points you in.
  This is *why* 1 and 4 ship together — surfacing the depth is what makes
  shortening the banner safe.
- **Per-plant depth is additive.** Keep the build-level union tips as the summary;
  add per-plant lines beneath. Do **not** rewrite `generateCareGuide`'s logic or
  change any scheduler input.
- **History is already persisted** — completed `care_marks` rows survive
  enable/disable (`disableForBuild` deletes only pending). Phase 3 is a read +
  one render line, not a schema change. (This corrected the original difficulty-3
  estimate down to 2.)

## OPEN / judgement calls for the implementer

1. **Guide block layout in the expanded card.** ADR fixes *that* it goes at the
   top of the editor; the exact visual (full paragraphs vs. collapsible
   per-category) is yours. Keep the screen calm — it's deliberately the quietest
   screen in the app (see the `care.tsx` header comment).
2. **Per-plant render shape (phase 2).** Prose line vs. condition chips. The plant
   sheet ([plant-sheet.tsx](../../src/components/plant-sheet.tsx) ~284–307) already
   renders Light/Soil/Humidity/Temp/Growth as labeled stats with glossary slugs —
   consider matching that for consistency, or go lighter. Reuse `lightLabel` /
   `moistureLabel` / `humanize` from [labels.ts](../../src/lib/labels.ts).
3. **Last-done copy (phase 3).** "Last done just now / 3 days ago" — generalize the
   existing `dueLabel` relative formatter in `care.tsx` to past tense, or add a
   sibling `doneLabel`.
4. **Where `plantCareLine` lives.** `care.ts` (keep care logic together, stays
   import-pure) vs. a render util next to the card. Either is fine; `care.ts` is
   the tidier home if it stays string-only.

## Code map (the anchors you'll touch)

- **`src/app/care.tsx`** — `CareRow` (~67), `fetchRows` (~87, already resolves
  `container`+`buildPlants`), `resync` (`body: task.body` ~130 → short copy key),
  `CareBuildCard`/`Collapse` (~351/~420, guide block), `TaskEditor` (~445,
  last-done line), "Customize" label (~397).
- **`src/logic/care.ts`** — `generateCareGuide`; candidate home for
  `plantCareLine`.
- **`src/logic/careSchedule.ts`** — `CARE_TASK_LABEL`, `BODY_CATEGORY`,
  `CareTask.body`. Untouched except as the in-app prose source.
- **`src/db/care-repo.ts`** — add `lastDoneForBuild`; `listForBuild` already
  returns history.
- **`src/data/copy.json`** + **`copy.ts`** — add `care.notif.body.<task-type>`
  (templated `{build}`); surfaces in the Plant Admin Copy tab (ADR 0010).
- **`src/components/glossary-text.tsx`** + **`term-sheet.tsx`** — render plant
  `notes` (and any guide markup) with `[[slug]]` linkification; wiring pattern in
  `browse.tsx`.

## Constraints / notes

- **Ponytail active.** Every phase is reuse of existing data/components. No new
  table, migration, route, or dependency. If a phase grows one, stop and
  re-check against ADR 0013's "out of scope" list.
- **AGENTS.md:** read the versioned Expo 56 docs before writing Expo code.
- The pure engines (`care.ts`, `careSchedule.ts`) stay CI-verifiable in the node
  runner — don't make them import `src/db`, `src/data`, or `expo-notifications`.
- Don't touch the cadence engine, mute, reschedule, or the 50-slot notification
  budget guard — they're solid and out of scope.
