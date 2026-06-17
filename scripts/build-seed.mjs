/**
 * Phase 3 seed generator — turns the v1 YAML seed-of-record into versioned,
 * camelCased, typed JSON for v2 (`src/data/{plants,containers}.json`).
 *
 * This is the *reproducible* transform: re-run it if the upstream YAML changes
 * (`node scripts/build-seed.mjs`). It applies the decision-4/8/11/12/18 reshapes
 * (see MIGRATION.md "Phase 3"):
 *   - light / soilMoisture: scalar -> { primary, secondary? }  (secondary authored
 *     ONLY where botanically real; primary-only is intentional, decision 4)
 *   - substrateTags: normalized to canonical component ids; wood/rock split out
 *     into hardscapeTags (decision 12 / decision 10)
 *   - rootDepthMinCm / rootDepthMaxCm: reference-only range, authored for all
 *     (decision 12) — NOT a depth driver
 *   - toxicity: free text, toxic/irritant species only (decision 8); blank != safe
 *   - image: static seed path per plant (decision 11); credit/license added when a
 *     real CC source lands (seed-only — never in the export payload)
 *   - nativeContext: optional Tier-3 origin sentence (plan §2.3)
 *
 * The botanical authoring tables below are the human-judgment part of the pass
 * (kept in-repo, reviewable, source-of-record = owner). The seed loader + test
 * (`src/data`) re-validate every emitted record against the zod schemas, so a bad
 * edit here fails CI, not the device.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const V1_DATA = join(ROOT, '..', 'terrarium-app', 'data');
const OUT = join(ROOT, 'src', 'data');

const SCHEMA_VERSION = 1;

// --- Frozen vocabularies (mirror src/data/substrate-components.ts) -----------
// Raw YAML tag string -> canonical id. Anything not listed here fails the build.
const SUBSTRATE_ID = {
  perlite: 'perlite',
  peat: 'peat',
  sphagnum: 'sphagnum',
  sand: 'sand',
  'coco coir': 'coco-coir',
  grit: 'grit',
  'orchid bark': 'orchid-bark',
  pumice: 'pumice',
  mud: 'mud',
};
const HARDSCAPE_ID = { wood: 'wood', rock: 'rock' };

// --- Authoring table 1: secondary LIGHT (decision 4/15) ----------------------
// Tolerable, ADJACENT fallback on [low, medium, bright-indirect, direct].
// Authored only where botanically real — NOT all 67.
const SECONDARY_LIGHT = {
  'philodendron-hederaceum-mini': 'low',
  'epipremnum-pinnatum-mini': 'low',
  'syngonium-podophyllum-mini': 'low',
  'asplenium-nidus': 'low',
  'nephrolepis-duffii': 'low',
  'spathiphyllum-wallisii': 'medium',
  'maranta-leuconeura': 'medium',
  'haworthia-attenuata': 'medium',
  'peperomia-obtusifolia': 'medium',
  'ficus-pumila': 'medium',
  'cryptanthus-bivittatus': 'medium',
  'tradescantia-zebrina': 'medium',
  'rhipsalis-baccifera': 'medium',
  'pilea-peperomioides': 'medium',
  'drosera-capensis': 'direct',
  'echeveria-elegans': 'bright-indirect',
  'sedum-rubrotinctum': 'bright-indirect',
};

// --- Authoring table 2: secondary MOISTURE (decision 4/15) -------------------
// Adjacent fallback on [dry, moderate, moist, wet]. Sparser than light — a
// moisture miss is closer to lethal, so authored only where genuinely tolerated.
const SECONDARY_MOISTURE = {
  'spathiphyllum-wallisii': 'moderate',
  'nephrolepis-duffii': 'moderate',
  'microsorum-musifolium': 'moderate',
  'microsorum-pteropus': 'moist',
  'davallia-fejeensis': 'moist',
  'ficus-pumila': 'moist',
  'peperomia-caperata': 'dry',
  'peperomia-obtusifolia': 'dry',
  'bucephalandra-sp-mini': 'moist',
  'anubias-nana-petite': 'moist',
};

// --- Authoring table 3: toxicity free text (decision 8) ----------------------
// Toxic/irritant species ONLY. Blank/absent = "no note authored", NEVER "safe".
// First-pass drafts from standard references (ASPCA-level); owner = source of record.
const BEGONIA_TOX =
  'Begonias contain soluble calcium oxalates, most concentrated in the tubers; ingestion can cause mouth irritation, drooling, and vomiting in cats and dogs.';
const TRADESCANTIA_TOX =
  'The sap causes contact dermatitis in pets and can irritate sensitive skin in people; ingestion may cause mild digestive upset. Listed toxic to cats and dogs.';
const TOXICITY = {
  'philodendron-hederaceum-mini':
    'Contains insoluble calcium oxalate crystals — chewing or ingesting causes intense mouth and throat irritation, drooling, and vomiting in pets and people. Keep away from curious pets and children.',
  'syngonium-podophyllum-mini':
    'Foliage and sap carry calcium oxalate crystals; ingestion irritates the mouth and digestive tract and the sap can irritate skin. Toxic to cats and dogs.',
  'epipremnum-pinnatum-mini':
    'Pothos contains insoluble calcium oxalates; ingestion causes oral irritation, drooling, and vomiting. Toxic to cats and dogs.',
  'spathiphyllum-wallisii':
    'Peace lily contains insoluble calcium oxalate crystals; ingestion irritates the mouth and throat and causes drooling and vomiting. Toxic to cats and dogs.',
  'rhaphidophora-tetrasperma':
    'An aroid containing calcium oxalate crystals; ingestion irritates the mouth and digestive tract. Toxic to cats and dogs.',
  'anthurium-scandens':
    'An aroid containing calcium oxalate crystals; sap can irritate skin and ingestion irritates the mouth and gut. Toxic to cats and dogs.',
  'senecio-rowleyanus':
    'String of pearls is toxic if ingested — causing drooling, vomiting, and lethargy in pets — and the sap can irritate skin. Mildly toxic to people.',
  'crassula-ovata-mini':
    'Jade is toxic to cats and dogs; ingestion can cause vomiting, lethargy, and incoordination. Keep away from pets.',
  'ficus-pumila':
    'Ficus sap (a milky latex) can irritate skin and the mouth; ingestion may cause mild digestive upset. Toxic to cats and dogs.',
  'begonia-rex': BEGONIA_TOX,
  'begonia-maculata': BEGONIA_TOX,
  'begonia-pavonina': BEGONIA_TOX,
  'tradescantia-zebrina': TRADESCANTIA_TOX,
  'tradescantia-fluminensis': TRADESCANTIA_TOX,
};

// --- Authoring table 4: root-depth range, REFERENCE-ONLY (decision 12) -------
// Sortable cm range, authored for all. NOT wired into depth math (stays
// maxHeightCm-driven, oracle parity). Heuristic: ~15-40% of mature height, with
// shallow overrides for mosses and hardscape-mounted epiphytes; succulents capped.
const MOUNTED_EPIPHYTES = new Set([
  'fissidens-fontanus',
  'bucephalandra-sp-mini',
  'anubias-nana-petite',
  'vesicularia-dubyana',
  'microsorum-pteropus',
  'miniature-orchid',
]);
const MOSS_LIKE = new Set([
  'leucobryum-glaucum',
  'taxiphyllum-barbieri',
  'selaginella-uncinata',
  'selaginella-kraussiana',
  'soleirolia-soleirolii',
  'soleirolia-soleirolii-minor',
  'hypnum-moss',
  'dicranum-scoparium',
]);
function rootDepthRange(slug, plantType, maxHeightCm) {
  if (MOUNTED_EPIPHYTES.has(slug)) return [1, 3]; // root on hardscape, not substrate
  if (plantType === 'moss' || MOSS_LIKE.has(slug)) return [2, 4];
  let min = Math.max(2, Math.round(maxHeightCm * 0.15));
  let max = Math.round(maxHeightCm * 0.4);
  if (plantType === 'succulent') max = Math.min(max, 10);
  max = Math.min(max, 20);
  if (max <= min) max = min + 2;
  return [min, max];
}

// --- Authoring table 5: native context sentence, OPTIONAL (plan §2.3) --------
// Authored only where origin is confidently known; blank elsewhere is fine.
const NATIVE_CONTEXT = {
  'fittonia-albivenis':
    'Native to the rainforest understorey of Peru and neighbouring South America, carpeting damp, shaded forest floors.',
  'selaginella-uncinata':
    'A spikemoss from the humid subtropical forests of southern China.',
  'soleirolia-soleirolii':
    'Native to shaded, damp rocks on islands of the western Mediterranean.',
  'maranta-leuconeura':
    'Native to the humid tropical rainforests of Brazil, on the shaded forest floor.',
  'calathea-ornata':
    'From the warm, humid rainforests of Colombia and Ecuador, in deep shade beneath the canopy.',
  'adiantum-raddianum':
    'From humid, shaded ravines and waterfall splash zones in tropical South America.',
  'asplenium-nidus':
    'An epiphytic fern of tropical Asian and Pacific rainforests, perched in the forks of canopy trees.',
  'microsorum-pteropus':
    'An aquatic fern from the streams and riverbanks of Southeast Asia, attached to rocks and wood.',
  'cryptanthus-bivittatus':
    'A terrestrial bromeliad from the shaded forest floors of eastern Brazil.',
  'haworthia-attenuata':
    'From shaded, rocky ground in the Eastern Cape of South Africa, often sheltered under shrubs.',
  'echeveria-elegans':
    'From semi-arid rocky outcrops in the highlands of Mexico, in bright sun and fast-draining ground.',
  'pilea-peperomioides':
    'Native to the forested foothills of the Himalayas in Yunnan, China.',
  'drosera-capensis':
    "From the winter-rainfall fynbos of South Africa's Western Cape, in permanently damp, nutrient-poor seeps.",
  'nepenthes-ventricosa':
    'A highland pitcher plant endemic to the Philippines, on mossy mountain slopes in cool, humid cloud forest.',
  'pinguicula-moranensis':
    'Native to rocky, seasonally dry slopes in the mountains of Mexico and Central America.',
  'rhaphidophora-tetrasperma':
    'From the rainforests of southern Thailand and Malaysia, climbing tree trunks toward the light.',
  'anthurium-scandens':
    'A small epiphytic aroid of Central and South American rainforests, perched on branches and trunks.',
  'spathiphyllum-wallisii':
    'Native to the humid rainforest floor of Central and South America.',
  'begonia-pavonina':
    'From the dim understorey of Malaysian montane rainforest, where its leaves shimmer blue in low light.',
  'senecio-rowleyanus':
    'Native to the dry scrublands of south-western Africa, trailing over rock in the shade of larger plants.',
  'lithops-sp':
    'From the arid gravel plains of southern Africa, mimicking surrounding stones to escape grazing.',
  'mammillaria-gracilis': 'Native to arid limestone hills in central Mexico.',
  'sedum-morganianum':
    'From shaded cliffs in southern Mexico, where its stems trail down rock faces.',
  'rhipsalis-baccifera':
    'An epiphytic jungle cactus of tropical American rainforests, dangling from tree branches.',
  'ficus-pumila':
    'From the forests and rocky slopes of East Asia, climbing tree trunks and walls.',
};

// --- helpers -----------------------------------------------------------------
function foldNotes(s) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s;
}

function transformPlant(p) {
  const substrateTags = [];
  const hardscapeTags = [];
  for (const raw of p.substrate_tags ?? []) {
    if (raw in SUBSTRATE_ID) substrateTags.push(SUBSTRATE_ID[raw]);
    else if (raw in HARDSCAPE_ID) hardscapeTags.push(HARDSCAPE_ID[raw]);
    else throw new Error(`${p.slug}: unknown substrate material "${raw}" (vocab is frozen — decision 12)`);
  }

  const light = { primary: p.light };
  if (SECONDARY_LIGHT[p.slug]) light.secondary = SECONDARY_LIGHT[p.slug];
  const soilMoisture = { primary: p.soil_moisture };
  if (SECONDARY_MOISTURE[p.slug]) soilMoisture.secondary = SECONDARY_MOISTURE[p.slug];

  const [rootDepthMinCm, rootDepthMaxCm] = rootDepthRange(
    p.slug,
    p.plant_type,
    p.max_height_cm,
  );

  const out = {
    slug: p.slug,
    commonName: p.common_name,
    scientificName: p.scientific_name,
    light,
    soilMoisture,
    humidityPctRange: [p.humidity_pct_range[0], p.humidity_pct_range[1]],
    tempCRange: [p.temp_c_range[0], p.temp_c_range[1]],
    maxHeightCm: p.max_height_cm,
    rootDepthMinCm,
    rootDepthMaxCm,
    phPreference: p.ph_preference ?? null,
    growthRate: p.growth_rate,
    substrateTags,
    closedTerrariumOk: p.closed_terrarium_ok,
    openTerrariumOk: p.open_terrarium_ok,
    difficulty: p.difficulty,
    image: `plants/${p.slug}.png`,
  };
  if (hardscapeTags.length) out.hardscapeTags = hardscapeTags;
  if (p.growth_habit) out.growthHabit = p.growth_habit;
  if (p.plant_type) out.plantType = p.plant_type;
  if (p.native_biome) out.nativeBiome = p.native_biome;
  if (TOXICITY[p.slug]) out.toxicity = TOXICITY[p.slug];
  if (NATIVE_CONTEXT[p.slug]) out.nativeContext = NATIVE_CONTEXT[p.slug];
  if (p.notes) out.notes = foldNotes(p.notes);
  return out;
}

function transformContainer(c) {
  return {
    slug: c.slug,
    name: c.name,
    volumeL: c.volume_l,
    opening: c.opening,
    dimensionsCm: c.dimensions_cm,
    shape: c.shape ?? 'rectangular',
    suitableFor: c.suitable_for,
  };
}

// --- run ---------------------------------------------------------------------
const plantsRaw = parseYaml(readFileSync(join(V1_DATA, 'plants.yaml'), 'utf8')).plants;
const containersRaw = parseYaml(
  readFileSync(join(V1_DATA, 'containers.yaml'), 'utf8'),
).containers;

const plants = plantsRaw.map(transformPlant);
const containers = containersRaw.map(transformContainer);

writeFileSync(
  join(OUT, 'plants.json'),
  JSON.stringify({ schemaVersion: SCHEMA_VERSION, plants }, null, 2) + '\n',
);
writeFileSync(
  join(OUT, 'containers.json'),
  JSON.stringify({ schemaVersion: SCHEMA_VERSION, containers }, null, 2) + '\n',
);

// --- summary (sanity for the orchestrating chat) -----------------------------
const secLight = plants.filter((p) => p.light.secondary).length;
const secMoist = plants.filter((p) => p.soilMoisture.secondary).length;
const tox = plants.filter((p) => p.toxicity).length;
const hard = plants.filter((p) => p.hardscapeTags).length;
const ctx = plants.filter((p) => p.nativeContext).length;
console.log(`plants: ${plants.length}  containers: ${containers.length}`);
console.log(
  `secondary light: ${secLight}  secondary moisture: ${secMoist}  toxicity: ${tox}  hardscape: ${hard}  nativeContext: ${ctx}`,
);
console.log('wrote src/data/plants.json + src/data/containers.json');
