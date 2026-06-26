# typicalHeightCm research — plants missing the field

Web-sourced **typical cultivation height** for the 178 plants whose `typicalHeightCm`
was null.

- **[H-confirmed (93 plants)](typical-height-h-confirmed.md)** — already written to `plants.json`.
- **[M/L for review (85 plants)](typical-height-m-l-for-review.md)** — suggested values only; enter via Plant Admin.

## How to read this

- **Typical (cm)** = suggested `typicalHeightCm`. Chosen for terrarium/indoor cultivation,
  always ≤ the existing `maxHeightCm` in the data. Where houseplant sources cite a taller
  pot-grown size, the terrarium-kept figure is used and flagged.
- **Conf** = confidence: **H** well-documented, **M** reasonable inference, **L** sparse/guess.
- **no data** = no reliable published typical-height figure found; recommend leaving null
  (renderer falls back to `maxHeightCm × 0.7`).
- Sources are real pages found via search; one representative cite per plant.

---

## Batch 1–2 — common staples

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| fittonia-albivenis | 15 | 10 | H | [Wikipedia](https://en.wikipedia.org/wiki/Fittonia_albivenis) | Creeping mat to ~15 cm; terrarium-kept ~8–12. |
| maranta-leuconeura | 25 | 20 | H | [Gardenia](https://www.gardenia.net/plant/maranta-leuconeura-prayer-plant-grow-care-tips) | Houseplant 12 in (~30); terrarium stays ~20. |
| calathea-ornata | 30 | 25 | M | [Gardenia](https://www.gardenia.net/plant/calathea-ornata-sanderiana-pin-stripe-calathea) | Pot houseplant cited 60–90 cm; terrarium-scaled, stays ~25–30. |
| hypoestes-phyllostachya | 30 | 20 | H | [Wisconsin Hort](https://hort.extension.wisc.edu/articles/polka-dot-plant-hypoestes-phyllostachya/) | Compact 15–30 cm indoors; pruned ~20. |
| adiantum-raddianum | 30 | 25 | H | [NCSU](https://plants.ces.ncsu.edu/plants/adiantum-raddianum/) | 15–38 cm; indoor commonly 30–50, terrarium ~25. |
| pilea-involucrata | 20 | 15 | H | [NCSU](https://plants.ces.ncsu.edu/plants/pilea-involucrata/) | 6–12 in (15–30 cm); typical ~15. |
| peperomia-caperata | 20 | 15 | H | [Gardenia](https://www.gardenia.net/plant/peperomia-caperata-emerald-ripple-peperomia) | ~8 in (20 cm) most cited; foliage mound ~15. |
| begonia-rex | 35 | 25 | M | [UConn](https://homegarden.cahnr.uconn.edu/factsheets/rex-begonia/) | 12–18 in houseplant; low-light 8–10 in; terrarium ~25. |
| pilea-peperomioides | 30 | 25 | H | [Wikipedia](https://en.wikipedia.org/wiki/Pilea_peperomioides) | Commonly 20–30 cm tall/wide. |
| echeveria-elegans | 10 | 6 | H | [Wikipedia](https://en.wikipedia.org/wiki/Echeveria_elegans) | Rosette 5–10 cm tall; spreads wider than tall. |
| haworthia-attenuata | 15 | 10 | H | [Gardenia](https://www.gardenia.net/plant/haworthiopsis-attenuata-zebra-haworthia) | Commonly to ~10 cm, rarely 30. |
| tradescantia-zebrina | 15 | 12 | H | [NCSU](https://plants.ces.ncsu.edu/plants/tradescantia-zebrina/) | Trailing; mounded height 10–22 cm, stems trail far. |

## Batch 3 — staples, ferns, aquatics, CP

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| soleirolia-soleirolii | 5 | 3 | H | [NCSU](https://plants.ces.ncsu.edu/plants/soleirolia-soleirolii/) | Creeping mat, no more than 3–6 in; terrarium ~3. |
| microsorum-pteropus | 20 | 18 | H | [Aquarium Wiki](https://www.theaquariumwiki.com/wiki/Microsorum_pteropus) | Standard Java fern 15–30 cm; typical ~18. |
| episcia-cupreata | 15 | 10 | H | [Gardenia](https://www.gardenia.net/plant/episcia-cupreata-flame-violet-grow-care-guide) | Low trailing mat 4–6 in foliage; runners spread wide. |
| cryptanthus-bivittatus | 20 | 12 | H | [NCSU](https://plants.ces.ncsu.edu/plants/cryptanthus-bivittatus/) | Indoors 4–6 in (10–15 cm); flat rosette. |
| peperomia-argyreia | 20 | 18 | H | [Gardenia](https://www.gardenia.net/plant/peperomia-argyreia-watermelon-peperomia) | 8–12 in commonly; ~18 cm. |
| peperomia-obtusifolia | 25 | 20 | H | [Wikipedia](https://en.wikipedia.org/wiki/Peperomia_obtusifolia) | To 25 cm tall/broad; typical ~20. |
| drosera-capensis | 15 | 12 | H | [Wikipedia](https://en.wikipedia.org/wiki/Drosera_capensis) | Rosette to ~15 cm; flower stalks taller (excluded). |
| spathiphyllum-wallisii | 30 | 30 | H | [Blooming Expert](https://www.bloomingexpert.com/tips/peace-lily/spathiphyllum-care-guide/) | 'Wallisii' compact 30–40 cm; dwarfs smaller. |

## Batch 4 — succulents, ferns, jewel orchids, CP

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| sedum-rubrotinctum | 20 | 12 | H | [RHS](https://www.rhs.org.uk/plants/16987/sedum-rubrotinctum/details) | To 20 cm, low/trailing; typical mound ~12. |
| pilea-cadierei | 25 | 20 | H | [NCSU](https://plants.ces.ncsu.edu/plants/pilea-cadierei/) | 15–30 cm indoor; ~20. (Wikipedia max 60 = leggy.) |
| ludisia-discolor | 20 | 15 | H | [UK Houseplants](https://www.ukhouseplants.com/plants/jewel-orchid-ludisia-discolor) | Foliage 6–8 in (15–20); flower spike taller (excluded). |
| macodes-petola | 15 | 12 | H | [Gardenia](https://www.gardenia.net/plant/macodes-petola-jewel-orchid-grow-care-guide) | Small terrestrial 8–15 cm tall. |
| ficus-pumila | 20 | 10 | M | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/ficus-pumila-creeping-fig/) | Vine/groundcover — height is training-dependent; terrarium mat ~5–10. |
| pinguicula-moranensis | 8 | 5 | M | [Wikipedia](https://en.wikipedia.org/wiki/Pinguicula_moranensis) | Flat rosette to ~10 cm wide but low; height ~5. |
| pteris-cretica | 25 | 20 | M | [RHS](https://www.rhs.org.uk/plants/100589/pteris-cretica/details) | Houseplant 45–75 cm; terrarium-scaled, young ~20. |
| saxifraga-stolonifera | 20 | 15 | H | [NCSU](https://plants.ces.ncsu.edu/plants/saxifraga-stolonifera/) | Foliage rosette ~8 in (20 cm); flower stalk excluded. |

## Batch 5 — trailers, canes, terrarium foliage

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| senecio-rowleyanus | 8 | 5 | H | [Wisconsin Hort](https://hort.extension.wisc.edu/articles/string-of-pearls-senecio-rowleyanus/) | Trailing; mound height 3–6 in, stems trail far. |
| ceropegia-woodii | 10 | 8 | H | [Wikipedia](https://en.wikipedia.org/wiki/Ceropegia_woodii) | Vertical ~10 cm; vines trail to 2 m. |
| ceropegia-woodii-string-of-spades | 10 | 8 | H | [Wikipedia](https://en.wikipedia.org/wiki/Ceropegia_woodii) | Same species, leaf form; same habit. |
| begonia-maculata | 30 | 30 | M | [Costa Farms](https://costafarms.com/blogs/get-growing/the-tall-growth-habit-of-polka-dot-begonia) | Cane begonia 60–90 cm as houseplant; terrarium-capped, will outgrow. |
| aeschynanthus-radicans | 20 | 12 | H | [Gardeners' World](https://www.gardenersworld.com/house-plants/lipstick-plant-aeschynanthus/) | Crown 4–6 in; trailing stems long. |
| hemionitis-arifolia | 15 | 15 | H | [NCSU](https://plants.ces.ncsu.edu/plants/hemionitis-arifolia/) | Dwarf fern 15–25 cm; ~15. |
| selaginella-kraussiana | 8 | 5 | H | [Wikipedia](https://en.wikipedia.org/wiki/Selaginella_kraussiana) | Mat to ~5 cm high, spreads wide. |
| anubias-nana-petite | 5 | 4 | H | [Aquariadise](https://www.aquariadise.com/anubias-nana-petite/) | Dwarf aquatic ~5 cm; one of the smallest. |
| hemigraphis-alternata | 20 | 15 | H | [Costa Farms](https://costafarms.com/blogs/plant-finder/purple-waffle-plant) | 6–8 in tall, prostrate spreading. |

## Batch 6 — mosses, aquatic carpets, creepers

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| leucobryum-glaucum | 4 | 3 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/leucobryum-glaucum-cushion-moss/) | Low dome cushion; terrarium-kept ~2–4 cm. |
| dicranum-scoparium | 5 | 4 | H | [Wikipedia](https://en.wikipedia.org/wiki/Dicranum_scoparium) | Tufts 2–8 cm high. |
| taxiphyllum-barbieri | 5 | 3 | H | [Aquarium Breeder](https://aquariumbreeder.com/java-moss-care-guide-planting-growing-and-propagation/) | Java moss; carpet kept ~1–3 cm. |
| vesicularia-dubyana | 4 | 3 | M | [Aquarium Breeder](https://aquariumbreeder.com/java-moss-care-guide-planting-growing-and-propagation/) | Also "Java moss"; thin carpet ~3 cm. |
| ludwigia-repens | 20 | 18 | M | [ABC Plants](https://www.abcplants.com/aquarium-plant-encyclopedia-1/ludwigia-repens) | Stem plant 20–50 cm in tall tanks; terrarium-capped. |
| micranthemum-tweedei | 3 | 3 | H | [Aquarium Breeder](https://aquariumbreeder.com/monte-carlo-plant-care-guide-planting-growing-and-propagation/) | Monte Carlo carpet 3–5 cm. |
| eleocharis-radicans | 10 | 8 | M | [2Hr Aquarist](https://www.2hraquarist.com/blogs/freshwater-aquarium-plants-guide/how-to-grow-dwarf-hairgrass) | Dwarf hairgrass 5–15 cm uncut. |
| hydrocotyle-tripartita | 8 | 6 | H | [Aquarzon](https://www.aquarzon.com/foreground/183-carpeting-japanese-dwarf-pennywort-hydrocotyle-tripartita-sp-japan.html) | Carpet 5–10 cm tall. |
| pellionia-repens | 10 | 6 | H | [Gardenia](https://www.gardenia.net/plant/pellionia-repens-trailing-watermelon-begonia-grow-care-guide) | Prostrate creeper; mat ~6 cm, trails wide. |

## Batch 7 — trailers, ferns, succulents, CP

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| peperomia-prostrata | 5 | 4 | H | [NCSU](https://plants.ces.ncsu.edu/plants/peperomia-prostrata/) | Vertical 1–2 in; mat 5–10 cm, trails. |
| sedum-morganianum | 20 | 12 | M | [NCSU](https://plants.ces.ncsu.edu/plants/sedum-morganianum/) | Cascading; little vertical height, stems trail to 60+ cm. |
| portulacaria-afra | 30 | 25 | M | [Wisconsin Hort](https://hort.extension.wisc.edu/articles/elephant-bush-portulacaria-afra/) | Bonsai/indoor 30–45 cm; untrimmed much larger. |
| alocasia-reginula-black-velvet | 25 | 25 | H | [Grow Alocasia](https://www.growalocasia.com/alocasia-black-velvet.html) | Compact 30–45 cm; terrarium-kept ~25. |
| davallia-fejeensis | 25 | 20 | M | [Houseplants Expert](https://houseplantsexpert.com/rabbits-foot-fern.html) | Houseplant compact; fronds arching ~20. |
| nephrolepis-duffii | 20 | 18 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/nephrolepis-cordifolia-duffii-lemon-button-fern/) | Dwarf, rarely >1 ft (30 cm). |
| pilea-nummulariifolia | 8 | 6 | H | [NCSU](https://plants.ces.ncsu.edu/plants/pilea-nummulariifolia/) | 4–8 in but creeping low; mat ~6. |
| drosera-adelae | 20 | 10 | M | [Wikipedia](https://en.wikipedia.org/wiki/Drosera_adelae) | Rosette 5–10 cm tall; leaves to 25 cm long. |

## Batch 8 — groundcovers, ferns, gesneriads, cactus

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| tradescantia-fluminensis | 20 | 15 | H | [NCSU](https://plants.ces.ncsu.edu/plants/tradescantia-fluminensis/) | 6–9 in tall, trailing groundcover. |
| ophiopogon-japonicus-mini | 10 | 8 | H | [NCSU](https://plants.ces.ncsu.edu/plants/ophiopogon-japonicus-nana/) | Dwarf mondo 7–15 cm; ~8. |
| streptocarpus-hybrid | 20 | 18 | H | [NCSU](https://plants.ces.ncsu.edu/plants/streptocarpus/) | 15–30 cm depending on cultivar. |
| pellaea-rotundifolia | 25 | 20 | H | [Gardenia](https://www.gardenia.net/plant/pellaea-rotundifolia-button-fern) | 15–30 cm; fronds 25–35 cm long. |
| pyrrosia-nummularifolia | 10 | 8 | H | [RHS](https://www.rhs.org.uk/plants/14219/creeping-button-fern/details) | Creeping fern 5–15 cm tall. |
| geogenanthus-poeppigii | 20 | 18 | H | [Plant Lust](https://plantlust.com/plants/58164/geogenanthus-poeppigii/) | Compact 10–25 cm; slow. |
| mammillaria-gracilis | 12 | 8 | M | [GardenBeast](https://gardenbeast.com/mammillaria-gracilis-guide/) | Clustering; each stem 5–13 cm. |
| peperomia-rotundifolia | 10 | 8 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/peperomia-rotundifolia-trailing-jade/) | Young upright then trails; terrarium-kept low. |

## Batch 9 — spikemoss, ferns, aquatics, CP, succulents

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| selaginella-uncinata | 5 | 4 | H | [NCSU](https://plants.ces.ncsu.edu/plants/selaginella-uncinata/) | Ground-hugging creeper; ~4 cm high. |
| microsorum-musifolium | 30 | 25 | M | [Gardenia](https://www.gardenia.net/plant/microsorum-musifolium-crocodile-fern-grow-care-guide) | Houseplant 60–90 cm; terrarium-scaled, young ~25. |
| asplenium-bulbiferum | 30 | 25 | M | [NCSU](https://plants.ces.ncsu.edu/plants/asplenium-bulbiferum/) | Young 30–45 cm; matures larger. Terrarium-capped. |
| lithops-sp | 4 | 3 | H | [NCSU](https://plants.ces.ncsu.edu/plants/lithops/) | 1–2 cm above soil, to ~5 cm. |
| bucephalandra-sp-mini | 4 | 3 | H | [Aquarium Breeder](https://aquariumbreeder.com/bucephalandra-care-guide-planting-growing-and-propagation/) | Mini creeping bucephalandra 2–5 cm. |
| drosera-spatulata | 8 | 4 | H | [Wikipedia](https://en.wikipedia.org/wiki/Drosera_spatulata) | Flat rosette 2–7 cm diameter; low. |
| biophytum-sensitivum | 10 | 10 | H | [Gardenia](https://www.gardenia.net/plant/biophytum-sensitivum-little-tree-plant-grow-care-guide) | Palm-like 6–15 cm. |
| peperomia-puteolata | 30 | 25 | H | [Houseplants Expert](https://houseplantsexpert.com/peperomia-puteolata.html) | Upright 20–30 cm then trails. |

## Batch 10 — vines, dwarf cultivars, misc

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| philodendron-hederaceum-mini | 30 | 20 | M | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/philodendron-hederaceum-heartleaf/) | Trailing/climbing vine — height training-dependent. |
| syngonium-podophyllum-mini | 25 | 20 | M | [NCSU](https://plants.ces.ncsu.edu/plants/syngonium-podophyllum/) | Compact/bushy juvenile, then vines. |
| crassula-ovata-mini | 25 | 20 | M | [World of Succulents](https://worldofsucculents.com/crassula-ovata-minima-small-jade-miniature-jade/) | Dwarf jade, slow; terrarium-kept small. |
| equisetum-bogotense | 30 | — | L | [Wikipedia](https://en.wikipedia.org/wiki/Equisetum_bogotense) | **no species-specific data**; genus horsetail 20 cm–1.5 m. Recommend null. |
| acorus-chacosekisho | 15 | 10 | M | [NCSU](https://plants.ces.ncsu.edu/plants/acorus-gramineus/) | Very dwarf sweet-flag cultivar; genus dwarfs 5–15 cm. |
| microsorum-thailandicum | 20 | 18 | M | [GrowTropicals](https://growtropicals.com/products/microsorum-thailandicum-blue-oil-fern) | Fronds to 20–30 cm; terrarium-capped. |
| pilea-glauca | 10 | 8 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/pilea-glauca/) | Terrarium-kept ~10 cm, trails. |
| alsobia-dianthiflora | 15 | 12 | H | [NCSU](https://plants.ces.ncsu.edu/plants/alsobia-dianthiflora/) | 6–8 in, trailing stolons. |

## Batch 11 — mosses

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| fissidens-fontanus | 3 | 2 | H | [Aquariadise](https://www.aquariadise.com/fissidens-fontanus/) | Phoenix moss; stem height 1–4 cm in terrarium. |
| hypnum-moss | 3 | 2 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/hypnum-cupressiforme-sheet-moss/) | Sheet moss creeping mat; 1–2.5 cm tall. |
| hyophila-involuta | 3 | 2 | H | [NZPCN](https://www.nzpcn.org.nz/flora/species/hyophila-involuta/) | Stems erect 1–14 mm; typical ~1–2 cm. |
| thuidium-delicatulum | 4 | 2 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/thuidium-delicatulum-fern-moss/) | Fern moss carpet 1–3 cm tall. |

## Batch 12 — selaginella & small ferns

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| selaginella-apoda | 5 | 4 | H | [Wikipedia](https://en.wikipedia.org/wiki/Selaginella_apoda) | Meadow spikemoss; creeping mat, 1–3 in (2.5–7.5 cm). |
| selaginella-erythropus-sanguinea | 15 | 10 | H | [Glass Aqua](https://shop.glassaqua.com/products/selaginella-erythropus-sanguinea) | Ruby Red; max 6 in (~15 cm); typical ~10. |
| selaginella-martensii-watsoniana | 20 | 15 | H | [Plant Lust](https://plantlust.com/plants/41958/selaginella-martensii-watsoniana/) | Cultivar 6–8 in (15–20 cm) tall; more compact than standard S. martensii. |
| crepidomanes-minutum | 5 | 2 | H | [Another World Terraria](https://www.anotherworldterraria.com/plants/crepidomanes-minutum/) | Dwarf filmy fern; fronds 1–2 cm. |
| lemmaphyllum-microphyllum | 8 | 3 | H | [Fancy Fronds Nursery](https://www.fancyfrondsnursery.com/ferns/bean-fern-lemmaphyllum-microphyllum) | Creeping epiphytic mat; ~1 in (2–3 cm) high. |
| actiniopteris-australis | 30 | 15 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/eyelash-fern-actiniopteris-australis/) | Eyelash fern; grows to 15 cm; "never beyond 6 in". |
| pleopeltis-percussa | 30 | 20 | M | [NCSU](https://plants.ces.ncsu.edu/plants/pleopeltis-michauxiana/) | Epiphytic creeping fern; related P. polypodioides 10–20 cm fronds; terrarium-scaled. |
| bolbitis-heteroclita-cuspidata | 30 | 20 | M | — | Cuspidata (larger) form; no form-specific data; fallback max × 0.7. |

## Batch 13 — bromeliads (Neoregelia & Cryptanthus)

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| cryptanthus-absolute-zero | 10 | 7 | M | [Bromeliad Paradise](https://bromeliadparadise.com/products/cryptanthus-absolute-zero) | Earth star; 3–4 in (7–10 cm) tall; spreads much wider. |
| neoregelia-fireball | 12 | 8 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/neoregelia-fireball/) | Mini neo; ~6 in wide; terrarium leaf-height ~8 cm. |
| neoregelia-hybrid-liliputiana | 12 | 7 | M | [Bromeliad.com](https://www.bromeliad.com/products/neoregelia-lilliputiana) | N. liliputiana parent; species maxes at ~3 in (7 cm). |
| neoregelia-blushing-tiger-puntatissima | 15 | 10 | M | — | Puntatissima cross; slightly taller than pure liliputiana types; fallback. |
| neoregelia-cotton-candy | 12 | 8 | M | — | Mini hybrid; no published data; fallback max × 0.7. |
| neoregelia-easter-egg | 12 | 8 | M | — | Mini hybrid; no published data; fallback. |
| neoregelia-lilyput-pheasant | 10 | 7 | M | — | Mini hybrid; no published data; fallback. |
| neoregelia-mini-skirt | 10 | 7 | M | — | Mini hybrid; no published data; fallback. |
| neoregelia-mojo | 12 | 8 | M | — | Mini hybrid; no published data; fallback. |
| neoregelia-skotaks-matilde | 10 | 7 | M | — | Skotak hybrid; no published data; fallback. |
| neoregelia-skotak-mirage | 10 | 7 | M | — | Skotak hybrid; no published data; fallback. |
| neoregelia-skotaks-unregistered | 10 | 7 | M | — | Skotak hybrid; no published data; fallback. |
| neoregelia-wild-tiger-goode | 12 | 8 | M | — | Mini hybrid; no published data; fallback. |

## Batch 14 — begonias

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| begonia-prismatocarpa | 10 | 6 | H | [Glass Box Tropicals](https://glassboxtropicals.com/begonia-prismatocarpa/) | Smallest Begonia species; mounded; max 6–7 cm. |
| begonia-thelmae | 15 | 10 | H | [Plant Lust](https://plantlust.com/plants/30102/begonia-thelmae/) | Trailing; 4–12 in tall, spreads very wide. |
| begonia-dodsoni | 15 | 10 | M | — | Small rhizomatous species; no published height; fallback. |
| begonia-polliloensis | 15 | 10 | M | [Glass Box Tropicals](https://glassboxtropicals.com/begonia-polliloensis/) | Compact terrarium species; no specific height cited. |
| begonia-baik | 15 | 10 | M | — | Small species; no published height data; fallback. |
| begonia-pavonina | 20 | 15 | M | [Gardening Brain](https://gardeningbrain.com/begonia-pavonina/) | Peacock begonia; houseplant 40–63 cm; terrarium-scaled to ~15. |
| begonia-schulzei | 20 | 15 | M | [Biotopo](https://www.biotopo.eu/begonia-schulzei/) | Compact terrarium species; no specific height cited. |
| begonia-klemmei | 20 | 15 | M | [Biogardens](https://biogardens.org/encyclopedia/begonia-klemmei) | Rhizomatous, small; no specific height. |
| begonia-soli-mutata | 20 | 15 | H | [Gardenia](https://www.gardenia.net/plant/begonia-soli-mutata) | Sun-changing begonia; 15–30 cm; terrarium lower bound. |
| begonia-pustulata | 20 | 15 | H | [LizPlants](https://lizplants.com/grow/begonia-pustulata) | Warty rhizomatous; rarely exceeds 6–7 in (15–18 cm). |
| begonia-turrialbae | 20 | 12 | H | [GrowTropicals](https://growtropicals.com/products/begonia-turrialbae) | Compact; 4–6 in (10–15 cm). |
| begonia-cleopatrae | 20 | 12 | H | [NCSU](https://plants.ces.ncsu.edu/plants/begonia-cleopatrae/) | Maple-leaf begonia; rarely exceeds 15 cm. |
| begonia-burkilii-silver-form | 20 | 15 | M | [Araflora](https://www.araflora.com/product/begonia-schulzei-elaeagnifolia-care-buy/) | Rhizomatous; up to 8 in (~20 cm); silver-leaf form. |
| begonia-loranthoides-sp-rhopalocarpa | 20 | 15 | M | — | Trailing woody stems; no specific height; fallback. |
| begonia-amphioxus | 25 | 20 | M | [Steve's Leaves](https://stevesleaves.com/products/begonia-amphioxus) | Spotted cane; 6–12 in (15–30 cm); terrarium ~20. |
| begonia-conchifolia | 25 | 20 | H | [Fuchsia Delhommeau](https://www.fuchsia-delhommeau.com/begonia-conchifolia-1.html) | Creeping rhizome; 20–30 cm. |
| begonia-longiciliata-sizemoreae | 25 | 20 | M | [Steve's Leaves](https://stevesleaves.com/products/begonia-sizemoreae) | Grows to 40 cm in ideal conditions; terrarium-scaled. |
| begonia-variabilis | 25 | 18 | M | — | Vivarium species; no published height; fallback. |
| begonia-raja | 30 | 25 | M | [Glass Box Tropicals](https://glassboxtropicals.com/begonia-rajah/) | Malaysian; terrarium-required; wild to 60+ cm; DB-capped. |
| begonia-luzonensis | 30 | 20 | M | [FrogDaddy](https://frogdaddy.net/products/begonia-luzonensis) | Philippine; 12 in (30 cm) typical; also cited 6–7 in rhizomatous. |
| begonia-sutherlandii-saunders-legacy | 30 | 25 | H | [RHS](https://www.rhs.org.uk/plants/524402/begonia-sutherlandii-saunders-s-legacy-(t)/details) | Cultivar; 30 cm height × 25 cm wide. |

## Batch 15 — misc terrarium vines & cultivars

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| soleirolia-soleirolii-minor | 3 | 2 | M | — | Dwarf form of S. soleirolii (3 cm); naturally shorter; ~2. |
| epipremnum-pinnatum-mini | 25 | 18 | L | — | Mini vining aroid; height training-dependent; no data; fallback max × 0.7. |
| ficus-vaccinioides | 20 | 10 | M | [FrogDaddy](https://www.frogdaddy.net/ficus/ficus-vaccinioides) | Formosan creeping fig; mounding in terrarium; prune-dependent. |
| ficus-pumila-panama | 20 | 12 | H | [Glass Box Tropicals](https://glassboxtropicals.com/ficus-sp-panama/) | Fast-growing vine; terrarium height 10–20 cm. |
| ficus-pumila-snowflake | 30 | 8 | H | [Hortmag](https://www.hortmag.com/plants-we-love-2/snowflake-ficus-is-an-easy-and-cheerful-small-houseplant) | Variegated cultivar; up to 9 cm tall; spreads very wide. |
| nephrolepis-exaltata-fluffy-ruffles | 30 | 25 | H | [Foliage Factory](https://www.foliage-factory.com/nephrolepis-exaltata-fluffy-ruffles) | Compact Boston fern cultivar; 20–35 cm; unlikely to exceed 12 in. |
| solanum-evolvulifolium | 30 | 20 | L | — | Trailing vine; no cultivation height data found; fallback max × 0.7. |

## Batch 16 — miniature orchids

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| miniature-orchid | 10 | 8 | M | — | Generic miniature orchid; stays well under 10 cm in terrarium. |
| masdevallia-auropurpurea | 20 | 14 | M | [J&L Orchids](https://jlorchids.com/masdevallia-auropurpurea/) | Miniature; no specific height; fallback max × 0.7. |
| masdevallia-floribunda | 15 | 10 | M | — | Small masdevallia; no specific height; fallback. |
| masdevallia-nidifica | 12 | 8 | M | — | Compact masdevallia; fallback. |
| pleurothallis-allenii | 15 | 12 | H | [Andy's Orchids](https://andysorchids.com/pictureframe.asp?picid=5890) | 3 in leaves on 2 in petioles; total ~12 cm foliage. |
| pleurothallis-costaricensis | 12 | 8 | M | — | Small pleurothallis; no height data; fallback. |
| pleurothallis-grobyi | 15 | 8 | H | [Kawamoto Orchids](https://kawamotoorchids.com/products/pleurothallis-grobyi-super-miniature-orchid-easy-to-grow-and-bloom-cute) | Super-mini; leaves ~6 cm; spikes taller (excluded). |
| pleurothallis-rubella | 10 | 8 | M | — | Tiny pleurothallis; no height data; fallback. |
| restrepia-muscifera | 20 | 15 | H | [AOS](https://www.aos.org/orchids/orchids-a-to-z/letter-r/restrepia.aspx) | 6–12 in (15–30 cm); terrarium-kept lower bound. |
| restrepia-lansburghi | 20 | 15 | H | [Orchid Species](https://www.orchids.org/grexes/restrepia-muscifera) | Synonym of R. muscifera; same habit and size. |
| scaphosepalum-dodsoni | 15 | 12 | M | — | Masdevallia-alliance orchid; no specific height; fallback. |
| stelis-argentata | 12 | 8 | M | — | Tiny stelis; no published height data; fallback. |
| zootrophion-sp | 15 | 10 | M | — | Small pleurothallis-alliance genus; no height data; fallback. |
| barbosella-hiftzii | 8 | 6 | M | — | Miniature barbosella; no height data; fallback max × 0.7. |
| bulbophyllum-intersitum | 15 | 10 | M | — | Small bulbophyllum; no height data; fallback. |
| cirrhopetalum-farreri | 20 | 15 | M | — | Cirrhopetalum (=Bulbophyllum); no height data; fallback. |
| cirrhopetalum-taiwanese | 15 | 12 | M | — | Compact cirrhopetalum; no height data; fallback. |
| haerella-odorata | 8 | 6 | M | — | Tiny monopodial orchid; no height data; fallback max × 0.7. |

## Batch 17 — jewel orchids (Anoectochilus)

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| anoectochilus-formosanus | 20 | 12 | H | [La Foresta Orchids](https://www.laforestaorchids.com/products/anoectochilus-formosanus) | Leaves to 5 cm; foliage rosette ~12 cm; flower spikes excluded. |
| anoectochilus-albolineatus | 20 | 12 | M | — | Similar to A. formosanus; no specific data; fallback. |
| anoectochilus-charlottes-web | 20 | 15 | M | — | Hybrid; potentially taller than species; fallback. |

## Batch 18 — gesneriads

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| deinostigma-tamiana | 12 | 7 | H | [Pumpkin Beth](https://www.pumpkinbeth.com/2020/10/growing-deinostigma-tamiana) | Miniature Vietnamese violet; rosette ~3 in (7.5 cm); stalks taller (excluded). |
| episcia-chocolate-velvet | 20 | 12 | M | [Gardenia](https://www.gardenia.net/plant/episcia-cupreata-flame-violet-grow-care-guide) | Episcia cultivar; mat similar to E. cupreata; ~12 cm. |
| episcia-lilacina | 20 | 12 | M | [Violet Barn](https://www.violetbarn.com/episcia-c10.html) | Noted as smaller episcia, good terrarium type. |
| episcia-silver-dust | 20 | 12 | M | — | Episcia cultivar; compact trailing mat; fallback. |
| sinningia-freckles | 8 | 5 | H | [Glass Box Tropicals](https://glassboxtropicals.com/sinningia-freckles/) | Micro-miniature; leaves under 1 in; total plant a few cm across. |
| sinningia-prudence-risley | 8 | 6 | M | — | Web sources cite 30 cm, but DB max is 8 cm; using max × 0.7. |

## Batch 19 — peperomias

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| peperomia-orba-pixie-lime | 10 | 8 | M | — | Compact bushy peperomia cultivar; no height data; fallback. |
| peperomia-emarginella | 10 | 5 | H | [Araflora](https://www.araflora.com/product/peperomia-emarginella/) | Tiny mat-former; leaves a few mm wide; near-flat growth. |
| peperomia-rubella | 15 | 10 | H | [Foliage Friend](https://foliagefriend.com/peperomia-rubella-vs-verticillata/) | Grows 4 in (10 cm) upright then sprawls. |
| peperomia-fagerlindii | 15 | 10 | M | — | Peperomia species; no height data; fallback. |
| peperomia-pepper-spot | 15 | 8 | H | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/peperomia-pepperspot-string-of-coins/) | Prostrata-type trailing vine; very low vertical height. |
| peperomia-albovittata-piccolo-banda | 20 | 15 | M | [Terrarium Tribe](https://terrariumtribe.com/terrarium-plants/peperomia-albovittata-piccolo-banda/) | Peacock peperomia; compact bushy; no specific height. |
| peperomia-guttalata | 20 | 14 | M | — | No height data found; fallback max × 0.7. |
| peperomia-taroriana | 20 | 10 | M | — | Tiny viner; low vertical habit; fallback lower than max × 0.7. |
| peperomia-tingo-maria | 20 | 14 | M | — | No height data found; fallback max × 0.7. |
| peperomia-turboensis | 20 | 15 | M | [NEHERP](https://www.neherpetoculture.com/peperomia) | Compact vivarium plant; metallic foliage; no specific height. |
| peperomia-trinervis | 25 | 12 | H | [Studley's Houseplants](https://houseplants.studleys.com/product/trinervula-peperomia/) | Trailing; 3–6 in (7.5–15 cm) tall, 12–15 in wide. |
| peperomia-angulata | 25 | 18 | M | [Glass Box Tropicals](https://glassboxtropicals.com/peperomia-angulata/) | Beetle peperomia; houseplant to 50 cm; terrarium-scaled. |
| peperomia-verticillata-red-log | 25 | 20 | H | [Hortology](https://hortology.co.uk/products/peperomia-verticillata-red-log) | Ultimate height 20–30 cm; compact indoors. |

## Batch 20 — pileas, sonerila, misc

| slug | max | Typical (cm) | Conf | Source | Note |
|------|----:|-------------:|:----:|--------|------|
| pilea-libanensis-aquamarine | 15 | 10 | H | [Evergreen Seeds](https://www.evergreenseeds.com/pilea-glauca/) | Trailing; ~4 in (10 cm) tall; spreads to 60 cm wide. |
| pilea-pubescens-silver-cloud | 20 | 14 | M | — | Compact terrarium pilea; no height data; fallback max × 0.7. |
| pilea-spruceana | 30 | 20 | H | [Gardenia](https://www.gardenia.net/plant/pilea-spruceana-silver-tree-pilea-grow-care-tips) | Silver tree pilea; 6–12 in (15–30 cm). |
| procris-pulchra | 20 | 10 | M | [FrogDaddy](https://frogdaddy.net/products/pellionia-pulchra) | Satin pellionia; trailing vine 3–6 in (7.5–15 cm) tall. |
| sonerila-cantonensis-vietnam | 25 | 12 | H | [Siam Green Culture](https://siamgreenculture.com/store/p436/Soneriladongii.html) | Compact; ~5 in (12 cm) before branching. |
| sonerila-neon-lights | 20 | 15 | M | [Glass Box Tropicals](https://glassboxtropicals.com/sonerila-sp-neon-lights/) | Upright branching; no specific height; fallback. |
| monolena-primulaeflora-red | 25 | 18 | M | [Tankquility](https://tankquility.com.au/products/monolena-primuliflora) | Low rosette; spreads to ~40 cm wide; leaf height ~15–20. |
| solanum-evolvulifolium | 30 | 20 | L | — | Trailing vine; no cultivation height data found; fallback max × 0.7. |
