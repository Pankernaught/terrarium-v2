#!/usr/bin/env node
/**
 * plants-query — a zero-dependency CLI for reading the seed plant database.
 *
 * Built for humans and AI assistants to inspect `src/data/plants.json` without
 * loading the app: list / filter / look up plants, pull a single field, or dump
 * prose (notes, descriptions) for bulk review or rewriting.
 *
 *   node tools/plants-query.mjs <command> [args] [flags]
 *   npm run plants -- <command> [args] [flags]
 *
 * Run with no command (or `help`) for full usage. This file is the source of
 * truth for behaviour; the companion guide lives at tools/plants-query.md.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(HERE, '..', 'src', 'data', 'plants.json');

/** Fields shown by `list`/`search` when no `--fields` is given (prose-first). */
const DEFAULT_FIELDS = ['commonName', 'scientificName', 'notes', 'nativeContext'];

// --- data load --------------------------------------------------------------

function loadPlants() {
  let raw;
  try {
    raw = readFileSync(DATA_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${DATA_PATH}: ${err.message}`);
  }
  const db = JSON.parse(raw);
  if (!Array.isArray(db.plants)) fail('plants.json has no "plants" array');
  return db.plants;
}

// --- small utilities --------------------------------------------------------

function fail(msg) {
  process.stderr.write(`plants-query: ${msg}\n`);
  process.exit(1);
}

/** Resolve a dot-path (`light.primary`, `tempCRange.0`) against an object. */
function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Loose, case-insensitive equality. Arrays match if any element matches. */
function looseEq(actual, value) {
  if (Array.isArray(actual)) return actual.some((a) => looseEq(a, value));
  if (typeof actual === 'boolean') return String(actual) === value.toLowerCase();
  if (typeof actual === 'number') return Number(value) === actual;
  return String(actual ?? '').toLowerCase() === value.toLowerCase();
}

const OP_RE = /^([\w.[\]]+)\s*(>=|<=|!=|~|=|<|>)\s*(.*)$/;

/** Parse `key=value`, `difficulty<=3`, `scientificName~Begonia`, etc. */
function parseFilter(token) {
  const m = OP_RE.exec(token);
  if (!m) fail(`bad filter "${token}" — expected key=value, key<=n, key~text, …`);
  return { path: m[1], op: m[2], value: m[3] };
}

function matches(plant, { path, op, value }) {
  const actual = getPath(plant, path);
  switch (op) {
    case '=':
      return looseEq(actual, value);
    case '!=':
      return !looseEq(actual, value);
    case '~':
      return String(actual ?? '')
        .toLowerCase()
        .includes(value.toLowerCase()) ||
        (Array.isArray(actual) &&
          actual.some((a) => String(a).toLowerCase().includes(value.toLowerCase())));
    case '<':
      return Number(actual) < Number(value);
    case '<=':
      return Number(actual) <= Number(value);
    case '>':
      return Number(actual) > Number(value);
    case '>=':
      return Number(actual) >= Number(value);
    default:
      return false;
  }
}

/** True if `term` appears anywhere in the plant's serialized values. */
function deepContains(plant, term) {
  return JSON.stringify(plant).toLowerCase().includes(term.toLowerCase());
}

/** Find one plant by exact slug, then by fuzzy name. Returns {plant} or {candidates}. */
function resolvePlant(plants, query) {
  const q = query.toLowerCase();
  const bySlug = plants.find((p) => p.slug.toLowerCase() === q);
  if (bySlug) return { plant: bySlug };

  const fuzzy = plants.filter(
    (p) =>
      p.slug.toLowerCase().includes(q) ||
      p.commonName.toLowerCase().includes(q) ||
      p.scientificName.toLowerCase().includes(q),
  );
  if (fuzzy.length === 1) return { plant: fuzzy[0] };
  return { candidates: fuzzy };
}

/** Flags that take a value — accepted as `--flag=value` or `--flag value`. */
const VALUE_FLAGS = new Set(['fields']);

/** Split argv into positional args, `key OP value` filters, and `--flags`. */
function parseArgs(argv) {
  const positional = [];
  const filters = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const k = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      if (eq !== -1) flags[k] = arg.slice(eq + 1);
      else if (VALUE_FLAGS.has(k) && i + 1 < argv.length) flags[k] = argv[++i];
      else flags[k] = true;
    } else if (OP_RE.test(arg) && !/^[\w-]+$/.test(arg)) {
      filters.push(parseFilter(arg));
    } else {
      positional.push(arg);
    }
  }
  return { positional, filters, flags };
}

// --- rendering --------------------------------------------------------------

function project(plant, fields) {
  const out = { slug: plant.slug };
  for (const f of fields) {
    const v = getPath(plant, f);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

function renderTextValue(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function renderPlantText(plant, fields) {
  const lines = [`${plant.commonName} — ${plant.scientificName}  [${plant.slug}]`];
  for (const f of fields) {
    if (f === 'commonName' || f === 'scientificName') continue;
    const v = getPath(plant, f);
    if (v === undefined || v === null || v === '') continue;
    lines.push(`${f}: ${renderTextValue(v)}`);
  }
  return lines.join('\n');
}

function outputList(plants, fields, flags) {
  if (flags.count) {
    process.stdout.write(`${plants.length}\n`);
    return;
  }
  process.stderr.write(`# ${plants.length} plant(s)\n`);
  if (flags.text) {
    process.stdout.write(plants.map((p) => renderPlantText(p, fields)).join('\n\n---\n\n') + '\n');
  } else {
    const data = flags.full ? plants : plants.map((p) => project(p, fields));
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}

// --- commands ---------------------------------------------------------------

const USAGE = `plants-query — read the seed plant database (${'src/data/plants.json'})

Usage:
  node tools/plants-query.mjs <command> [args] [flags]
  npm run plants -- <command> [args] [flags]

Commands:
  list [filters]            List plants (optionally filtered). Default fields:
                            ${DEFAULT_FIELDS.join(', ')}.
  get <slug|name>           Full record for one plant (exact slug, else fuzzy name).
  field <slug|name> <path>  One field of one plant (e.g. field fittonia notes).
  search <term>             Plants whose data contains <term> anywhere.
  schema                    List every field, how many plants have it, and its type.
  help                      Show this message.

Filters (AND-chained, repeatable):
  key=value      loose equality (arrays match if any element matches)
  key!=value     not equal
  key~text       substring match (great for genus: scientificName~Begonia)
  key<=n  key<n  key>=n  key>n   numeric comparison
  Dot-paths work: light.primary=low, tempCRange.0>=18

Flags:
  --fields a,b,c   Choose which fields to show (list/search). Slug always included.
  --text           Human/AI-readable prose instead of JSON.
  --full           Emit complete records (ignores --fields).
  --count          Print only the number of matches.

Examples:
  node tools/plants-query.mjs list plantType=begonia
  node tools/plants-query.mjs list scientificName~Begonia --count
  node tools/plants-query.mjs list closedTerrariumOk=true difficulty<=2 --text
  node tools/plants-query.mjs list --fields commonName,notes --text   # bulk prose
  node tools/plants-query.mjs get "nerve plant"
  node tools/plants-query.mjs field selaginella-uncinata humidityPctRange
  node tools/plants-query.mjs search iridescent`;

function cmdList(plants, args) {
  const { filters, flags } = parseArgs(args);
  const fields = flags.fields ? String(flags.fields).split(',') : DEFAULT_FIELDS;
  const result = plants.filter((p) => filters.every((f) => matches(p, f)));
  outputList(result, fields, flags);
}

function cmdSearch(plants, args) {
  const { positional, flags } = parseArgs(args);
  if (!positional.length) fail('search needs a term: search <term>');
  const term = positional.join(' ');
  const fields = flags.fields ? String(flags.fields).split(',') : DEFAULT_FIELDS;
  const result = plants.filter((p) => deepContains(p, term));
  outputList(result, fields, flags);
}

function cmdGet(plants, args) {
  const { positional, flags } = parseArgs(args);
  if (!positional.length) fail('get needs a slug or name: get <slug|name>');
  const { plant, candidates } = resolvePlant(plants, positional.join(' '));
  if (!plant) {
    if (!candidates.length) fail(`no plant matches "${positional.join(' ')}"`);
    process.stderr.write(`# ${candidates.length} matches — be more specific:\n`);
    for (const c of candidates) process.stderr.write(`  ${c.slug}  (${c.commonName})\n`);
    process.exit(1);
  }
  if (flags.text) process.stdout.write(renderPlantText(plant, Object.keys(plant)) + '\n');
  else process.stdout.write(JSON.stringify(plant, null, 2) + '\n');
}

function cmdField(plants, args) {
  const { positional, flags } = parseArgs(args);
  if (positional.length < 2) fail('usage: field <slug|name> <fieldPath>');
  const path = positional[positional.length - 1];
  const query = positional.slice(0, -1).join(' ');
  const { plant, candidates } = resolvePlant(plants, query);
  if (!plant) {
    if (!candidates || !candidates.length) fail(`no plant matches "${query}"`);
    process.stderr.write(`# ${candidates.length} matches — be more specific:\n`);
    for (const c of candidates) process.stderr.write(`  ${c.slug}  (${c.commonName})\n`);
    process.exit(1);
  }
  const value = getPath(plant, path);
  if (value === undefined) fail(`"${plant.slug}" has no field "${path}"`);
  if (flags.text || typeof value === 'string') process.stdout.write(renderTextValue(value) + '\n');
  else process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function cmdSchema(plants) {
  const stats = {};
  for (const p of plants) {
    for (const [k, v] of Object.entries(p)) {
      const s = (stats[k] ??= { n: 0, types: new Set(), samples: new Set() });
      s.n++;
      s.types.add(Array.isArray(v) ? 'array' : typeof v);
      if (s.samples.size < 4 && (typeof v === 'string' || typeof v === 'boolean'))
        s.samples.add(String(v).slice(0, 24));
    }
  }
  const rows = Object.keys(stats)
    .sort()
    .map((k) => {
      const s = stats[k];
      return {
        field: k,
        present: `${s.n}/${plants.length}`,
        type: [...s.types].join('|'),
        samples: [...s.samples],
      };
    });
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n');
}

// --- dispatch ---------------------------------------------------------------

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    process.stdout.write(USAGE + '\n');
    return;
  }
  const plants = loadPlants();
  switch (command) {
    case 'list':
      return cmdList(plants, args);
    case 'search':
      return cmdSearch(plants, args);
    case 'get':
      return cmdGet(plants, args);
    case 'field':
      return cmdField(plants, args);
    case 'schema':
      return cmdSchema(plants);
    default:
      fail(`unknown command "${command}" — run with no args for usage`);
  }
}

main();
