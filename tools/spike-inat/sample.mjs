/**
 * M0 spike — throwaway; do not import from app code.
 *
 * The deterministic stratified 20-name sample for R9, drawn by slug from the frozen
 * `corpus-201.csv` so the run is reproducible. Four strata (runbook §8 q1):
 *   plain species · cultivar-suffixed · trade/hybrid names · mosses & allies.
 * Each entry keeps the corpus `scientificName` (what we query) + a stratum label.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV = join(HERE, '..', '..', 'deliverables', 'm0-baseline', 'corpus-201.csv');

/** Minimal CSV row split honoring double-quoted fields (the corpus quotes sources). */
function splitRow(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadCorpus() {
  const [header, ...rows] = readFileSync(CSV, 'utf8').trim().split('\n');
  const cols = header.split(',');
  return rows.map((r) => Object.fromEntries(splitRow(r).map((v, i) => [cols[i], v])));
}

/** The chosen slugs per stratum (5 each = 20). Picked to span rank/format variety. */
const STRATA = {
  'plain-species': [
    'fittonia-albivenis',
    'soleirolia-soleirolii',
    'maranta-leuconeura',
    'calathea-ornata',
    'hypoestes-phyllostachya',
  ],
  'cultivar-suffixed': [
    'selaginella-kraussiana',
    'scindapsus-pictus-argyraeus',
    'alocasia-reginula-black-velvet',
    'ficus-pumila-panama',
    'peperomia-orba-pixie-lime',
  ],
  'trade-or-hybrid': [
    'crassula-ovata-mini',
    'anubias-nana-petite',
    'neoregelia-hybrid-liliputiana',
    'alocasia-amazonica-bambino',
    'nephrolepis-exaltata-fluffy-ruffles',
  ],
  'moss-or-ally': [
    'leucobryum-glaucum',
    'dicranum-scoparium',
    'taxiphyllum-barbieri',
    'sphagnum-palustre',
    'selaginella-uncinata',
  ],
};

export function buildSample() {
  const bySlug = new Map(loadCorpus().map((r) => [r.slug, r]));
  const sample = [];
  for (const [stratum, slugs] of Object.entries(STRATA)) {
    for (const slug of slugs) {
      const rec = bySlug.get(slug);
      if (!rec) {
        sample.push({ slug, stratum, scientificName: null, missingFromCorpus: true });
        continue;
      }
      sample.push({ slug, stratum, scientificName: rec.scientificName, commonName: rec.commonName });
    }
  }
  return sample;
}
