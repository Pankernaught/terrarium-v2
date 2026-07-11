---
status: proposed
---

# Launch category is botanical terrariums, with fauna modelled but disabled at launch

The rebuild has to fix its scope: which of the closed-ecosystem hobby it serves at
v-next launch, and how much of the adjacent bioactive/vivarium world it leaves room
for. Master plan App. B (launch category) frames the trade-off — a narrow botanical
focus ships sooner and keeps the care/compatibility model honest, but hard-coding
"plants only" would force a schema fork the first time isopods matter.

**Decision.** Launch covers **botanical terrariums, mosses, fungi, springtails, and
isopods.** Animal/fauna types beyond the clean-up crew are **modelled in the domain
but disabled at launch** behind the category hooks described in master plan §6.3 —
the data shape and the compatibility seams exist, the UI and catalog entries do not
ship. This keeps the launch surface a plant-first app while making the eventual
vivarium expansion an unlock, not a migration.

**Consequences.** The plant schema and compatibility engine stay the authority for
v-next; fauna care rules are a later milestone, not launch scope. The category hooks
must be real enough that adding isopod care later needs no schema break — verified
against the golden fixtures (ADR 0029), which freeze the plant-only engine outputs
this decision commits to. No marketplace or livestock trade is implied here (that is
ADR 0027's deferral).
