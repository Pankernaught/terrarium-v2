---
status: proposed
---

# Legacy code is handled extraction-first; nothing is deleted until migration + vertical-slice gates pass

The rebuild carries a large existing codebase, and master plan App. B (legacy code)
plus §9 (the First-PR boundary) set the disposition. The tempting move — delete the
old and write the new in parallel — loses the behavior encoded in the old code the
moment it's gone, with no oracle to check the replacement against.

**Decision.** Legacy code is handled **extraction-first**: the retained engines are
lifted into the clean-room `src/logic` / `src/db` layers, characterized, and proven
equivalent **before** anything is removed. **Deletion happens last** — only after the
migration lands *and* the vertical-slice gates at milestones M9/M10 pass. This is the
"bridge-first, delete-last" tenet the whole ladder is built on.

**Consequences.** The golden fixtures (ADR 0029) are the extraction oracle: M1's
extraction must pass them **unchanged**, which is what makes "we moved code without
changing behavior" a checkable claim rather than a hope. The First-PR boundary is in
force for all of M0 — **no deletion, no refactor, no new UI, no algorithm change** —
so the baseline stays a true baseline. The in-flight vibes/canopy work is a live
instance of "don't delete yet": its keep-vs-abandon call (App. B row B2) is queued for
the owner before M10, both options preserved by the M0 snapshot (ADR 0029).
