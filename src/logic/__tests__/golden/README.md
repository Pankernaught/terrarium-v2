# Golden fixtures — M0 characterization harness

Frozen **observed** behavior of the nine retained engine families (M0 runbook §4,
`deliverables/migration/M0-preserve-characterize.md`). These are characterization
tests: they assert what the code *does* at the M0 baseline, not what it should do.
M1's extraction — and every later phase — proves "zero behavior change" by passing
this suite with the fixtures **byte-identical**.

## Layout

| File | Role |
|---|---|
| `catalog.snapshot.json` | Frozen copy of `src/data/plants.json` at capture time (2026-07-11). Scenarios resolve slugs against **this**, never the live catalog. |
| `scenarios.ts` | The deterministic input matrix (runbook §4.2 + `micro-sealed-gas`), pinned dates, frozen substrate-component labels. |
| `golden.test.ts` | For each engine family × scenario: run the entry point, `JSON.parse(JSON.stringify(actual))`, deep-equal against the fixture. |
| `fixtures/<family>.json` | Captured outputs, one file per engine family, keyed by capture id. Plain JSON so diffs are reviewable and the files survive the M1 moves as data. |

## Hermeticity — what is frozen, and what deliberately is not

- **Frozen:** the plant catalog (`catalog.snapshot.json`), substrate-component
  labels (`FROZEN_COMPONENT_LABELS` in `scenarios.ts`), every date/instant
  (`buildCareSchedule` always receives `now` explicitly), and the backup seed rows
  (pinned ids + timestamps — no `newId()`, no repos, no real clock). The one
  non-deterministic engine field, `exportBackup().exportedAt`, is normalized to
  `"NORMALIZED"` before compare.
- **Deliberately NOT frozen: `copy.json`.** Engine outputs embed `copy()` strings
  by design (ADR 0010 — prose is admin-editable data). A copy edit therefore
  legitimately moves these fixtures: that is characterization working, not a bug.
  When it happens, regenerate under the policy below and review the diff — it must
  touch only prose, never numbers/shapes.
- **Thrown errors are fixtures too.** Engines that throw (`checkGroup([])`,
  malformed geometry through `scoreBuild`, the migrate ladder's refuse-newer and
  missing-step messages) have their exact messages pinned.

## Running

The suite runs with the normal test run (`npm run test:run`) — assert mode.

## Regeneration policy (ADR 0029)

`UPDATE_GOLDEN=1` was legitimate exactly once — the M0 capture. Afterward, any
regeneration is a **recorded decision** (an ADR or a plan-cited commit naming which
behavior changed and why). M1 must pass with fixtures **unchanged**. The first
intended regeneration point is M4's slug→profileId re-key.

To regenerate (no package.json edit — deliberate; the script surface is outside
the M0 commit set):

```bash
UPDATE_GOLDEN=1 npx vitest run src/logic/__tests__/golden/golden.test.ts
```

Then re-run `npm run test:run` twice — green twice consecutively is the
determinism check (runbook R5 exit).

## Scenario discipline

The §4.2 minimum set (the 14 ids + `micro-sealed-gas`) must never shrink or be
renamed — fixture keys are stable contract ids. Adding scenarios is allowed and
additive: new keys appear in the fixture files on the next recorded regeneration.
