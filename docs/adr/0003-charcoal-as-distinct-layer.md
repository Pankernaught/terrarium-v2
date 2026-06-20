# Charcoal modelled as a distinct layer, not a SubstrateMix component

Horticultural charcoal is almost always used as a thin discrete filtration layer between drainage and substrate — not blended into the growing medium. Treating it as a `SubstrateMix` component would misrepresent how it's physically used, break the cross-section's layer-stack rendering (it needs its own visual band), and conflate the "how much charcoal is in the mix" question with the "is there a charcoal layer" question.

`charcoalDepth: number | null` is added to `PlannerDraft` alongside `drainageDepth` and `substrateDepth`. The substrate step exposes it as a simple toggle with a fixed default depth (~1.5 cm). Charcoal is excluded from `SUBSTRATE_COMPONENTS`.
