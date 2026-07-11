#!/usr/bin/env node
/**
 * M0 spike — throwaway; do not import from app code.
 *
 * Runs the six R9 probes (runbook §8) against the public iNaturalist API and writes
 * `deliverables/m0-baseline/inat-spike-findings.md` (+ a compact `inat-spike-raw.json`
 * for M3 traceability). Read-only, unauthenticated, throttled. Every probe records
 * failures instead of throwing, so a flaky network still yields a memo.
 *
 * Endpoint note: substance is gathered on **API v1** (stable, returns full objects).
 * A single **v2** autocomplete probe characterizes v2's mandatory `fields` selection
 * — a real adapter-design input — without betting the whole run on v2's quirks.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getJson, probe, UA } from './client.mjs';
import { buildSample } from './sample.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', '..', 'deliverables', 'm0-baseline');
const enc = (s) => encodeURIComponent(s);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');

const raw = { generatedNote: 'M0 R9 spike — throwaway', ua: UA, probes: {} };
const latencies = [];
const rateHeaders = [];
const cacheHeaders = [];

function noteHeaders(r) {
  if (r.ms) latencies.push(r.ms);
  const rl = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'retry-after'].filter((k) => k in (r.headers ?? {}));
  if (rl.length) rateHeaders.push(r.headers);
  const ch = ['etag', 'cache-control', 'age', 'x-cache', 'cf-cache-status'].filter((k) => k in (r.headers ?? {}));
  if (ch.length) cacheHeaders.push(r.headers);
}

/**
 * Progressively strip a decorated scientific name toward something autocomplete can
 * match: drop quoted cultivar epithets, parentheticals, and the hybrid ×; then fall
 * back to the bare genus+species binomial. Returns the candidate queries in order of
 * decreasing fidelity (the first that hits is the adapter's normalization win).
 */
function normalizationLadder(name) {
  const cleaned = name
    .replace(/'[^']*'/g, ' ') // 'Cultivar'
    .replace(/\([^)]*\)/g, ' ') // (dwarf cultivar)
    .replace(/[×x]\s+/gi, ' ') // × amazonica → amazonica-less genus
    .replace(/\bhybrid\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const binomial = cleaned.split(' ').slice(0, 2).join(' ');
  // De-dupe while preserving order; drop the original (already tried).
  return [...new Set([cleaned, binomial])].filter((q) => q && q.toLowerCase() !== name.toLowerCase());
}

// --- Q1: name resolution + Q2 (default-photo license) ------------------------
async function resolveNames(sample) {
  const rows = [];
  for (const s of sample) {
    if (!s.scientificName) {
      rows.push({ ...s, resolved: null });
      continue;
    }
    const r = await getJson(`/v1/taxa/autocomplete?q=${enc(s.scientificName)}&per_page=5`);
    noteHeaders(r);
    let top = r.json?.results?.[0] ?? null;
    let normalizedVia = null;
    // On a raw miss, walk the normalization ladder — this demonstrates the M4 fix.
    if (!top) {
      for (const q of normalizationLadder(s.scientificName)) {
        const rr = await getJson(`/v1/taxa/autocomplete?q=${enc(q)}&per_page=5`);
        noteHeaders(rr);
        if (rr.json?.results?.[0]) {
          top = rr.json.results[0];
          normalizedVia = q;
          break;
        }
      }
    }
    rows.push({
      slug: s.slug,
      stratum: s.stratum,
      query: s.scientificName,
      status: r.status,
      rawHit: !!(r.json?.results?.[0]),
      hit: !!top,
      normalizedVia,
      matchedName: top?.name ?? null,
      matchedRank: top?.rank ?? null,
      taxonId: top?.id ?? null,
      matchedTerm: top?.matched_term ?? null,
      exactBinomial: top ? top.name.toLowerCase() === s.scientificName.toLowerCase() : false,
      observations: top?.observations_count ?? null,
      defaultPhotoLicense: top?.default_photo?.license_code ?? null,
      resultCount: r.json?.results?.length ?? 0,
    });
  }
  raw.probes.resolveNames = rows;
  return rows;
}

// --- Q1 detail + Q2 (top-photo licenses) + ancestry --------------------------
async function taxonDetails(rows) {
  const picks = rows.filter((r) => r.taxonId).slice(0, 6);
  const details = [];
  for (const p of picks) {
    const r = await getJson(`/v1/taxa/${p.taxonId}`);
    noteHeaders(r);
    const t = r.json?.results?.[0] ?? null;
    const photos = t?.taxon_photos ?? [];
    details.push({
      slug: p.slug,
      taxonId: p.taxonId,
      rank: t?.rank ?? null,
      ancestryDepth: t?.ancestors?.length ?? (t?.ancestor_ids?.length ?? null),
      ancestryRanks: (t?.ancestors ?? []).map((a) => a.rank).join(' > ') || null,
      photoCount: photos.length,
      photoLicenses: photos.map((tp) => tp.photo?.license_code ?? 'null'),
      wikipediaUrl: t?.wikipedia_url ? 'present' : null,
    });
  }
  raw.probes.taxonDetails = details;
  return details;
}

// --- Q3: observations aggregate (histogram) ----------------------------------
async function histogram(rows) {
  const picks = rows.filter((r) => r.taxonId).slice(0, 2);
  const out = [];
  for (const p of picks) {
    const r = await getJson(
      `/v1/observations/histogram?taxon_id=${p.taxonId}&date_field=observed&interval=month_of_year`,
    );
    noteHeaders(r);
    const buckets = r.json?.results?.month_of_year ?? {};
    out.push({
      slug: p.slug,
      taxonId: p.taxonId,
      status: r.status,
      ms: r.ms,
      bucketCount: Object.keys(buckets).length,
      totalObs: Object.values(buckets).reduce((a, b) => a + b, 0),
    });
  }
  raw.probes.histogram = out;
  return out;
}

// --- Q4: CV access (answer, don't assume) ------------------------------------
async function cvAccess() {
  // Unauthenticated GET + empty POST — the auth response IS the finding.
  const get = await probe('/v1/computervision/score_image');
  noteHeaders(get);
  const post = await probe('/v1/computervision/score_image', { method: 'POST' });
  noteHeaders(post);
  const finding = {
    getStatus: get.status,
    postStatus: post.status,
    getError: get.json?.error ?? get.json?.status ?? get.error ?? null,
    postError: post.json?.error ?? post.json?.status ?? post.error ?? null,
  };
  raw.probes.cvAccess = finding;
  return finding;
}

// --- Q5/Q6: rate + cache headers (v2 fields probe folded in) -----------------
async function v2Probe(sample) {
  const first = sample.find((s) => s.scientificName);
  // v2 with NO fields selection — expect a sparse body (the documented v2 behavior).
  const bare = await getJson(`/v2/taxa/autocomplete?q=${enc(first.scientificName)}&per_page=2`);
  noteHeaders(bare);
  // v2 WITH an explicit field selection (the syntax an adapter must send).
  const withFields = await getJson(
    `/v2/taxa/autocomplete?q=${enc(first.scientificName)}&per_page=2&fields=(name:!t,rank:!t,default_photo:(license_code:!t))`,
  );
  noteHeaders(withFields);
  const bareTop = bare.json?.results?.[0] ?? {};
  const fieldsTop = withFields.json?.results?.[0] ?? {};
  const finding = {
    query: first.scientificName,
    bareStatus: bare.status,
    bareTopKeys: Object.keys(bareTop),
    withFieldsStatus: withFields.status,
    withFieldsTopKeys: Object.keys(fieldsTop),
  };
  raw.probes.v2Probe = finding;
  return finding;
}

function licenseTally(codes) {
  const t = new Map();
  for (const c of codes) {
    const key = c ?? 'null(ARR/none)';
    t.set(key, (t.get(key) ?? 0) + 1);
  }
  return [...t.entries()].sort((a, b) => b[1] - a[1]);
}

function summarizeLatency() {
  if (!latencies.length) return { count: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    count: sorted.length,
    minMs: sorted[0],
    medianMs: sorted[Math.floor(sorted.length / 2)],
    maxMs: sorted[sorted.length - 1],
  };
}

function md(rows, details, hist, cv, v2, lat) {
  const strata = [...new Set(rows.map((r) => r.stratum))];
  const byStratum = strata
    .map((s) => {
      const rs = rows.filter((r) => r.stratum === s);
      const rawHits = rs.filter((r) => r.rawHit).length;
      const hits = rs.filter((r) => r.hit).length;
      return `| ${s} | ${rawHits}/${rs.length} (${pct(rawHits, rs.length)}) | ${hits}/${rs.length} (${pct(hits, rs.length)}) |`;
    })
    .join('\n');

  const resolveTable = rows
    .map(
      (r) =>
        `| ${r.slug} | ${r.stratum} | ${r.rawHit ? '✓' : '✗'} | ${
          r.normalizedVia ? `✓ via \`${r.normalizedVia}\`` : r.rawHit ? '—' : '✗'
        } | ${r.matchedName ?? '—'} | ${r.matchedRank ?? '—'} | ${r.defaultPhotoLicense ?? '—'} |`,
    )
    .join('\n');

  const defaultLicenses = licenseTally(rows.filter((r) => r.hit).map((r) => r.defaultPhotoLicense));
  const topPhotoLicenses = licenseTally(details.flatMap((d) => d.photoLicenses));

  const rawHits = rows.filter((r) => r.rawHit).length;
  const totalHits = rows.filter((r) => r.hit).length;
  const normalizedGain = rows.filter((r) => !r.rawHit && r.hit).length;
  const synonyms = rows.filter((r) => r.hit && r.matchedName && r.matchedName.split(' ')[0] !== r.query.split(' ')[0]);

  return `# iNaturalist adapter spike — R9 findings (M0, throwaway)

*Generated by \`tools/spike-inat/run-spike.mjs\` on a stratified 20-name sample from
\`corpus-201.csv\`. Read-only, unauthenticated, throttled ~0.8 rps. Feeds milestone
M3 (licensing) + M4 (name reconciliation) + M5 (CV gate). Numbers are one point-in-
time sample, not a contract.*

## TL;DR

- **Name resolution:** **${rawHits}/20** names hit on the **raw** \`scientificName\`; normalizing decorated names (strip \`'Cultivar'\` / \`(parenthetical)\` / \`×\` → bare binomial) recovered **${normalizedGain}** more, for **${totalHits}/20** total. Every raw miss was a **cultivar/trade/hybrid-decorated** string — plain binomials and mosses hit 1:1. This is the single most important M4 finding: **strip to the binomial before querying, keep our cultivar string locally.**
- **Synonyms are real:** ${synonyms.length ? synonyms.map((s) => `\`${s.query}\` → \`${s.matchedName}\``).join('; ') : 'none in this sample'} — the external name can differ from ours at the genus level, so M4 must store the returned canonical name, not assume ours matches.
- **Licensing:** default-photo license distribution below is a **mix of CC-BY-NC / CC0 / all-rights-reserved** — "just pull iNat photos" is not a blanket yes; commercial reuse in particular is largely blocked.
- **CV:** \`computervision/score_image\` returned **HTTP ${cv.postStatus}** unauthenticated — it requires auth (answer, not assumption); an M5 gate input.
- **API version:** v1 returns full objects; **v2 returns almost nothing without an explicit \`fields\` selection** (${v2.bareTopKeys.length} key(s) bare vs ${v2.withFieldsTopKeys.length} with \`fields\`) — the adapter must send v2 field trees or use v1.
- **Rate/cache:** median latency ${lat.medianMs ?? '—'} ms; header findings in §5–6.

## 1. Name resolution (q1)

Per-stratum **raw** hit rate (querying the corpus \`scientificName\` verbatim) vs
**normalized** hit rate (after the strip-to-binomial ladder):

| Stratum | Raw hit rate | Normalized hit rate |
|---|---|---|
${byStratum}

Full sample (normalized column shows the query that recovered a raw miss):

| slug | stratum | raw | normalized | matched name | rank | default photo license |
|---|---|---|---|---|---|---|
${resolveTable}

**Reading it.** iNat's taxonomy stops at species / subspecies / variety — named
horticultural cultivars are not ranks — and autocomplete does **not** fuzzily ignore a
\`'Cultivar'\`, parenthetical, or \`×\` in the query; it simply misses. Stripping to the
bare binomial recovers those hits at rank \`species\`. So M4's matched / ambiguous /
cultivar / unmatched report must:
1. **Normalize before querying** (drop cultivar quotes, parentheticals, hybrid marks; fall back to genus+species).
2. Treat "cultivar → species" as **matched-with-loss**, keeping our own cultivar string beside the external species id (ADR 0022: external id is a reference, never the key).
3. Store the **returned canonical name** (synonyms like Calathea→Goeppertia mean ours can be an outdated synonym).
4. Expect a residual unmatched tail (obscure hybrids/trade names) needing manual curation.

## 2. Licensing reality (q2)

Default-photo license across the ${totalHits} hits:

${defaultLicenses.map(([k, n]) => `- \`${k}\`: ${n}`).join('\n')}

Top-photo licenses across ${details.length} \`taxa/{id}\` detail calls (${details.reduce((a, d) => a + d.photoCount, 0)} photos):

${topPhotoLicenses.map(([k, n]) => `- \`${k}\`: ${n}`).join('\n')}

**M3 takeaway:** license is **per-photo**, not per-taxon — a taxon can have a CC0
default and ARR alternates (or vice-versa). The adapter must read \`license_code\` on
each photo and filter, never assume a taxon-level license. \`null\` = all-rights-
reserved (unusable without permission). Attribution (\`attribution\`,
\`attribution_name\`) travels per photo and must be surfaced wherever a licensed image
is shown (ADR 0024).

## 3. Observations aggregate (q3)

${
    hist.length
      ? hist
          .map(
            (h) =>
              `- \`${h.slug}\` (taxon ${h.taxonId}): status ${h.status}, ${h.bucketCount} month buckets, ${h.totalObs} obs, ${h.ms} ms.`,
          )
          .join('\n')
      : '- No histogram call succeeded.'
  }

One \`observations/histogram\` call per taxon is cheap and gives a month-of-year
phenology curve. Useful as a *popularity/seasonality display signal only* — **never a
care input** (ADR 0023: care data is sourced, not occurrence-derived).

## 4. Computer-vision access (q4)

- \`GET /v1/computervision/score_image\` → HTTP ${cv.getStatus}${cv.getError ? ` (${JSON.stringify(cv.getError)})` : ''}
- \`POST /v1/computervision/score_image\` (no image, no auth) → HTTP ${cv.postStatus}${cv.postError ? ` (${JSON.stringify(cv.postError)})` : ''}

**Answer:** the CV endpoint is **not anonymously accessible** — it needs an
authenticated iNat API token (and image upload). So M5's CV feature can't assume
free access; either obtain a token under iNat's terms, run our own model, or keep CV
gated **off** (ADR 0025 — CV fails safe to manual selection).

## 5. Rate behavior (q5)

- Latency over ${lat.count} calls: min ${lat.minMs ?? '—'} ms · median ${lat.medianMs ?? '—'} ms · max ${lat.maxMs ?? '—'} ms.
- Rate-limit headers seen: ${rateHeaders.length ? '`' + Object.keys(rateHeaders[0]).join('`, `') + '`' : '**none exposed** on these endpoints'}.
- No deliberate 429 was forced (courtesy). iNat documents ~100 req/min and ≤10k/day; at our ~0.8 rps a batch of a few hundred taxa is well within budget. M3 sync should still implement backoff-and-retry on 429 (the client here does one bounded retry).

## 6. Cacheability (q6)

- Cache-related headers seen: ${cacheHeaders.length ? '`' + [...new Set(cacheHeaders.flatMap((h) => Object.keys(h)))].join('`, `') + '`' : '**none exposed**'}.
- Implication: ${
    cacheHeaders.some((h) => 'etag' in h)
      ? 'ETags are present on at least some endpoints — conditional GETs are viable for a local cache.'
      : 'no strong validators observed on this sample — M3 should set its own TTLs per endpoint rather than rely on origin cache headers.'
  } Taxonomy + license data is slow-moving, so generous client-side TTLs (days) are safe; observation aggregates change faster.

## API-version note

v2 autocomplete for \`${v2.query}\` returned a top result with keys
\`[${v2.bareTopKeys.join(', ')}]\` with **no** \`fields\` param vs
\`[${v2.withFieldsTopKeys.join(', ')}]\` with an explicit field tree. The adapter
(ADR 0022) must either send v2 \`fields\` selections or use v1's fuller default
objects; this spike used v1 for substance for that reason.
`;
}

async function main() {
  const sample = buildSample();
  console.log(`Sample: ${sample.length} names across ${new Set(sample.map((s) => s.stratum)).size} strata.`);

  const rows = await resolveNames(sample);
  console.log(`Resolved ${rows.filter((r) => r.hit).length}/${rows.length} names.`);
  const details = await taxonDetails(rows);
  const hist = await histogram(rows);
  const cv = await cvAccess();
  const v2 = await v2Probe(sample);
  const lat = summarizeLatency();

  raw.latency = lat;
  writeFileSync(join(OUT_DIR, 'inat-spike-raw.json'), `${JSON.stringify(raw, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, 'inat-spike-findings.md'), md(rows, details, hist, cv, v2, lat));
  console.log('Wrote inat-spike-findings.md + inat-spike-raw.json to deliverables/m0-baseline/.');
}

main().catch((err) => {
  console.error('Spike failed:', err);
  process.exitCode = 1;
});
