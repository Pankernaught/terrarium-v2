---
status: accepted
---

# The care guide gets an in-app home, notifications carry short bodies, and care depth moves per-plant

`generateCareGuide` ([care.ts](../../src/logic/care.ts)) is the richest care
content in the app, and **nothing renders it** — it is referenced only by the
scheduler ([careSchedule.ts](../../src/logic/careSchedule.ts)), which crams the
full prose into push-notification bodies. We will (1) surface the derived guide
in the Care tab, (2) replace the long notification body with a short authored
line per task, (3) deepen the guide from a per-build union blob to per-plant
instructions, and (4) read the already-persisted completed `care_marks` rows to
show a "last done" history. Derive-on-render throughout — nothing new is stored
except what already exists.

## Context

The care feature is two halves that don't meet:

- **`care.ts` / `generateCareGuide`** emits four prose tips — Watering, Humidity,
  Light, Trimming — derived from the build's plants + container. It is rendered
  on **no screen** and is **not** in the txt/PDF export
  ([export.ts](../../src/lib/export.ts)). Confirmed: its only callers are
  `careSchedule.ts` and its own test.
- **The Care tab** ([care.tsx](../../src/app/care.tsx)) is a *reminder
  scheduler* — per-build cards, three task types, cadence steppers, mute,
  mark-done, and a 50-slot notification budget guard. It is well built and
  not the subject of this ADR.

The owner's stated pain point: care is "not in depth per care instruction." Two
distinct problems sit under that:

1. **The depth that exists is invisible.** You cannot read "how do I water this"
   on demand anywhere; you wait for a notification, which truncates the prose.
2. **The depth is shallow by construction.** `generateCareGuide` collapses every
   plant into **one sentence per category** via set-membership branching
   (`moistures.has('wet') && moistures.size === 1`, etc.). A wet moss beside a
   dry succulent yields a single "mixed moisture needs detected" blob. The
   per-plant data (`light`, `soilMoisture`, `humidityPctRange`, `growthRate`,
   plus authored `notes`) already lives on every `Plant` and is thrown away in
   the aggregate.

Two enabling facts make the fix cheap and shape these decisions:

- The Care tab's `fetchRows` **already resolves** `container` and `buildPlants`
  per row ([care.tsx:94-97](../../src/app/care.tsx)) — the exact inputs
  `generateCareGuide` needs. Surfacing the guide costs one more call, no new
  data path.
- Completed occurrences **already persist**. `markDone` stamps `completedAt`
  and inserts the next pending row; `disableForBuild` deletes only *pending*
  rows (`completedAt IS NULL`), and `listForBuild` already returns the full
  history ([care-repo.ts](../../src/db/care-repo.ts)). So "last done" is a read
  of data we keep but never show — no schema change, no migration.

## Decision

1. **The care guide is surfaced in the Care tab's expanded card, derived live.**
   `generateCareGuide(buildPlants, container)` is computed in `fetchRows` and
   stashed on `CareRow`; the expanded card renders it as a read-only "What to do"
   block above the cadence editor. We reject a stored snapshot for the same
   reason ADR 0009 rejected one for the Build Guide: the guide is pure output of
   saved build data, so freezing it only invents a stale column and a
   "regenerate" affordance. Editing the build re-derives its guide — correct.

2. **The Care tab is the guide's home — not a new `/build/[id]/care-guide`
   route.** Build Guide earned its own route (ADR 0009) because it is a *one-time
   physical-assembly checklist* you work through phone-in-hand, away from Build
   Detail's scroll. The care guide is the *ongoing* read you return to, and the
   Care tab is already the per-terrarium care home with the plants/container
   resolved. A second route would split "what to do" (Build Detail) from "when to
   do it" (Care tab). The expanded card already exists; the affordance label
   moves from "Customize" to "Details" so a reader — not just a tweaker — opens
   it. One tap is acceptable; the pain point is absent content, not tap depth.

3. **Notifications carry a short authored body, decoupled from the guide prose.**
   The scheduler stops reusing `task.body` (the full multi-sentence tip) as the
   push body. New authored copy keys (`care.notif.body.<task-type>`) give each
   reminder a single glanceable line ("Check moisture on {build}"); the long
   prose stays in the in-app guide where there is room for it. The notification
   *title* already reads `{task label} · {build}` and is unchanged. This is the
   decision that makes #1 worth doing: depth belongs where it can be read, not in
   a truncated banner.

4. **Care depth moves per-plant, augmenting (not replacing) the build summary.**
   The expanded guide gains a per-plant line for each plant in the build, drawn
   from that plant's own `light` / `soilMoisture` / `humidityPctRange` /
   `growthRate` and its authored `notes` (which already carry specific,
   glossary-linked care prose). The build-level category tips stay as the
   at-a-glance summary; the per-plant lines are the depth. We keep the existing
   union logic rather than rewrite it — the blob is demoted to a summary, not
   deleted, so no scheduler input changes.

5. **"Last done" history is read from existing completed rows.** The Care tab
   reads each task's most recent `completedAt` (already in `care_marks`) and
   shows a "Last done {relative}" line per task. No new column, no migration; a
   thin repo read (`lastDoneForBuild` or a filter over `listForBuild`) and a
   render. The full history list is out of scope — one "last done" line is the
   QOL win; an audit log can come later if asked.

## Consequences

- **`care.tsx`** gains a `generateCareGuide` call in `fetchRows`, a `guide` (and
  later `lastDoneByType`) field on `CareRow`, a guide-prose block + per-plant
  lines in the expanded card, and the "Customize" → "Details" relabel. The
  scheduler's `resync` swaps `body: task.body` for the short copy key.
- **`care.ts` / `careSchedule.ts`** are otherwise untouched: `generateCareGuide`
  keeps emitting the same `CareTip[]` (now also rendered, not only embedded), and
  `BODY_CATEGORY`/`CareTask.body` stay as the in-app prose source. The per-plant
  depth (#2) is a new render-side helper, not a change to the pure engines'
  contracts — they stay CI-verifiable in the node runner.
- **`src/data/copy.json`** gains `care.notif.body.watering-inspection`,
  `…lid-opening`, `…trimming` (templated with `{build}`), which surface
  automatically in the Plant Admin Copy tab (ADR 0010). The old generic
  `care.notif.body` stays as the scheduler fallback.
- **Care reading and care scheduling now live on the same screen** — a
  deliberate consolidation. If the Care tab later feels overloaded, splitting the
  read into a Build Detail section is reversible (the guide is derived, so it can
  be rendered from either place with no data move).
- **Lost nicety:** the notification no longer contains the full instruction.
  Acceptable and intended — the banner points you into the app, where the depth
  now lives.
