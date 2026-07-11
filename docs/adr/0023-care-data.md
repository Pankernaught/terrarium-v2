---
status: proposed
---

# Care data is sourced trait assertions + versioned rules — never derived from occurrence records

Our differentiator is trustworthy care and compatibility advice. Master plan App. B
(care data) warns against the seductive shortcut of *deriving* care requirements from
crowd-sourced occurrence data — "it's observed growing where it's humid, so infer
humid." Occurrence data records where a plant *was seen*, not where it *thrives*, and
laundering it into care advice would give confident, unfalsifiable, and sometimes
lethal guidance.

**Decision.** Care data is a set of **sourced trait assertions** (each value carries
its provenance) fed through **explicitly versioned care rules**. It is **never
computed from occurrence/observation aggregates.** The compatibility, care, and
substrate engines read curated traits and authored rule constants — exactly the
shape the current `plants.json` + engine constants already take — with sources
attached per record (the corpus already tracks `sources`; see `corpus-201.csv`).

**Consequences.** iNaturalist and similar (ADR 0022) supply **identity and imagery**,
not care values; the observations histogram the R9 spike measures is a *display/
popularity* signal at most, never a care input. Rule changes are versioned so a
care-advice shift is traceable to a rule edit, not silent data drift. The golden
fixtures (ADR 0029) freeze today's rule outputs; changing a care rule is a recorded
regeneration, not an accident. Authored trait sparsity is real and acknowledged
(toxicity 78/201, plantType 200/201 — App. B rows A5/A6) — blank is "unauthored,"
never a claim.
