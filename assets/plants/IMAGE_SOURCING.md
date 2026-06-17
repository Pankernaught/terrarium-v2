# Plant image sourcing worklist

> **Status:** scaffolding only. Every plant currently ships a *stylized placeholder*
> (`assets/plants/_placeholders/<slug>.svg`) — clearly marked, never a reference
> photo (decision 18). The table below is the human curation worklist for replacing
> those placeholders with real, accurately-identified photographs.

## Why accuracy is the whole game

A wrong species **corrupts trust** in the entire plant library: a user who spots one
misidentified photo stops believing any of them. So this pass is *accuracy-first* —
it is better to leave a placeholder than to ship a confident, wrong photo. When in
doubt about an ID, leave the row `Pending`.

## Sourcing rules

- **Wikimedia Commons is the primary source.** Prefer images already curated there;
  fall back to other reputable, clearly-licensed sources only when Commons has no
  accurately-identified image.
- **License preference (best first):**
  1. **CC0 / Public Domain** (PD, PD-US, no rights reserved)
  2. **CC-BY** (attribution required)
  3. **CC-BY-SA** (attribution + share-alike)
- **Never allowed:**
  - **`-NC` / NonCommercial** — incompatible with the app.
  - **`-ND` / NoDerivatives** — we crop every image to a uniform 4:3 card, and a
    uniform crop is a **derivative**, so `-ND` licenses are out.
- **Always record provenance.** A real photo without a verifiable source/license is
  not usable — leave the row `Pending` rather than guessing.

## How to land a real photo

When a correctly-identified, correctly-licensed photo is found for a plant:

1. Crop/export it to the uniform card and drop it at **`assets/plants/<slug>.png`**
   (the exact path each plant's `image` field already points to — `plants/<slug>.png`).
2. On that plant's record in **`src/data/plants.json`**, fill the two seed-only
   fields:
   - **`imageCredit`** — a non-empty attribution string (photographer + source).
   - **`imageLicense`** — the license id (e.g. `CC0`, `CC-BY-4.0`, `CC-BY-SA-4.0`).
   > These two fields are **seed-only**: they stay in `plants.json` for attribution
   > and **must never enter the export / backup payload** (decision 17/18). Do not
   > invent either value — a missing credit/license means the photo is not ready.
3. Flip the row's **Status** below from `Pending` to `Done` (note the license used).

The image invariants test (`src/data/__tests__/images.test.ts`) enforces the
machine-checkable half of these rules: slug-consistent paths, a placeholder for every
plant, credit-required-with-CC-BY, and no `-NC`/`-ND` licenses.

## Worklist (67 plants)

| Slug | Scientific name | Common name | Target asset | Status |
| --- | --- | --- | --- | --- |
| `fittonia-albivenis` | *Fittonia albivenis* | Nerve Plant | `plants/fittonia-albivenis.png` | Pending |
| `selaginella-uncinata` | *Selaginella uncinata* | Rainbow Moss | `plants/selaginella-uncinata.png` | Pending |
| `taxiphyllum-barbieri` | *Taxiphyllum barbieri* | Java Moss | `plants/taxiphyllum-barbieri.png` | Pending |
| `soleirolia-soleirolii` | *Soleirolia soleirolii* | Baby Tears | `plants/soleirolia-soleirolii.png` | Pending |
| `pellionia-repens` | *Pellionia repens* | Trailing Watermelon Begonia | `plants/pellionia-repens.png` | Pending |
| `maranta-leuconeura` | *Maranta leuconeura* | Prayer Plant | `plants/maranta-leuconeura.png` | Pending |
| `calathea-ornata` | *Calathea ornata* | Pinstripe Calathea | `plants/calathea-ornata.png` | Pending |
| `hypoestes-phyllostachya` | *Hypoestes phyllostachya* | Polka Dot Plant | `plants/hypoestes-phyllostachya.png` | Pending |
| `adiantum-raddianum` | *Adiantum raddianum* | Maidenhair Fern | `plants/adiantum-raddianum.png` | Pending |
| `asplenium-nidus` | *Asplenium nidus* | Bird's Nest Fern | `plants/asplenium-nidus.png` | Pending |
| `pilea-involucrata` | *Pilea involucrata* | Friendship Plant | `plants/pilea-involucrata.png` | Pending |
| `microsorum-pteropus` | *Microsorum pteropus* | Java Fern | `plants/microsorum-pteropus.png` | Pending |
| `episcia-cupreata` | *Episcia cupreata* | Flame Violet | `plants/episcia-cupreata.png` | Pending |
| `philodendron-hederaceum-mini` | *Philodendron hederaceum* | Heartleaf Philodendron (mini) | `plants/philodendron-hederaceum-mini.png` | Pending |
| `miniature-orchid` | *Lepanthes telipogoniflora* | Miniature Orchid | `plants/miniature-orchid.png` | Pending |
| `peperomia-caperata` | *Peperomia caperata* | Emerald Ripple Peperomia | `plants/peperomia-caperata.png` | Pending |
| `peperomia-rotundifolia` | *Peperomia rotundifolia* | Trailing Jade | `plants/peperomia-rotundifolia.png` | Pending |
| `cryptanthus-bivittatus` | *Cryptanthus bivittatus* | Earth Star Bromeliad | `plants/cryptanthus-bivittatus.png` | Pending |
| `ophiopogon-japonicus-mini` | *Ophiopogon japonicus 'Nana'* | Dwarf Mondo Grass | `plants/ophiopogon-japonicus-mini.png` | Pending |
| `syngonium-podophyllum-mini` | *Syngonium podophyllum* | Arrowhead Plant (mini) | `plants/syngonium-podophyllum-mini.png` | Pending |
| `pilea-nummulariifolia` | *Pilea nummulariifolia* | Creeping Charlie | `plants/pilea-nummulariifolia.png` | Pending |
| `begonia-rex` | *Begonia rex-cultorum* | Rex Begonia | `plants/begonia-rex.png` | Pending |
| `haworthia-attenuata` | *Haworthia attenuata* | Zebra Haworthia | `plants/haworthia-attenuata.png` | Pending |
| `echeveria-elegans` | *Echeveria elegans* | Mexican Snowball | `plants/echeveria-elegans.png` | Pending |
| `sedum-rubrotinctum` | *Sedum rubrotinctum* | Jelly Bean Plant | `plants/sedum-rubrotinctum.png` | Pending |
| `crassula-ovata-mini` | *Crassula ovata (dwarf cultivar)* | Mini Jade Plant | `plants/crassula-ovata-mini.png` | Pending |
| `pilea-peperomioides` | *Pilea peperomioides* | Chinese Money Plant | `plants/pilea-peperomioides.png` | Pending |
| `tradescantia-fluminensis` | *Tradescantia fluminensis* | Wandering Dude | `plants/tradescantia-fluminensis.png` | Pending |
| `leucobryum-glaucum` | *Leucobryum glaucum* | Cushion Moss | `plants/leucobryum-glaucum.png` | Pending |
| `fissidens-fontanus` | *Fissidens fontanus* | Pocket Moss | `plants/fissidens-fontanus.png` | Pending |
| `davallia-fejeensis` | *Davallia fejeensis* | Rabbit's Foot Fern | `plants/davallia-fejeensis.png` | Pending |
| `asplenium-bulbiferum` | *Asplenium bulbiferum* | Mother Spleenwort | `plants/asplenium-bulbiferum.png` | Pending |
| `peperomia-argyreia` | *Peperomia argyreia* | Watermelon Peperomia | `plants/peperomia-argyreia.png` | Pending |
| `peperomia-obtusifolia` | *Peperomia obtusifolia* | Baby Rubber Plant | `plants/peperomia-obtusifolia.png` | Pending |
| `bucephalandra-sp-mini` | *Bucephalandra sp.* | Mini Bucephalandra | `plants/bucephalandra-sp-mini.png` | Pending |
| `anubias-nana-petite` | *Anubias barteri var. nana 'Petite'* | Anubias Petite | `plants/anubias-nana-petite.png` | Pending |
| `hydrocotyle-tripartita` | *Hydrocotyle tripartita* | Dwarf Pennywort | `plants/hydrocotyle-tripartita.png` | Pending |
| `pilea-glauca` | *Pilea glauca* | Silver Sparkle Pilea | `plants/pilea-glauca.png` | Pending |
| `epipremnum-pinnatum-mini` | *Epipremnum pinnatum* | Miniature Pothos | `plants/epipremnum-pinnatum-mini.png` | Pending |
| `ludwigia-repens` | *Ludwigia repens* | Creeping Primrose-Willow | `plants/ludwigia-repens.png` | Pending |
| `vesicularia-dubyana` | *Vesicularia dubyana* | Christmas Moss | `plants/vesicularia-dubyana.png` | Pending |
| `soleirolia-soleirolii-minor` | *Soleirolia soleirolii 'Minor'* | Miniature Baby Tears | `plants/soleirolia-soleirolii-minor.png` | Pending |
| `rhipsalis-baccifera` | *Rhipsalis baccifera* | Mistletoe Cactus | `plants/rhipsalis-baccifera.png` | Pending |
| `drosera-capensis` | *Drosera capensis* | Cape Sundew | `plants/drosera-capensis.png` | Pending |
| `nepenthes-ventricosa` | *Nepenthes ventricosa* | Tropical Pitcher Plant | `plants/nepenthes-ventricosa.png` | Pending |
| `pinguicula-moranensis` | *Pinguicula moranensis* | Mexican Butterwort | `plants/pinguicula-moranensis.png` | Pending |
| `nephrolepis-duffii` | *Nephrolepis cordifolia 'Duffii'* | Lemon Button Fern | `plants/nephrolepis-duffii.png` | Pending |
| `pteris-cretica` | *Pteris cretica* | Silver Lace Fern | `plants/pteris-cretica.png` | Pending |
| `microsorum-musifolium` | *Microsorum musifolium* | Crocodile Fern | `plants/microsorum-musifolium.png` | Pending |
| `selaginella-kraussiana` | *Selaginella kraussiana 'Aurea'* | Golden Clubmoss | `plants/selaginella-kraussiana.png` | Pending |
| `hypnum-moss` | *Hypnum cupressiforme* | Sheet Moss | `plants/hypnum-moss.png` | Pending |
| `dicranum-scoparium` | *Dicranum scoparium* | Mood Moss | `plants/dicranum-scoparium.png` | Pending |
| `rhaphidophora-tetrasperma` | *Rhaphidophora tetrasperma* | Mini Monstera | `plants/rhaphidophora-tetrasperma.png` | Pending |
| `anthurium-scandens` | *Anthurium scandens* | Climbing Anthurium | `plants/anthurium-scandens.png` | Pending |
| `spathiphyllum-wallisii` | *Spathiphyllum wallisii* | Peace Lily | `plants/spathiphyllum-wallisii.png` | Pending |
| `begonia-pavonina` | *Begonia pavonina* | Peacock Begonia | `plants/begonia-pavonina.png` | Pending |
| `begonia-maculata` | *Begonia maculata* | Polka Dot Begonia | `plants/begonia-maculata.png` | Pending |
| `aeschynanthus-radicans` | *Aeschynanthus radicans* | Lipstick Plant | `plants/aeschynanthus-radicans.png` | Pending |
| `streptocarpus-hybrid` | *Streptocarpus hybridus* | Cape Primrose | `plants/streptocarpus-hybrid.png` | Pending |
| `senecio-rowleyanus` | *Curio rowleyanus* | String of Pearls | `plants/senecio-rowleyanus.png` | Pending |
| `lithops-sp` | *Lithops sp.* | Living Stones | `plants/lithops-sp.png` | Pending |
| `mammillaria-gracilis` | *Mammillaria gracilis* | Thimble Cactus | `plants/mammillaria-gracilis.png` | Pending |
| `sedum-morganianum` | *Sedum morganianum* | Burro's Tail | `plants/sedum-morganianum.png` | Pending |
| `ficus-pumila` | *Ficus pumila* | Creeping Fig | `plants/ficus-pumila.png` | Pending |
| `saxifraga-stolonifera` | *Saxifraga stolonifera* | Strawberry Begonia | `plants/saxifraga-stolonifera.png` | Pending |
| `pilea-cadierei` | *Pilea cadierei* | Aluminum Plant | `plants/pilea-cadierei.png` | Pending |
| `tradescantia-zebrina` | *Tradescantia zebrina* | Inch Plant | `plants/tradescantia-zebrina.png` | Pending |
