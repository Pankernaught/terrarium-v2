---
status: proposed
---

# The M0 demolition baseline: what the recovery points protect, and the golden-fixture regeneration policy

Milestone M0 makes the current app losslessly recoverable before any migration moves
or deletes code (master plan §3 demolition baseline, §9 First-PR boundary, App. C
Phase 0). This ADR records *what* the M0 preservation artifacts are and the rules
that govern the one code artifact M0 produces — the golden fixtures — so a later
session doesn't have to reverse-engineer them from git. Full execution evidence
(hashes, counts, commands) lives in `deliverables/m0-baseline/BASELINE.md`; this ADR
is the durable decision record.

## The two protected recovery points

- **`baseline/pre-migration` → `49f834f`** — the last *committed, suite-green* state
  ("the current app" as git history knows it). This is the tag M1+ extraction is
  measured against.
- **`baseline/worktree-2026-07-11` → `2f16517`** (branch `m0/worktree-snapshot`) —
  the *actual machine state* including the owner's in-flight, uncommitted vibes/canopy
  work, `plants.json` edits, the image-sourcing scrape, and the `deliverables/`
  folder. A snapshot branch that is never intended to merge, so the ~70 MB of scrape
  weight stays out of `main`'s history while nothing is lost.

Both tags are pushed to origin. Two filesystem archives back them in a second
failure domain: the **R2 tar** (`terrarium-v2-m0-archive-2026-07-11.tar.gz`, 165 MB,
includes `.git` + all ignored-but-real files, sha256 sidecar) and the **R4 JS
bundle** tar. **Owner action, still pending:** move both offsite and record the
destination in BASELINE.md.

## Decisions recorded here

1. **R1 snapshot scope = full scrape in git.** `git add -A` under a temporary index
   staged the Facebook scrape + loose PNGs (~70 MB one-time push) — the runbook's
   *default* lossless scope, deliberately chosen over the tar-only fallback so the
   snapshot branch is self-contained. The temp-index route left HEAD, the real index,
   and the working tree byte-identical (verified before/after).
2. **The `Skill docs/` anomaly is resolved, not a deviation.** It shows `!!` in
   `git status --ignored` only because *everything inside it* is an ignored
   `.DS_Store`; there is no valuable content, so `git add -f "Skill docs"` was
   correctly skipped. The R2 tar carries it regardless.
3. **Golden-fixture regeneration policy.** The suite in
   `src/logic/__tests__/golden/` is hermetic — a frozen catalog snapshot, pinned
   dates, injected labels, `exportBackup.exportedAt` normalized. `UPDATE_GOLDEN=1`
   was legitimate **exactly once**, at M0 capture. Afterward, **any regeneration is a
   recorded decision** (an ADR or a plan-cited commit naming which behavior changed
   and why); **M1 must pass with the fixtures byte-unchanged.** The first *intended*
   regeneration point is M4's slug→profileId re-key (Open Q A1). **`copy.json` is
   deliberately not frozen** — engine outputs embed `copy()` strings by design (ADR
   0010), so a prose edit legitimately moves fixtures; that is characterization
   working. Thrown-error messages are part of the frozen contract.

## Queued for the owner (does not block M0)

- **In-flight vibes/canopy work — keep vs abandon (App. B row B2).** Both options are
  preserved on the M0 snapshot. The decision is owed **before milestone M10** (the
  legacy-retirement gate). Until then, the owner should pause further vibes/canopy
  edits, or R1 is cheaply re-run before M0's close-out (a moving tree invalidates the
  snapshot's "current state" claim).

## Noted, not decided here

- **ADR 0007 status/body mismatch (Open Q B1).** ADR 0007 is mid-edit in the working
  tree; its front-matter status and body disagree. This ADR only **notes** the fact —
  it does not edit 0007 (which is captured by the snapshot). Reconciling it belongs to
  M1/M4.
- **Supersession records (App. B row B3).** The 0016←0017 supersession and the 0007
  status question are **M1/M4's** to file; 0029 records only that they exist, per the
  conceptual outline's assignment.
