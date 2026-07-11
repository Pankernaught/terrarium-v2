---
status: proposed
---

# Backend shape: a typed BFF + managed DB + object storage + durable jobs — built when Phase 4 needs it

The rebuild will eventually need a server (community, sync, media at scale), and
master plan App. B (backend) asks what that server should be. The risk is building it
too early: a backend erected before there is traffic or a shared-state feature to
justify it becomes dead weight the local-first client (ADR 0020) has to route
around.

**Decision.** When a server is warranted, its shape is a **typed backend-for-frontend
(BFF)** over a **managed relational database**, **object storage** for media, and a
**durable job runner** for async work (notifications fan-out, CV, feed building).
Crucially, this is built **when Phase 4 (milestone M11) actually needs it — not
before.** The go/no-go and the concrete provider choices are **gated on master plan
§14/C1 (backend)**, an owner decision recorded here as *pending*.

**Consequences.** Milestones before M11 must not assume a server exists; the
local-first store (ADR 0020) carries durability until then. Because the client is
local-first and the taxonomy adapter (ADR 0022) keeps external ids as references, the
backend can be introduced additively without a client rewrite. Provider lock-in
(which managed DB, which object store) is deliberately left open until §14/C1 — this
ADR fixes the *architecture*, not the vendor.
