---
status: proposed
---

# External taxonomy comes through a provider adapter; an external id is a reference, never the primary key

The rebuild's strategic seam is that an external service (iNaturalist and peers)
supplies plant *identity* while our own engine supplies the *care/compatibility
moat*. Master plan App. B (external taxonomy) asks how tightly to bind to a provider.
Making an iNat/POWO id the internal primary key would look convenient and would weld
the whole catalog to one vendor's id space and uptime.

**Decision.** All external taxonomy is reached through a **provider adapter** — a
single boundary that maps a provider's response into our own plant model. An
**external id (iNat taxon id, POWO id, GBIF key) is stored as a reference field,
never as the internal primary key.** Our slug/profile id remains the catalog's own
key (its reforge is master plan Open Q A1 / milestone M4); external ids hang off it,
possibly several per record, possibly none.

**Consequences.** Swapping or adding a taxonomy provider is an adapter change, not a
schema migration. The R9 iNat spike (ADR 0029, `deliverables/m0-baseline/inat-spike-findings.md`)
is the first probe of what one such adapter must handle — name resolution hit rate,
ambiguity, cultivar handling. The M4 reconciliation uses `corpus-201.csv` as ground
truth to attach external ids to existing slugs without renumbering. Care data does
**not** come through this adapter (ADR 0023 keeps it sourced + curated).
