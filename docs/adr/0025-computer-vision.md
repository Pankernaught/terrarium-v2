---
status: proposed
---

# Computer-vision plant ID produces candidate suggestions only, behind a benchmark gate that fails safe

"Point your camera at a plant and it's identified" is an obvious feature and an
obvious trap. Master plan App. B (computer vision) weighs its appeal against the cost
of being confidently wrong: a misidentification that flows into care advice can kill
a plant or mislead a beginner who trusted the badge.

**Decision.** CV is **suggestion-only**: it returns a ranked list of **candidate**
matches the user confirms, never an authoritative identification, and it never
silently seeds care data. It ships **only behind a benchmark gate** evaluated at
milestone M5 — if accuracy on our own test set doesn't clear the bar, the **feature
gate stays off** and the app degrades to manual selection. Fail-safe is the default
state, not the fallback.

**Consequences.** CV is a convenience layer over the catalog, not a data pipeline
into it (consistent with ADR 0023 — care data is curated, not inferred). Access is
itself uncertain: the R9 spike's job is to **report** what iNaturalist's
`computervision/score_image` actually requires (auth, approval, cost) rather than
assume it — an inaccessible endpoint is an M3/M5 design input, recorded in
`inat-spike-findings.md` (ADR 0029). Because the gate can hold the feature off, no
downstream milestone may hard-depend on CV being present.
