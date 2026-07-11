#!/usr/bin/env node
/**
 * M0 · R7 — extract the 201-name migration corpus (runbook §6).
 *
 * Reads the FROZEN catalog (`src/logic/__tests__/golden/catalog.snapshot.json`,
 * the R5 capture of `src/data/plants.json`) so the corpus is pinned to the M0
 * baseline, and writes `corpus-201.csv` next to this script — one row per record:
 *   slug, commonName, scientificName, sources (|-joined urls), image,
 *   imageCredit, imageLicense, toxicity, plantType
 *
 * Also prints the coverage counts and the sources-domain tally that BASELINE.md
 * records (M3's licensing design starts from that tally). Re-runnable:
 *   node deliverables/m0-baseline/corpus-extract.mjs [path/to/catalog.json]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const CATALOG =
  argv[2] ?? join(REPO, 'src', 'logic', '__tests__', 'golden', 'catalog.snapshot.json');
const OUT = join(HERE, 'corpus-201.csv');

const COLUMNS = [
  'slug',
  'commonName',
  'scientificName',
  'sources',
  'image',
  'imageCredit',
  'imageLicense',
  'toxicity',
  'plantType',
];

/** RFC-4180 quoting: wrap when the value carries a comma, quote, or newline. */
function csv(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const { plants } = JSON.parse(readFileSync(CATALOG, 'utf8'));
if (!Array.isArray(plants)) {
  console.error(`Not a catalog file (no plants[]): ${CATALOG}`);
  exit(1);
}

const rows = plants.map((p) =>
  COLUMNS.map((col) =>
    csv(col === 'sources' ? (p.sources ?? []).map((s) => s.url).join('|') : p[col]),
  ).join(','),
);
writeFileSync(OUT, `${COLUMNS.join(',')}\n${rows.join('\n')}\n`);

// --- Coverage + domain tally (pasted into BASELINE.md) -----------------------
const count = (field) => plants.filter((p) => p[field] != null && p[field] !== '').length;
const sourceCount = plants.filter((p) => (p.sources ?? []).length > 0).length;
// The app resolves imagery by SLUG through the generated PLANT_IMAGES require-map
// (assets/plants/<slug>.jpg|png) — the `image` field's literal path is authored
// intent, not the resolution key. Count what the app can actually render.
const imagesOnDisk = plants.filter((p) =>
  ['jpg', 'png'].some((ext) => existsSync(join(REPO, 'assets', 'plants', `${p.slug}.${ext}`))),
).length;

const domains = new Map();
for (const p of plants) {
  for (const s of p.sources ?? []) {
    let host;
    try {
      host = new URL(s.url).hostname.replace(/^www\./, '');
    } catch {
      host = `<malformed: ${s.url}>`;
    }
    domains.set(host, (domains.get(host) ?? 0) + 1);
  }
}
const tally = [...domains.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

console.log(`corpus-201.csv written: ${plants.length} rows`);
console.log(
  `coverage: slug ${count('slug')} · commonName ${count('commonName')} · scientificName ${count(
    'scientificName',
  )} · sources ${sourceCount} · image ${count('image')} (on disk: ${imagesOnDisk}) · imageCredit ${count(
    'imageCredit',
  )} · imageLicense ${count('imageLicense')} · toxicity ${count('toxicity')} · plantType ${count('plantType')}`,
);
console.log(`source links total: ${[...domains.values()].reduce((a, b) => a + b, 0)}`);
console.log('domain tally (links per host):');
for (const [host, n] of tally) console.log(`  ${String(n).padStart(4)}  ${host}`);
