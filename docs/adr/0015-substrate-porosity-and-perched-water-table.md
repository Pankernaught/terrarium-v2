---
status: accepted
---

# Substrate stats come from a porosity model with a hidden particle-size axis, and the mixer exposes a perched water table

The substrate mixer ([substrateMixer.ts](../../src/logic/substrateMixer.ts))
rolls a recipe up into four bars (aeration, water retention, nutrients, pH
buffering) as a **parts-weighted linear mean** of the authored property matrix.
Two things that matter most to a beginner are invisible to a linear mean: (1)
mixing a fine material into a coarse one does **not** average their aeration —
the fines fall into the voids between coarse grains and the blend packs *denser*
than either parent ("sand into clay = concrete"); and (2) the same mix waterlogs
a shallow container far worse than a deep one, because the capillary-saturated
zone at the substrate base has a roughly **fixed height** set by pore size,
independent of how deep the substrate is. We will (1) add one **hidden** ordinal
`SIZE_CLASS` (0–4 inter-particle pore size) per component, (2) bend the
aeration/retention roll-up off the linear mean with a **packing correction**
driven by size mismatch, and (3) add `perchedWaterTable(mix, substrateDepthCm)`
exposing the saturated-zone height and its fraction of the substrate depth.

This revises the roll-up math of [ADR 0003 / the substrate mixer] but keeps every
public contract: `mixSubstrate` still returns the same `MixStats` 0–1 shape, a
uniform-size recipe is the *exact* old linear mean, and the four bars are
unchanged in number and meaning. `SIZE_CLASS` is deliberately **not** a fifth bar
— the dropped `particleSize` was removed as a bar for good reason (a beginner
can't act on "2.3 mm"); it lives on only as the internal variable behind the two
corrections.

## Context

The matrix values are authored, provisional, and explicitly "not science" — a
coarse ordinal ranking meant only to make the bars move sensibly. The linear
mean was the honest first cut, but it is *qualitatively* wrong on the one effect
every grower knows: a drainage amendment helps sub-linearly, with a worst-packing
dip near a balanced fine/coarse split. And the four bars never coupled to the
container at all, even though the build already persists `substrateDepth`
([draft.ts](../../src/components/planner/draft.ts), schema `substrate_depth`).

The deeper "fully physical" model (porosity split into macro/micropores, a water-
release curve, CEC vs nutrient content, pH setpoint, decomposition over time) was
considered and rejected as **precision a beginner can't act on** — it stops paying
rent at the bar level. We keep the authored matrix as the single-component
endpoints and add only the two corrections that change the *advice*.

## Decision

1. **`SIZE_CLASS` (hidden, 0–4)** in `substrate-matrix.ts`, keyed by the same
   frozen ids as the property matrix; a drift-guard test keeps the two maps in
   lockstep. It correctly separates *internal* water-holding (vermiculite, pumice,
   akadama — high retention, but they drain freely *between* grains) from
   *perched* height (clay/peat powder — fine inter-particle pores, tall saturated
   base).

2. **Packing correction** in `mixSubstrate`: compute the parts-weighted ordinal
   means, then a `mismatch ∈ [0,1]` = `spread · 4·f·(1−f)` (size range × how
   balanced the fine/coarse split is — the binary-packing intuition as a symmetric
   parabola). Aeration is cut by `0.5·mismatch`; the lost macropore volume becomes
   held water (`+0.5·mismatch` of the remaining retention headroom). A single
   component or a uniform-size blend has `mismatch 0` → the unchanged linear mean.
   Nutrient and buffering still blend linearly.

3. **`perchedWaterTable(mix, depthCm)`** returns `perchedHeightCm`
   (`1 + 6·(1 − meanSize/4)`, ~1 cm chunky … 7 cm powder) and `saturatedFraction`
   (`perchedHeightCm / depthCm`, clamped 0–1). It stays import-pure — depth is a
   plain number argument, no `src/db`/`src/data` edge.

The constants (`0.5` loss/gain, the `1 + 6·…` height, the size-class values) are
**authored and provisional**, same status as the matrix — the calibration knobs.
The `4·f·(1−f)` peak sits at 50/50; the real Furnas optimum is ~30% fine, left as
a documented upgrade path.

## Consequences

- The four bars now move *non-linearly* and read moister for a clogged blend —
  e.g. the documented `2 coco-coir : 1 perlite : 1 sphagnum` mix flips from
  "airy, moisture-retentive" to "moisture-retentive, airy". Existing pinned mixer
  tests were updated to the corrected values.
- `perchedWaterTable` is exported and CI-tested but **not yet surfaced** in the
  build guide. The guide already has `substrateDepth` + the mix at the substrate
  step ([guide.ts](../../src/logic/guide.ts)), so the follow-up is a copy-catalog
  warning line ("Saturated base: ~X cm of Y cm — roots may sit in water"), plus the
  counterintuitive note that a coarse drainage layer *raises* this zone rather than
  draining it. Held back so the numbers can be eyeballed on real builds first.
- No persistence or schema change; no new dependency.
