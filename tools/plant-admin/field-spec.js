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
  'begonia', 'bromeliad', 'orchid', 'vine', 'ground-cover', 'foliage',
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
 * (pass the set of OTHER plants' slugs). `knownGlossarySlugs` (optional) enables the
 * inline `[[slug]]` prose-link check on notes/nativeContext — pass the glossary slug
 * set; omit it (e.g. before the glossary has loaded) to skip that check.
 */
function validatePlant(rec, existingSlugs, knownGlossarySlugs) {
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

  // Inline `[[slug]]` prose links must resolve to a glossary term (ADR 0006). The
  // Phase D seed-time throw + glossary.test.ts remain the CI backstop; this flags a
  // typo'd link in-tool. Optional — skipped when the glossary slug set isn't passed.
  if (knownGlossarySlugs) {
    const glossary = knownGlossarySlugs instanceof Set ? knownGlossarySlugs : new Set(knownGlossarySlugs);
    for (const key of ['notes', 'nativeContext']) {
      const text = rec[key];
      if (typeof text !== 'string' || !text) continue;
      const bad = proseLinkSlugs(text).filter((s) => !glossary.has(s));
      if (bad.length && !errors[key]) {
        errors[key] = `Unknown glossary link${bad.length > 1 ? 's' : ''}: ${bad.map((s) => '[[' + s + ']]').join(', ')} — define the term in Terms mode first`;
      }
    }
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

// --- Glossary: the technical-term dictionary (ADR 0006) ----------------------
// Mirrors src/types/glossary.ts rule-for-rule. The eight enum-backed categories
// reuse the vocab arrays above; `concept`/`anatomy` are free-form. The Terms editor
// in index.html renders + validates from these, and the server validates
// authoritatively before writing src/data/glossary.json. KEEP IN SYNC with the app.
const GLOSSARY_CATEGORIES = [
  'light', 'moisture', 'ph', 'growthRate', 'growthHabit',
  'plantType', 'biome', 'substrate', 'concept', 'anatomy', 'pest-disease',
];

// Display labels for the category select + list secondary line. Explicit (not a
// humanize) so `ph` reads "pH". Mirror of GLOSSARY_CATEGORY_LABELS.
const GLOSSARY_CATEGORY_LABELS = {
  light: 'Light', moisture: 'Moisture', ph: 'pH', growthRate: 'Growth rate',
  growthHabit: 'Growth habit', plantType: 'Plant type', biome: 'Biome',
  substrate: 'Substrate', concept: 'Concept', anatomy: 'Anatomy',
  'pest-disease': 'Pest & Disease',
};

// The eight coverage-checked groups — every controlled-vocab value must resolve to
// an entry (src/data/__tests__/glossary.test.ts). concept/anatomy are free-form.
const ENUM_BACKED_CATEGORIES = [
  'light', 'moisture', 'ph', 'growthRate', 'growthHabit', 'plantType', 'biome', 'substrate',
];

// `moderate` is BOTH a moisture level and a growth rate, so its enum-backed slug is
// suffixed; nothing claims a bare `moderate`. Mirror of VOCAB_SLUG_OVERRIDES.
const VOCAB_SLUG_OVERRIDES = {
  'moisture/moderate': 'moderate-moisture',
  'growthRate/moderate': 'moderate-growth',
};

/** The glossary slug for an enum-backed (category, value) — identity except the
 *  disambiguated `moderate` clash. Mirror of `vocabSlug` in src/types/glossary.ts. */
function vocabSlug(category, value) {
  return VOCAB_SLUG_OVERRIDES[`${category}/${value}`] || value;
}

/** category → controlled-vocab values, for the eight enum-backed groups. Reuses the
 *  vocab arrays mirrored above; keys are the glossary category names (NOT plant field
 *  names, e.g. `biome` not `nativeBiome`) so they match GLOSSARY_CATEGORIES. */
const ENUM_VOCAB = {
  light: LIGHT_LEVELS,
  moisture: MOISTURE_LEVELS,
  ph: PH_PREFERENCES,
  growthRate: GROWTH_RATES,
  growthHabit: GROWTH_HABITS,
  plantType: PLANT_TYPES,
  biome: NATIVE_BIOMES,
  substrate: SUBSTRATE_IDS,
};

// Glossary form spec — the GROUPS analog. `seeAlso` uses a new `sluglist` kind: a
// dynamic list of term-slug inputs sharing an autocomplete datalist.
const GLOSSARY_GROUPS = [
  {
    title: 'Term',
    fields: [
      { key: 'term', label: 'Term', kind: 'text', required: true, help: 'Display name — the entry title, e.g. "LECA" or "False bottom". Drives the auto-slug.' },
      { key: 'slug', label: 'Slug (id)', kind: 'text', required: true, slug: true, help: 'Globally-unique key. For an enum-backed category it MUST equal the vocab value (e.g. light → "bright-indirect"); the coverage worklist pre-fills these. Free-form concept/anatomy slugs are yours to choose.' },
      { key: 'category', label: 'Category', kind: 'enum', required: true, options: GLOSSARY_CATEGORIES, help: 'light…substrate are coverage-checked against the app vocab; concept/anatomy are free-form.' },
    ],
  },
  {
    title: 'Definition',
    fields: [
      { key: 'definition', label: 'Definition', kind: 'textarea', required: true, help: '2–4 sentences: a plain definition + a terrarium-specific "why it matters". Must end with . ! or ?' },
      { key: 'seeAlso', label: 'See also', kind: 'sluglist', help: 'Cross-links to related terms, by slug. Each must resolve to an existing term; powers the sheet\'s "see also" swap.' },
    ],
  },
];

/** Flat list of every glossary field, in form order. */
const GLOSSARY_ALL_FIELDS = GLOSSARY_GROUPS.flatMap((g) => g.fields);

/** Canonical write order for a term's keys (mirrors glossary.json). */
const GLOSSARY_WRITE_ORDER = ['slug', 'term', 'category', 'definition', 'seeAlso'];

/** Re-key a term into canonical order, dropping empty optionals (mirrors `canonicalize`). */
function canonicalizeTerm(rec) {
  const out = {};
  for (const key of GLOSSARY_WRITE_ORDER) {
    const v = rec[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[key] = v;
  }
  return out;
}

/** Every slug referenced by a `[[slug]]` / `[[slug|display]]` link in `text`, in
 *  order. Copied from src/logic/glossary-markup.ts so this spec stays self-contained
 *  and injectable into the page. */
function proseLinkSlugs(text) {
  const slugs = [];
  const re = /\[\[([^\]]+?)\]\]/g;
  let m;
  while ((m = re.exec(String(text == null ? '' : text)))) {
    const inner = m[1];
    const pipe = inner.indexOf('|');
    const slug = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    if (slug) slugs.push(slug);
  }
  return slugs;
}

/**
 * Authoritative glossary-term validator — mirror of the CI gate
 * (src/data/__tests__/glossary.test.ts). `otherSlugs` = OTHER terms' slugs (for the
 * uniqueness check); `knownSlugs` = the slugs a `seeAlso` may resolve to (the
 * record's own slug is added here, so passing the other terms' slugs is enough).
 */
function validateTerm(rec, otherSlugs, knownSlugs) {
  const errors = {};
  const others = otherSlugs instanceof Set ? otherSlugs : new Set(otherSlugs || []);
  const known = knownSlugs instanceof Set ? knownSlugs : new Set(knownSlugs || []);

  if (typeof rec.term !== 'string' || !rec.term.trim()) errors.term = 'Term is required';

  if (!rec.category) errors.category = 'Category is required';
  else if (!GLOSSARY_CATEGORIES.includes(rec.category)) errors.category = `Must be one of: ${GLOSSARY_CATEGORIES.join(', ')}`;

  // slug — kebab, unique, and (enum-backed) a real vocab slug.
  const slug = typeof rec.slug === 'string' ? rec.slug : '';
  if (!slug) {
    errors.slug = 'Slug is required';
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = 'Lowercase letters, numbers, single hyphens only';
  } else if (others.has(slug)) {
    errors.slug = `Slug "${slug}" is already used by another term`;
  } else if (ENUM_BACKED_CATEGORIES.includes(rec.category)) {
    const allowed = (ENUM_VOCAB[rec.category] || []).map((value) => vocabSlug(rec.category, value));
    if (!allowed.includes(slug)) {
      errors.slug = `For "${rec.category}" the slug must match a vocab value: ${allowed.join(', ')}`;
    }
  }

  // definition — substantial prose ending in terminal punctuation (mirrors the test).
  const def = typeof rec.definition === 'string' ? rec.definition.trim() : '';
  if (!def) errors.definition = 'Definition is required';
  else if (def.length <= 20) errors.definition = 'Too short — write 2–4 sentences (a definition + why it matters)';
  else if (!/[.!?]$/.test(def)) errors.definition = 'Must end with terminal punctuation (. ! ?)';

  // seeAlso — every entry resolves to a known term (the record's own slug is allowed).
  if (rec.seeAlso !== undefined && rec.seeAlso !== null) {
    if (!Array.isArray(rec.seeAlso)) {
      errors.seeAlso = 'Must be a list of slugs';
    } else {
      const resolvable = new Set(known);
      if (slug) resolvable.add(slug);
      const bad = rec.seeAlso.filter((s) => !resolvable.has(s));
      if (bad.length) errors.seeAlso = `Unknown term${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}`;
    }
  }

  return errors;
}

const SPEC = {
  GROUPS, ALL_FIELDS, WRITE_ORDER,
  LIGHT_LEVELS, MOISTURE_LEVELS, PH_PREFERENCES, GROWTH_RATES, GROWTH_HABITS,
  PLANT_TYPES, NATIVE_BIOMES, RARITIES,
  SUBSTRATE_COMPONENTS, HARDSCAPE_COMPONENTS,
  slugify, validatePlant, canonicalize,
  // --- glossary (ADR 0006) ---
  GLOSSARY_CATEGORIES, GLOSSARY_CATEGORY_LABELS, ENUM_BACKED_CATEGORIES,
  VOCAB_SLUG_OVERRIDES, vocabSlug, ENUM_VOCAB,
  GLOSSARY_GROUPS, GLOSSARY_ALL_FIELDS, GLOSSARY_WRITE_ORDER,
  validateTerm, canonicalizeTerm, proseLinkSlugs,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SPEC;
}
