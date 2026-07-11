---
status: proposed
---

# Local-first: SQLite + an outbox; the server is authoritative only for shared/public state

A terrarium planner is used in sheds, greenhouses, and plant shops — places with no
signal. Master plan App. B (offline strategy) weighs a cloud-first design (simpler
consistency, useless offline) against local-first (works anywhere, needs a sync
story). The current app is already an on-device SQLite store with no backend, so the
question is really which invariants a future server may *ever* override.

**Decision.** The client is **local-first**: the on-device **SQLite** store is the
source of truth for a user's own builds, and mutations that must reach a server are
queued through an **outbox** and replayed when connectivity returns. A server is
**authoritative only for genuinely shared or public state** — community posts,
moderation, public policy — never for a user's private build data. The precise depth
of the offline guarantee is **gated on master plan §14/C2 (offline depth)**, an
owner decision this ADR records as *pending* rather than pre-empting.

**Consequences.** Every feature must have a coherent offline story; "requires
network" is a design smell for anything touching a user's own builds. The backup
payload + migrate ladder (ADR 0029 freezes their current behavior) are the local
durability mechanism until sync exists. This ADR sets the *shape* (local-first +
outbox) but defers the *depth* (conflict resolution, partial sync) to the §14/C2
resolution — see also ADR 0021 (backend), which only lands when §14/C1 resolves.
