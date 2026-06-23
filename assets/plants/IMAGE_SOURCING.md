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

## Worklist (243 plants)

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
| `peperomia-rotundifolia` | *Peperomia rotundifolia* | Creeping Buttons | `plants/peperomia-rotundifolia.png` | Pending |
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
| `vesicularia-dubyana` | *Vesicularia dubyana* | Java Moss | `plants/vesicularia-dubyana.png` | Pending |
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
| `anthurium-scandens` | *Anthurium scandens* | Anthurium | `plants/anthurium-scandens.png` | Pending |
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
| `macodes-petola` | *Macodes petola* | Lightning Bolt Orchid | `plants/macodes-petola.png` | Pending |
| `ludisia-discolor` | *Ludisia discolor* | Black Jewel Orchid | `plants/ludisia-discolor.png` | Pending |
| `peperomia-prostrata` | *Peperomia prostrata* | String of Turtles | `plants/peperomia-prostrata.png` | Pending |
| `scindapsus-pictus-argyraeus` | *Scindapsus pictus 'Argyraeus'* | Satin Pothos | `plants/scindapsus-pictus-argyraeus.png` | Pending |
| `asparagus-setaceus` | *Asparagus setaceus* | Asparagus Fern | `plants/asparagus-setaceus.png` | Pending |
| `pellaea-rotundifolia` | *Pellaea rotundifolia* | Button Fern | `plants/pellaea-rotundifolia.png` | Pending |
| `chamaedorea-elegans` | *Chamaedorea elegans* | Parlor Palm | `plants/chamaedorea-elegans.png` | Pending |
| `biophytum-sensitivum` | *Biophytum sensitivum* | Little Tree Plant | `plants/biophytum-sensitivum.png` | Pending |
| `tillandsia-ionantha` | *Tillandsia ionantha* | Air Plant | `plants/tillandsia-ionantha.png` | Pending |
| `neoregelia-hybrid-liliputiana` | *Neoregelia hybrid 'Liliputiana'* | Miniature Neoregelia | `plants/neoregelia-hybrid-liliputiana.png` | Pending |
| `marcgravia-rectiflora` | *Marcgravia rectiflora* | Shingle Plant | `plants/marcgravia-rectiflora.png` | Pending |
| `dischidia-ruscifolia` | *Dischidia ruscifolia* | Million Hearts Plant | `plants/dischidia-ruscifolia.png` | Pending |
| `ficus-pumila-panama` | *Ficus pumila 'Panama'* | Panama Creeping Fig | `plants/ficus-pumila-panama.png` | Pending |
| `rhaphidophora-hayi` | *Rhaphidophora hayi* | Shingle Vine | `plants/rhaphidophora-hayi.png` | Pending |
| `hemionitis-arifolia` | *Hemionitis arifolia* | Heart Fern | `plants/hemionitis-arifolia.png` | Pending |
| `microsorum-thailandicum` | *Microsorum thailandicum* | Blue Oil Fern | `plants/microsorum-thailandicum.png` | Pending |
| `nephrolepis-exaltata-fluffy-ruffles` | *Nephrolepis exaltata 'Fluffy Ruffles'* | Fluffy Ruffles Fern | `plants/nephrolepis-exaltata-fluffy-ruffles.png` | Pending |
| `peperomia-orba-pixie-lime` | *Peperomia orba 'Pixie Lime'* | Pixie Lime Peperomia | `plants/peperomia-orba-pixie-lime.png` | Pending |
| `peperomia-albovittata-piccolo-banda` | *Peperomia albovittata 'Piccolo Banda'* | Piccolo Banda Peperomia | `plants/peperomia-albovittata-piccolo-banda.png` | Pending |
| `begonia-amphioxus` | *Begonia amphioxus* | Butterfly Begonia | `plants/begonia-amphioxus.png` | Pending |
| `begonia-schulzei` | *Begonia schulzei* | Oak Leaf Miniature Begonia | `plants/begonia-schulzei.png` | Pending |
| `alocasia-reginula-black-velvet` | *Alocasia reginula 'Black Velvet'* | Black Velvet Alocasia | `plants/alocasia-reginula-black-velvet.png` | Pending |
| `hyophila-involuta` | *Hyophila involuta* | Star Moss | `plants/hyophila-involuta.png` | Pending |
| `selaginella-apoda` | *Selaginella apoda* | Meadow Spikemoss | `plants/selaginella-apoda.png` | Pending |
| `portulacaria-afra` | *Portulacaria afra* | Elephant Bush | `plants/portulacaria-afra.png` | Pending |
| `alocasia-baginda-silver-dragon` | *Alocasia baginda 'Silver Dragon'* | Silver Dragon Alocasia | `plants/alocasia-baginda-silver-dragon.png` | Pending |
| `alocasia-amazonica-bambino` | *Alocasia × amazonica 'Bambino'* | Bambino Alocasia | `plants/alocasia-amazonica-bambino.png` | Pending |
| `alocasia-maharani-grey-dragon` | *Alocasia maharani 'Grey Dragon'* | Grey Dragon Alocasia | `plants/alocasia-maharani-grey-dragon.png` | Pending |
| `thuidium-delicatulum` | *Thuidium delicatulum* | Fern Moss | `plants/thuidium-delicatulum.png` | Pending |
| `acorus-chacosekisho` | *Acorus gramineus 'Chacosekisho'* | Chacosekisho Sweet Flag | `plants/acorus-chacosekisho.png` | Pending |
| `hemigraphis-alternata` | *Hemigraphis alternata* | Purple Waffle Plant | `plants/hemigraphis-alternata.png` | Pending |
| `hygrophila-pinnatifida` | *Hygrophila pinnatifida* | Hygrophila Pinnatifida | `plants/hygrophila-pinnatifida.png` | Pending |
| `ruellia-makoyana` | *Ruellia makoyana* | Monkey Plant | `plants/ruellia-makoyana.png` | Pending |
| `strobilanthes-dyerianus` | *Strobilanthes dyerianus* | Persian Shield | `plants/strobilanthes-dyerianus.png` | Pending |
| `ceropegia-woodii` | *Ceropegia woodii* | String of Hearts | `plants/ceropegia-woodii.png` | Pending |
| `ceropegia-woodii-string-of-spades` | *Ceropegia woodii (String of Spades form)* | String of Spades | `plants/ceropegia-woodii-string-of-spades.png` | Pending |
| `alocasia-dragon-scale` | *Alocasia baginda 'Dragon Scale'* | Dragon Scale Alocasia | `plants/alocasia-dragon-scale.png` | Pending |
| `anubias-hastifolia` | *Anubias hastifolia* | Hastifolia Anubias | `plants/anubias-hastifolia.png` | Pending |
| `epipremnum-aureum-global-green` | *Epipremnum aureum 'Global Green'* | Global Green Pothos | `plants/epipremnum-aureum-global-green.png` | Pending |
| `philodendron-burle-marx-fantasy` | *Philodendron 'Burle Marx Fantasy'* | Burle Marx Fantasy Philodendron | `plants/philodendron-burle-marx-fantasy.png` | Pending |
| `philodendron-verrucosum` | *Philodendron verrucosum* | Velvet Leaf Philodendron | `plants/philodendron-verrucosum.png` | Pending |
| `philodendron-verrucosum-mini` | *Philodendron verrucosum 'Mini'* | Mini Velvet Leaf Philodendron | `plants/philodendron-verrucosum-mini.png` | Pending |
| `philodendron-wend-imbe` | *Philodendron 'Wend-Imbe'* | Wend-Imbe Philodendron | `plants/philodendron-wend-imbe.png` | Pending |
| `rhaphidophora-cryptantha` | *Rhaphidophora cryptantha* | Shingle Plant | `plants/rhaphidophora-cryptantha.png` | Pending |
| `syngonium-albo` | *Syngonium podophyllum 'Albo'* | Albo Variegated Arrowhead Plant | `plants/syngonium-albo.png` | Pending |
| `syngonium-rayii` | *Syngonium rayii* | Silver Goosefoot Plant | `plants/syngonium-rayii.png` | Pending |
| `begonia-baik` | *Begonia baik* | Begonia baik | `plants/begonia-baik.png` | Pending |
| `begonia-bipinnatifida` | *Begonia bipinnatifida* | Fern-leaf Begonia | `plants/begonia-bipinnatifida.png` | Pending |
| `begonia-burkilii-silver-form` | *Begonia burkilii "Silver Form"* | Burkill's Begonia Silver Form | `plants/begonia-burkilii-silver-form.png` | Pending |
| `begonia-cleopatrae` | *Begonia cleopatrae* | Cleopatra Begonia | `plants/begonia-cleopatrae.png` | Pending |
| `begonia-conchifolia` | *Begonia conchifolia* | Pond Lily Begonia | `plants/begonia-conchifolia.png` | Pending |
| `begonia-dodsoni` | *Begonia dodsoni* | Dodson's Begonia | `plants/begonia-dodsoni.png` | Pending |
| `begonia-elaeagnifolia` | *Begonia elaeagnifolia* | Elaeagnus-leaf Begonia | `plants/begonia-elaeagnifolia.png` | Pending |
| `begonia-foliosa-var-foliosa` | *Begonia foliosa var. foliosa* | Fern-leaf Begonia | `plants/begonia-foliosa-var-foliosa.png` | Pending |
| `begonia-glabra-bronze` | *Begonia glabra 'Bronze'* | Bronze Climbing Begonia | `plants/begonia-glabra-bronze.png` | Pending |
| `begonia-klemmei` | *Begonia klemmei* | Klemme's Begonia | `plants/begonia-klemmei.png` | Pending |
| `begonia-longiciliata-sizemoreae` | *Begonia longiciliata 'Sizemoreae'* | Fringed Begonia Sizemoreae | `plants/begonia-longiciliata-sizemoreae.png` | Pending |
| `begonia-loranthoides-sp-rhopalocarpa` | *Begonia loranthoides sp. rhopalocarpa* | Loranthoides Begonia | `plants/begonia-loranthoides-sp-rhopalocarpa.png` | Pending |
| `begonia-luzonensis` | *Begonia luzonensis* | Luzon Begonia | `plants/begonia-luzonensis.png` | Pending |
| `begonia-manaus` | *Begonia manaus* | Manaus Begonia | `plants/begonia-manaus.png` | Pending |
| `begonia-maurandiae-blue` | *Begonia maurandiae 'Blue'* | Blue Maurandiae Begonia | `plants/begonia-maurandiae-blue.png` | Pending |
| `begonia-polliloensis` | *Begonia polliloensis* | Pollilo Begonia | `plants/begonia-polliloensis.png` | Pending |
| `begonia-prismatocarpa` | *Begonia prismatocarpa* | Prism-fruit Begonia | `plants/begonia-prismatocarpa.png` | Pending |
| `begonia-pustulata` | *Begonia pustulata* | Blister Begonia | `plants/begonia-pustulata.png` | Pending |
| `begonia-raja` | *Begonia raja* | Raja Begonia | `plants/begonia-raja.png` | Pending |
| `begonia-soli-mutata` | *Begonia soli-mutata* | Sun-changing Begonia | `plants/begonia-soli-mutata.png` | Pending |
| `begonia-sutherlandii-saunders-legacy` | *Begonia sutherlandii 'Saunders Legacy'* | Saunders Legacy Begonia | `plants/begonia-sutherlandii-saunders-legacy.png` | Pending |
| `begonia-thelmae` | *Begonia thelmae* | Thelma's Begonia | `plants/begonia-thelmae.png` | Pending |
| `begonia-turrialbae` | *Begonia turrialbae* | Turrialba Begonia | `plants/begonia-turrialbae.png` | Pending |
| `begonia-variabilis` | *Begonia variabilis* | Variable Begonia | `plants/begonia-variabilis.png` | Pending |
| `cryptanthus-absolute-zero` | *Cryptanthus 'Absolute Zero'* | Absolute Zero Earth Star | `plants/cryptanthus-absolute-zero.png` | Pending |
| `neoregelia-blushing-tiger-puntatissima` | *Neoregelia 'Blushing Tiger x Puntatissima'* | Blushing Tiger x Puntatissima Neoregelia | `plants/neoregelia-blushing-tiger-puntatissima.png` | Pending |
| `neoregelia-cotton-candy` | *Neoregelia 'Cotton Candy'* | Cotton Candy Neoregelia | `plants/neoregelia-cotton-candy.png` | Pending |
| `neoregelia-easter-egg` | *Neoregelia 'Easter Egg'* | Easter Egg Neoregelia | `plants/neoregelia-easter-egg.png` | Pending |
| `neoregelia-fireball` | *Neoregelia 'Fireball'* | Fireball Neoregelia | `plants/neoregelia-fireball.png` | Pending |
| `neoregelia-lilyput-pheasant` | *Neoregelia 'Lilyput x Pheasant'* | Lilyput x Pheasant Neoregelia | `plants/neoregelia-lilyput-pheasant.png` | Pending |
| `neoregelia-mini-skirt` | *Neoregelia 'Mini Skirt'* | Mini Skirt Neoregelia | `plants/neoregelia-mini-skirt.png` | Pending |
| `neoregelia-mojo` | *Neoregelia 'Mojo'* | Mojo Neoregelia | `plants/neoregelia-mojo.png` | Pending |
| `neoregelia-skotaks-matilde` | *Neoregelia 'Skotak's Matilde'* | Skotak's Matilde Neoregelia | `plants/neoregelia-skotaks-matilde.png` | Pending |
| `neoregelia-skotak-mirage` | *Neoregelia 'Skotak Mirage'* | Skotak Mirage Neoregelia | `plants/neoregelia-skotak-mirage.png` | Pending |
| `neoregelia-skotaks-unregistered` | *Neoregelia 'Skotak's Unregistered'* | Skotak's Unregistered Neoregelia | `plants/neoregelia-skotaks-unregistered.png` | Pending |
| `neoregelia-wild-tiger-goode` | *Neoregelia 'Wild Tiger Goode'* | Wild Tiger Goode Neoregelia | `plants/neoregelia-wild-tiger-goode.png` | Pending |
| `geogenanthus-poeppigii` | *Geogenanthus poeppigii* | Seersucker Plant | `plants/geogenanthus-poeppigii.png` | Pending |
| `eleocharis-radicans` | *Eleocharis radicans* | Dwarf Hair Grass | `plants/eleocharis-radicans.png` | Pending |
| `drosera-adelae` | *Drosera adelae* | Lance-Leaf Sundew | `plants/drosera-adelae.png` | Pending |
| `drosera-spatulata` | *Drosera spatulata* | Spoon-Leaf Sundew | `plants/drosera-spatulata.png` | Pending |
| `equisetum-bogotense` | *Equisetum bogotense* | Andean Horsetail | `plants/equisetum-bogotense.png` | Pending |
| `aeschynanthus-longicaulis-black-pagoda` | *Aeschynanthus longicaulis 'Black Pagoda'* | Black Pagoda Lipstick Plant | `plants/aeschynanthus-longicaulis-black-pagoda.png` | Pending |
| `alsobia-dianthiflora` | *Alsobia dianthiflora* | Lace Flower Vine | `plants/alsobia-dianthiflora.png` | Pending |
| `codonanthe-carnosa` | *Codonanthe carnosa* | Codonanthe | `plants/codonanthe-carnosa.png` | Pending |
| `codonanthe-digna` | *Codonanthe digna* | Codonanthe Digna | `plants/codonanthe-digna.png` | Pending |
| `deinostigma-tamiana` | *Deinostigma tamiana* | Miniature Chirita | `plants/deinostigma-tamiana.png` | Pending |
| `episcia-chocolate-velvet` | *Episcia 'Chocolate Velvet'* | Chocolate Velvet Flame Violet | `plants/episcia-chocolate-velvet.png` | Pending |
| `episcia-lilacina` | *Episcia 'Lilacina'* | Lilacina Flame Violet | `plants/episcia-lilacina.png` | Pending |
| `episcia-silver-dust` | *Episcia 'Silver Dust'* | Silver Dust Flame Violet | `plants/episcia-silver-dust.png` | Pending |
| `nautilocalyx-sp` | *Nautilocalyx sp.* | Nautilocalyx | `plants/nautilocalyx-sp.png` | Pending |
| `paradrymonia-campostyla-suriname` | *Paradrymonia campostyla* | Paradrymonia | `plants/paradrymonia-campostyla-suriname.png` | Pending |
| `sinningia-freckles` | *Sinningia 'Freckles'* | Freckles Miniature Sinningia | `plants/sinningia-freckles.png` | Pending |
| `sinningia-prudence-risley` | *Sinningia 'Prudence Risley'* | Prudence Risley Miniature Sinningia | `plants/sinningia-prudence-risley.png` | Pending |
| `crepidomanes-minutum` | *Crepidomanes minutum* | Minute Filmy Fern | `plants/crepidomanes-minutum.png` | Pending |
| `pogostemon-deccanensis` | *Pogostemon deccanensis* | Indian Pogostemon | `plants/pogostemon-deccanensis.png` | Pending |
| `huperzia-sp` | *Huperzia sp.* | Clubmoss / Tassel Fern | `plants/huperzia-sp.png` | Pending |
| `marcgravia-bronze` | *Marcgravia sp. 'Bronze'* | Bronze Marcgravia | `plants/marcgravia-bronze.png` | Pending |
| `marcgravia-dark-brown` | *Marcgravia sp. 'Dark Brown'* | Dark Brown Marcgravia | `plants/marcgravia-dark-brown.png` | Pending |
| `marcgravia-ecuador` | *Marcgravia sp. 'Ecuador'* | Ecuador Marcgravia | `plants/marcgravia-ecuador.png` | Pending |
| `marcgravia-el-coca` | *Marcgravia sp. 'El Coca'* | El Coca Marcgravia | `plants/marcgravia-el-coca.png` | Pending |
| `marcgravia-peru` | *Marcgravia sp. 'Peru'* | Peru Marcgravia | `plants/marcgravia-peru.png` | Pending |
| `marcgravia-puerto-rico` | *Marcgravia sp. 'Puerto Rico'* | Puerto Rico Marcgravia | `plants/marcgravia-puerto-rico.png` | Pending |
| `marcgravia-st-lucia-island` | *Marcgravia sp. 'St Lucia Island'* | St Lucia Island Marcgravia | `plants/marcgravia-st-lucia-island.png` | Pending |
| `marcgravia-sintinesii` | *Marcgravia sintinesii* | Sintines' Marcgravia | `plants/marcgravia-sintinesii.png` | Pending |
| `marcgravia-suriname` | *Marcgravia sp. 'Suriname'* | Suriname Marcgravia | `plants/marcgravia-suriname.png` | Pending |
| `marcgravia-umbellata-red` | *Marcgravia umbellata 'Red'* | Red Umbellata Marcgravia | `plants/marcgravia-umbellata-red.png` | Pending |
| `calvoa-sessiliflora` | *Calvoa sessiliflora* | Calvoa | `plants/calvoa-sessiliflora.png` | Pending |
| `monolena-primulaeflora-red` | *Monolena primulaeflora 'Red'* | Red Monolena | `plants/monolena-primulaeflora-red.png` | Pending |
| `sonerila-neon-lights` | *Sonerila sp. 'Neon Lights'* | Neon Lights Sonerila | `plants/sonerila-neon-lights.png` | Pending |
| `sonerila-cantonensis-vietnam` | *Sonerila cantonensis* | Vietnam Sonerila | `plants/sonerila-cantonensis-vietnam.png` | Pending |
| `ficus-thunbergii` | *Ficus thunbergii* | Thunberg's Fig | `plants/ficus-thunbergii.png` | Pending |
| `ficus-vaccinioides` | *Ficus vaccinioides* | Berry-Leaf Creeping Fig | `plants/ficus-vaccinioides.png` | Pending |
| `ficus-vilosa` | *Ficus villosa* | Velvet Creeping Fig | `plants/ficus-vilosa.png` | Pending |
| `ficus-punctata` | *Ficus punctata* | Spotted Fig | `plants/ficus-punctata.png` | Pending |
| `ficus-pumila-snowflake` | *Ficus pumila 'Snowflake'* | Snowflake Creeping Fig | `plants/ficus-pumila-snowflake.png` | Pending |
| `micranthemum-tweedei` | *Micranthemum tweedei* | Monte Carlo | `plants/micranthemum-tweedei.png` | Pending |
| `anoectochilus-albolineatus` | *Anoectochilus albolineatus* | Silver-Veined Jewel Orchid | `plants/anoectochilus-albolineatus.png` | Pending |
| `anoectochilus-charlottes-web` | *Anoectochilus sp. 'Charlotte's Web'* | Charlotte's Web Jewel Orchid | `plants/anoectochilus-charlottes-web.png` | Pending |
| `anoectochilus-formosanus` | *Anoectochilus formosanus* | Formosan Jewel Orchid | `plants/anoectochilus-formosanus.png` | Pending |
| `masdevallia-auropurpurea` | *Masdevallia auropurpurea* | Gold-Purple Masdevallia | `plants/masdevallia-auropurpurea.png` | Pending |
| `masdevallia-floribunda` | *Masdevallia floribunda* | Floriferous Masdevallia | `plants/masdevallia-floribunda.png` | Pending |
| `masdevallia-nidifica` | *Masdevallia nidifica* | Nest Masdevallia | `plants/masdevallia-nidifica.png` | Pending |
| `pleurothallis-allenii` | *Pleurothallis allenii* | Allen's Pleurothallis | `plants/pleurothallis-allenii.png` | Pending |
| `pleurothallis-costaricensis` | *Pleurothallis costaricensis* | Costa Rican Pleurothallis | `plants/pleurothallis-costaricensis.png` | Pending |
| `pleurothallis-grobyi` | *Pleurothallis grobyi* | Groby's Pleurothallis | `plants/pleurothallis-grobyi.png` | Pending |
| `pleurothallis-rubella` | *Pleurothallis rubella* | Red Pleurothallis | `plants/pleurothallis-rubella.png` | Pending |
| `restrepia-lansburghi` | *Restrepia lansburgii* | Lansburg's Restrepia | `plants/restrepia-lansburghi.png` | Pending |
| `restrepia-muscifera` | *Restrepia muscifera* | Fly-Trap Restrepia | `plants/restrepia-muscifera.png` | Pending |
| `scaphosepalum-dodsoni` | *Scaphosepalum dodsoni* | Dodson's Scaphosepalum | `plants/scaphosepalum-dodsoni.png` | Pending |
| `stelis-argentata` | *Stelis argentata* | Silver Stelis | `plants/stelis-argentata.png` | Pending |
| `zootrophion-sp` | *Zootrophion sp.* | Zootrophion | `plants/zootrophion-sp.png` | Pending |
| `barbosella-hiftzii` | *Barbosella hiftzii* | Barbosella | `plants/barbosella-hiftzii.png` | Pending |
| `bulbophyllum-intersitum` | *Bulbophyllum intersitum* | Bulbophyllum Intersitum | `plants/bulbophyllum-intersitum.png` | Pending |
| `cirrhopetalum-farreri` | *Bulbophyllum farreri* | Farrer's Cirrhopetalum | `plants/cirrhopetalum-farreri.png` | Pending |
| `cirrhopetalum-taiwanese` | *Bulbophyllum sp. 'Taiwanese'* | Taiwanese Cirrhopetalum | `plants/cirrhopetalum-taiwanese.png` | Pending |
| `haerella-odorata` | *Haraella odorata* | Fragrant Haraella | `plants/haerella-odorata.png` | Pending |
| `peperomia-angulata` | *Peperomia angulata* | Beetle Peperomia | `plants/peperomia-angulata.png` | Pending |
| `peperomia-emarginella` | *Peperomia emarginella* | Notched-Leaf Peperomia | `plants/peperomia-emarginella.png` | Pending |
| `peperomia-fagerlindii` | *Peperomia fagerlindii* | Fagerlind's Peperomia | `plants/peperomia-fagerlindii.png` | Pending |
| `peperomia-guttalata` | *Peperomia guttulata* | Raindrop Peperomia | `plants/peperomia-guttalata.png` | Pending |
| `peperomia-pepper-spot` | *Peperomia sp. 'Pepper Spot'* | Pepper Spot Peperomia | `plants/peperomia-pepper-spot.png` | Pending |
| `peperomia-puteolata` | *Peperomia puteolata* | Parallel Peperomia | `plants/peperomia-puteolata.png` | Pending |
| `peperomia-rubella` | *Peperomia rubella* | Itsy-Bitsy Peperomia | `plants/peperomia-rubella.png` | Pending |
| `peperomia-serpens` | *Peperomia serpens* | Vining Peperomia | `plants/peperomia-serpens.png` | Pending |
| `peperomia-taroriana` | *Peperomia taroriana* | Fiji Peperomia | `plants/peperomia-taroriana.png` | Pending |
| `peperomia-tingo-maria` | *Peperomia sp. 'Tingo Maria'* | Tingo Maria Peperomia | `plants/peperomia-tingo-maria.png` | Pending |
| `peperomia-trinervis` | *Peperomia trinervis* | Three-Veined Peperomia | `plants/peperomia-trinervis.png` | Pending |
| `peperomia-turboensis` | *Peperomia turboensis* | Turbo Peperomia | `plants/peperomia-turboensis.png` | Pending |
| `peperomia-verticillata-red-log` | *Peperomia verticillata 'Red Log'* | Red Log Peperomia | `plants/peperomia-verticillata-red-log.png` | Pending |
| `piper-crocatum` | *Piper crocatum* | Ornate Pepper Vine | `plants/piper-crocatum.png` | Pending |
| `bolbitis-heudelotii` | *Bolbitis heudelotii* | African Water Fern | `plants/bolbitis-heudelotii.png` | Pending |
| `bolbitis-heteroclita-cuspidata` | *Bolbitis heteroclita 'Cuspidata'* | Cuspidate Bolbitis | `plants/bolbitis-heteroclita-cuspidata.png` | Pending |
| `lemmaphyllum-microphyllum` | *Lemmaphyllum microphyllum* | Coin-Leaf Fern | `plants/lemmaphyllum-microphyllum.png` | Pending |
| `pleopeltis-percussa` | *Pleopeltis percussa* | Wart Fern | `plants/pleopeltis-percussa.png` | Pending |
| `pyrrosia-nummularifolia` | *Pyrrosia nummularifolia* | Coin-Leaf Tongue Fern | `plants/pyrrosia-nummularifolia.png` | Pending |
| `tectaria-zeilanica` | *Tectaria zeilanica* | Ceylon Tectaria | `plants/tectaria-zeilanica.png` | Pending |
| `actiniopteris-australis` | *Actiniopteris australis* | Palm Fern | `plants/actiniopteris-australis.png` | Pending |
| `hatiora-salicornioides` | *Hatiora salicornioides* | Dancing Bones Cactus | `plants/hatiora-salicornioides.png` | Pending |
| `muehlenbeckia-complexa` | *Muehlenbeckia complexa* | Wire Vine | `plants/muehlenbeckia-complexa.png` | Pending |
| `muehlenbeckia-complexa-variegated` | *Muehlenbeckia complexa 'Variegated'* | Variegated Wire Vine | `plants/muehlenbeckia-complexa-variegated.png` | Pending |
| `selaginella-erythropus-sanguinea` | *Selaginella erythropus 'Sanguinea'* | Red Spike Moss | `plants/selaginella-erythropus-sanguinea.png` | Pending |
| `selaginella-martensii-watsoniana` | *Selaginella martensii 'Watsoniana'* | Silver-Tipped Spike Moss | `plants/selaginella-martensii-watsoniana.png` | Pending |
| `solanum-evolvulifolium` | *Solanum evolvulifolium* | Bindweed-Leaf Nightshade | `plants/solanum-evolvulifolium.png` | Pending |
| `solanum-uleanum` | *Solanum uleanum* | Ule's Nightshade | `plants/solanum-uleanum.png` | Pending |
| `pilea-libanensis-aquamarine` | *Pilea libanensis 'Aquamarine'* | Aquamarine Artillery Plant | `plants/pilea-libanensis-aquamarine.png` | Pending |
| `pilea-pubescens-silver-cloud` | *Pilea pubescens 'Silver Cloud'* | Silver Cloud Pilea | `plants/pilea-pubescens-silver-cloud.png` | Pending |
| `pilea-spruceana` | *Pilea spruceana* | Silver Tree Pilea | `plants/pilea-spruceana.png` | Pending |
| `procris-pulchra` | *Procris pulchra* | Beautiful Procris | `plants/procris-pulchra.png` | Pending |
| `cissus-amazonicus` | *Cissus amazonica* | Amazon Vine | `plants/cissus-amazonicus.png` | Pending |
| `cissus-discolor` | *Cissus discolor* | Rex Begonia Vine | `plants/cissus-discolor.png` | Pending |
