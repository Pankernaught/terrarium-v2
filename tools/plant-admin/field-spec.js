/**
 * Single source of truth for the plant-admin form: field definitions, the frozen
 * vocabularies, the canonical write order, and the authoritative validator.
 *
 * This file is `require()`d by the server (for authoritative server-side
 * validation before any write) AND injected verbatim into the browser page (so
 * the form is generated from the exact same spec and on-blur validation matches
 * the server rule-for-rule). One spec, two runtimes — no drift.
 *
 * The vocabularies below MIRROR the app's frozen sources and must stay in sync:
 *   - enums:           src/types/plant.ts
 *   - substrate/hardscape vocab: src/data/substrate-components.ts
 * If you add an enum value or a substrate component there, mirror it here.
 *
 * `image` is intentionally NOT a form field: src/data/__tests__/images.test.ts
 * enforces `image === "plants/<slug>.png"`, so the server derives it from the slug.
 */

// --- Controlled vocabularies (mirror of the app's frozen sources) ------------
const LIGHT_LEVELS = ['low', 'medium', 'bright-indirect', 'direct'];
const MOISTURE_LEVELS = ['dry', 'moderate', 'moist', 'wet'];
const PH_PREFERENCES = ['acidic', 'neutral', 'alkaline'];
const GROWTH_RATES = ['slow', 'moderate', 'fast'];
const GROWTH_HABITS = ['trailing', 'upright', 'rosette', 'creeping', 'climbing', 'mounding'];
const PLANT_TYPES = [
  'fern', 'fern-ally', 'moss', 'succulent', 'carnivorous', 'aroid',
  'begonia', 'orchid', 'vine', 'ground-cover', 'foliage',
];
const NATIVE_BIOMES = [
  'tropical', 'subtropical', 'temperate', 'montane', 'arid', 'mediterranean', 'aquatic',
];
const RARITIES = ['common', 'uncommon', 'rare'];

const SUBSTRATE_COMPONENTS = [
  { id: 'perlite', label: 'Perlite' },
  { id: 'peat', label: 'Peat' },
  { id: 'sphagnum', label: 'Sphagnum moss' },
  { id: 'sand', label: 'Sand' },
  { id: 'coco-coir', label: 'Coco coir' },
  { id: 'grit', label: 'Grit' },
  { id: 'orchid-bark', label: 'Orchid bark' },
  { id: 'pumice', label: 'Pumice' },
  { id: 'mud', label: 'Mud' },
  { id: 'potting-soil', label: 'Potting soil' },
  { id: 'worm-castings', label: 'Worm castings' },
  { id: 'vermiculite', label: 'Vermiculite' },
  { id: 'leca', label: 'LECA' },
];
const HARDSCAPE_COMPONENTS = [
  { id: 'wood', label: 'Wood' },
  { id: 'rock', label: 'Rock' },
];
const SUBSTRATE_IDS = SUBSTRATE_COMPONENTS.map((c) => c.id);
const HARDSCAPE_IDS = HARDSCAPE_COMPONENTS.map((c) => c.id);

// --- Field spec --------------------------------------------------------------
// `kind` drives both rendering and validation:
//   text | textarea | number | enum | bool | requirement | range | multi | kv
// `required` mirrors seedPlantSchema. `min`/`max` bound numbers; `int` forces
// integers. `options` lists enum/multi choices. `help` is shown under the field.
const GROUPS = [
  {
    title: 'Identity',
    fields: [
      { key: 'commonName', label: 'Common name', kind: 'text', required: true, help: 'e.g. Nerve Plant' },
      { key: 'scientificName', label: 'Scientific name', kind: 'text', required: true, help: 'Latin binomial. Drives the auto-slug.' },
      { key: 'slug', label: 'Slug (id)', kind: 'text', required: true, slug: true, help: 'Primary key. Auto-generated from the scientific name; override only if needed. Lowercase, hyphenated.' },
    ],
  },
  {
    title: 'Light & moisture',
    fields: [
      { key: 'light', label: 'Light', kind: 'requirement', required: true, options: LIGHT_LEVELS, help: 'Primary = happiest condition. Secondary = a tolerable adjacent fallback (optional).' },
      { key: 'soilMoisture', label: 'Soil moisture', kind: 'requirement', required: true, options: MOISTURE_LEVELS },
    ],
  },
  {
    title: 'Environment',
    fields: [
      { key: 'humidityPctRange', label: 'Humidity %', kind: 'range', required: true, min: 0, max: 100, int: true, help: 'min – max, 0–100.' },
      { key: 'tempCRange', label: 'Temperature °C', kind: 'range', required: true, min: -10, max: 50, help: 'min – max, in Celsius.' },
      { key: 'soilPhMin', label: 'Soil pH min', kind: 'number', min: 0, max: 14, help: 'Reference range (optional).' },
      { key: 'soilPhMax', label: 'Soil pH max', kind: 'number', min: 0, max: 14 },
      { key: 'phPreference', label: 'pH preference', kind: 'enum', options: PH_PREFERENCES, help: 'Scored categorical band (optional).' },
    ],
  },
  {
    title: 'Size & growth',
    fields: [
      { key: 'maxHeightCm', label: 'Max height cm', kind: 'number', required: true, min: 0, help: 'Mature height — drives substrate depth math.' },
      { key: 'heightMinCm', label: 'Min height cm', kind: 'number', min: 0, help: 'Optional. Must be ≤ max height.' },
      { key: 'spreadMinCm', label: 'Spread min cm', kind: 'number', min: 0 },
      { key: 'spreadMaxCm', label: 'Spread max cm', kind: 'number', min: 0 },
      { key: 'rootDepthMinCm', label: 'Root depth min cm', kind: 'number', required: true, min: 0, help: 'Reference-only range (not a depth driver). Required for every shipped plant.' },
      { key: 'rootDepthMaxCm', label: 'Root depth max cm', kind: 'number', required: true, min: 0 },
      { key: 'growthRate', label: 'Growth rate', kind: 'enum', required: true, options: GROWTH_RATES },
      { key: 'growthHabit', label: 'Growth habit', kind: 'enum', options: GROWTH_HABITS },
    ],
  },
  {
    title: 'Classification',
    fields: [
      { key: 'plantType', label: 'Plant type', kind: 'enum', options: PLANT_TYPES },
      { key: 'nativeBiome', label: 'Native biome', kind: 'enum', options: NATIVE_BIOMES },
      { key: 'rarity', label: 'Rarity', kind: 'enum', options: RARITIES },
    ],
  },
  {
    title: 'Terrarium fit',
    fields: [
      { key: 'closedTerrariumOk', label: 'OK in closed terrarium', kind: 'bool', required: true },
      { key: 'openTerrariumOk', label: 'OK in open terrarium', kind: 'bool', required: true },
      { key: 'difficulty', label: 'Difficulty (1–5)', kind: 'number', required: true, min: 1, max: 5, int: true },
    ],
  },
  {
    title: 'Safety & notes',
    fields: [
      { key: 'toxicity', label: 'Toxicity note', kind: 'textarea', help: 'Toxic / irritant species ONLY. Blank ≠ "safe" — never written as a safety claim.' },
      { key: 'nativeContext', label: 'Native context', kind: 'textarea', help: 'One short origin sentence (Tier-3 view).' },
      { key: 'notes', label: 'Care notes', kind: 'textarea' },
      { key: 'specialNotes', label: 'Special notes (key/value)', kind: 'kv', help: 'Open key/value pairs for plant-specific care details.' },
      { key: 'sources', label: 'Sources', kind: 'links', help: 'Reference links for this plant\'s info. Add as many as you like. URL is required; label is optional (the app falls back to the site host).' },
      { key: 'substrateTags', label: 'Substrate components', kind: 'multi', options: SUBSTRATE_COMPONENTS, vocab: SUBSTRATE_IDS, help: 'Optional. Used to generate a build-guide ingredient hint. Charcoal is a drainage layer, not a substrate component.' },
      { key: 'hardscapeTags', label: 'Hardscape (epiphytes only)', kind: 'multi', options: HARDSCAPE_COMPONENTS, vocab: HARDSCAPE_IDS, help: 'Only for plants that mount on wood or rock.' },
    ],
  },
  {
    title: 'Image',
    fields: [
      { key: 'imageCredit', label: 'Image credit', kind: 'text', help: 'Required by CI if the image is CC-BY / CC-BY-SA licensed.' },
      { key: 'imageLicense', label: 'Image license', kind: 'text', help: 'e.g. CC-BY-4.0. Leave blank for placeholder/own photo. Never -NC or -ND.' },
    ],
  },
];

/** Flat list of every field spec, in form order. */
const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);

/**
 * Canonical write order for a record's keys. Untouched records keep their
 * original key order (the server never re-serializes them); new/edited records
 * are written in this order.
 */
const WRITE_ORDER = [
  'slug', 'commonName', 'scientificName',
  'light', 'soilMoisture',
  'humidityPctRange', 'tempCRange',
  'maxHeightCm', 'heightMinCm', 'spreadMinCm', 'spreadMaxCm',
  'rootDepthMinCm', 'rootDepthMaxCm',
  'soilPhMin', 'soilPhMax', 'phPreference',
  'growthRate', 'substrateTags', 'hardscapeTags',
  'closedTerrariumOk', 'openTerrariumOk', 'difficulty',
  'image',
  'growthHabit', 'plantType', 'nativeBiome', 'rarity',
  'toxicity', 'nativeContext', 'notes',
  'imageCredit', 'imageLicense', 'specialNotes', 'sources',
];

/** Lowercase, hyphenate, strip to [a-z0-9-]. Mirrors the seed slug convention. */
function slugify(scientificName) {
  return String(scientificName || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/** True for a syntactically valid http(s) URL. Mirrors the app's `z.string().url()`. */
function isHttpUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Authoritative validator. Returns `{ field: message }` for every problem; an
 * empty object means valid. Used by the server before writing and by the client
 * on blur / before submit. `existingSlugs` lets the caller flag a duplicate slug
 * (pass the set of OTHER plants' slugs).
 */
function validatePlant(rec, existingSlugs) {
  const errors = {};
  const others = existingSlugs instanceof Set ? existingSlugs : new Set(existingSlugs || []);

  for (const f of ALL_FIELDS) {
    const v = rec[f.key];
    const present = v !== undefined && v !== null && v !== '';

    if (f.kind === 'requirement') {
      if (!v || !v.primary) {
        if (f.required) errors[f.key] = `${f.label} primary is required`;
        continue;
      }
      if (!f.options.includes(v.primary)) errors[f.key] = `Invalid primary value`;
      else if (v.secondary && !f.options.includes(v.secondary)) errors[f.key] = `Invalid secondary value`;
      continue;
    }

    if (f.kind === 'range') {
      const arr = Array.isArray(v) ? v : null;
      const hasBoth = arr && isNum(arr[0]) && isNum(arr[1]);
      if (!hasBoth) {
        if (f.required) errors[f.key] = `${f.label} needs a min and a max`;
        continue;
      }
      const [lo, hi] = arr;
      if (f.min !== undefined && (lo < f.min || hi < f.min)) errors[f.key] = `Values must be ≥ ${f.min}`;
      else if (f.max !== undefined && (lo > f.max || hi > f.max)) errors[f.key] = `Values must be ≤ ${f.max}`;
      else if (lo > hi) errors[f.key] = `Min must be ≤ max`;
      else if (f.int && (!Number.isInteger(lo) || !Number.isInteger(hi))) errors[f.key] = `Whole numbers only`;
      continue;
    }

    if (f.kind === 'multi') {
      if (!present) continue;
      if (!Array.isArray(v)) { errors[f.key] = `Must be a list`; continue; }
      const bad = v.filter((t) => !f.vocab.includes(t));
      if (bad.length) errors[f.key] = `Outside frozen vocab: ${bad.join(', ')}`;
      continue;
    }

    if (f.kind === 'links') {
      if (!present) continue;
      if (!Array.isArray(v)) { errors[f.key] = `Must be a list of links`; continue; }
      for (const item of v) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) { errors[f.key] = `Each source needs a URL`; break; }
        if (!isHttpUrl(item.url)) { errors[f.key] = `Each source needs a valid http(s) URL`; break; }
        if (item.label !== undefined && item.label !== null && typeof item.label !== 'string') { errors[f.key] = `Labels must be text`; break; }
      }
      continue;
    }

    if (f.kind === 'kv') {
      if (!present) continue;
      if (typeof v !== 'object' || Array.isArray(v)) { errors[f.key] = `Must be key/value pairs`; continue; }
      for (const [k, val] of Object.entries(v)) {
        if (!k.trim()) { errors[f.key] = `Every note needs a key`; break; }
        if (typeof val !== 'string') { errors[f.key] = `Values must be text`; break; }
      }
      continue;
    }

    if (!present) {
      if (f.required) errors[f.key] = `${f.label} is required`;
      continue;
    }

    if (f.kind === 'number') {
      if (!isNum(v)) { errors[f.key] = `Must be a number`; continue; }
      if (f.int && !Number.isInteger(v)) errors[f.key] = `Whole number only`;
      else if (f.min !== undefined && v < f.min) errors[f.key] = `Must be ≥ ${f.min}`;
      else if (f.max !== undefined && v > f.max) errors[f.key] = `Must be ≤ ${f.max}`;
      continue;
    }

    if (f.kind === 'enum') {
      if (!f.options.includes(v)) errors[f.key] = `Must be one of: ${f.options.join(', ')}`;
      continue;
    }

    if (f.kind === 'bool') {
      if (typeof v !== 'boolean') errors[f.key] = `Must be true or false`;
      continue;
    }

    if (f.kind === 'text' || f.kind === 'textarea') {
      if (typeof v !== 'string') errors[f.key] = `Must be text`;
      else if (f.slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v)) errors[f.key] = `Lowercase letters, numbers, single hyphens only`;
    }
  }

  // Cross-field rules.
  if (isNum(rec.heightMinCm) && isNum(rec.maxHeightCm) && rec.heightMinCm > rec.maxHeightCm) {
    errors.heightMinCm = errors.heightMinCm || `Min height must be ≤ max height`;
  }
  if (isNum(rec.spreadMinCm) && isNum(rec.spreadMaxCm) && rec.spreadMinCm > rec.spreadMaxCm) {
    errors.spreadMinCm = errors.spreadMinCm || `Spread min must be ≤ spread max`;
  }
  if (isNum(rec.rootDepthMinCm) && isNum(rec.rootDepthMaxCm) && rec.rootDepthMinCm > rec.rootDepthMaxCm) {
    errors.rootDepthMinCm = errors.rootDepthMinCm || `Root depth min must be ≤ max`;
  }
  if (isNum(rec.soilPhMin) && isNum(rec.soilPhMax) && rec.soilPhMin > rec.soilPhMax) {
    errors.soilPhMin = errors.soilPhMin || `pH min must be ≤ pH max`;
  }
  if (rec.slug && others.has(rec.slug)) {
    errors.slug = `Slug "${rec.slug}" is already used by another plant`;
  }

  return errors;
}

/** Re-key a record into canonical WRITE_ORDER, dropping empty optionals. */
function canonicalize(rec) {
  const out = {};
  for (const key of WRITE_ORDER) {
    const v = rec[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (key === 'specialNotes' && v && Object.keys(v).length === 0) continue;
    out[key] = v;
  }
  return out;
}

const SPEC = {
  GROUPS, ALL_FIELDS, WRITE_ORDER,
  LIGHT_LEVELS, MOISTURE_LEVELS, PH_PREFERENCES, GROWTH_RATES, GROWTH_HABITS,
  PLANT_TYPES, NATIVE_BIOMES, RARITIES,
  SUBSTRATE_COMPONENTS, HARDSCAPE_COMPONENTS,
  slugify, validatePlant, canonicalize,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SPEC;
}
