---
status: proposed
---

# Community launches as structured build snapshots + diagnosis templates, before any generic feed

Community is where the app either compounds or rots. Master plan App. B (community)
contrasts the default — a generic social feed — with a structured approach. A generic
feed is cheap to build and expensive to keep good: it invites low-signal posting,
needs heavy moderation immediately, and buries the one thing this audience actually
wants, which is "here's my build / here's what's wrong with it, help."

**Decision.** Community launches as **structured build snapshots** (a shareable,
schema-backed representation of a build — its container, plants, score, and verdict)
and **diagnosis templates** (a guided "what's wrong" post that captures the symptoms
the care engine reasons about). A **generic free-form feed is explicitly deferred**
until those structured surfaces prove the audience and the moderation load is
understood.

**Consequences.** The shareable unit is a *build*, not a *status update* — which is
why builds are already modelled as self-contained, exportable objects (the TXT/PDF
export and its byte-exact summary are frozen in the golden fixtures, ADR 0029). This
structure also gives moderation and search real fields to work with instead of free
text. It depends on the backend (ADR 0021, gated on §14/C1) for the shared surface;
until then, export/share is the offline-friendly precursor. Marketplace is a separate,
later deferral (ADR 0027).
