#!/usr/bin/env node
/**
 * Fetches plant photos from Wikipedia and wires up existing hand-labelled ones.
 *
 * Usage: node scripts/fetch-plant-photos.mjs
 *
 * Step 1 — copies existing photos from jpg/ and Png/ subfolders to assets/plants/{slug}.ext
 * Step 2 — for every plant still missing a photo, queries Wikipedia pageimages API
 *           (batches of 50) and downloads the lead image thumbnail at 1200px
 *
 * Skips any slug that already has a .png or .jpg at assets/plants/.
 * Run build-plant-images.mjs after to regenerate the Metro registry.
 */
import { readFileSync, existsSync, copyFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ASSETS = `${ROOT}/assets/plants`;
const BATCH_SIZE = 50;
const THUMB_PX = 600; // hero renders at 180px tall, thumbs at 77px — 600 is plenty, keeps the bundle light
const DOWNLOAD_DELAY_MS = 1200; // stay under Wikimedia's rate limit
const UA = 'terrarium-v2-photo-fetcher/1.0 (lucas.larcomb@icloud.com)';

// --- Step 1: wire up existing hand-labelled photos ---
const EXISTING = {
  'jpg/Air-Plant-Dawn-Agran.jpg':          'tillandsia-ionantha',
  'jpg/Albo-Arrowhead-Sajid-Khan.jpg':     'syngonium-albo',
  'jpg/Alumin-plant-Kiran-Naidu.jpg':      'pilea-cadierei',
  'jpg/Andean-Horsetail-iuliu-illes.jpg':  'equisetum-bogotense',
  'Png/Amazon vine no credit.png':         'cissus-amazonicus',
  'Png/Anthurium-scandens.png':            'anthurium-scandens',
  'Png/Anubias nana ver petite.png':       'anubias-nana-petite',
  'Png/Pilea aquamarine no credit.png':    'pilea-libanensis-aquamarine',
  'Syngonium podophyllum Carlo Brescia.jpg': 'syngonium-podophyllum-mini',
};

for (const [src, slug] of Object.entries(EXISTING)) {
  const ext = extname(src);
  const dest = `${ASSETS}/${slug}${ext}`;
  if (!existsSync(dest)) {
    copyFileSync(`${ASSETS}/${src}`, dest);
    console.log(`copied: ${slug}${ext}`);
  }
}

// --- Step 2: find plants still missing photos ---
const { plants } = JSON.parse(readFileSync(`${ROOT}/src/data/plants.json`, 'utf8'));
const missing = plants.filter(
  (p) => !existsSync(`${ASSETS}/${p.slug}.png`) && !existsSync(`${ASSETS}/${p.slug}.jpg`)
);

if (!missing.length) {
  console.log('\nall plants already have photos');
  process.exit(0);
}
console.log(`\nfetching ${missing.length} plant photos from Wikipedia…\n`);

let found = 0, skipped = 0;

for (let i = 0; i < missing.length; i += BATCH_SIZE) {
  const batch = missing.slice(i, i + BATCH_SIZE);

  // Strip cultivar suffix so "Alocasia baginda 'Silver Dragon'" searches "Alocasia baginda".
  // Multiple cultivars of the same species will each get the species-level photo.
  const titleToPlants = new Map();
  for (const p of batch) {
    const title = p.scientificName.split("'")[0].trim();
    const arr = titleToPlants.get(title) ?? [];
    arr.push(p);
    titleToPlants.set(title, arr);
  }

  const url =
    'https://en.wikipedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      titles: [...titleToPlants.keys()].join('|'),
      prop: 'pageimages',
      pithumbsize: THUMB_PX,
      format: 'json',
      origin: '*',
    });

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const data = await res.json();

  // normMap: Wikipedia canonical title → original search title I sent
  const normMap = {};
  for (const n of data.query.normalized ?? []) normMap[n.to] = n.from;

  for (const page of Object.values(data.query.pages)) {
    const origTitle = normMap[page.title] ?? page.title;
    const targets = titleToPlants.get(origTitle) ?? [];

    if (page.missing !== undefined || !page.thumbnail) {
      for (const p of targets) {
        console.log(`  skip (no Wikipedia image): ${p.slug}`);
        skipped++;
      }
      continue;
    }

    const imgUrl = page.thumbnail.source;
    const rawExt = imgUrl.match(/\.(jpe?g|png|webp)/i)?.[1]?.toLowerCase() ?? 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;

    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } });
    if (!imgRes.ok) {
      for (const p of targets) {
        console.log(`  skip (download failed ${imgRes.status}): ${p.slug}`);
        skipped++;
      }
      continue;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());

    for (const p of targets) {
      const dest = `${ASSETS}/${p.slug}.${ext}`;
      if (!existsSync(dest)) {
        await writeFile(dest, buf);
        console.log(`  ✓ ${p.slug}.${ext}`);
        found++;
      }
    }

    await new Promise((r) => setTimeout(r, DOWNLOAD_DELAY_MS));
  }

  process.stdout.write(`  [${Math.min(i + BATCH_SIZE, missing.length)}/${missing.length}]\n`);
  if (i + BATCH_SIZE < missing.length) await new Promise((r) => setTimeout(r, 500));
}

console.log(`\ndone: ${found} downloaded, ${skipped} not found`);
console.log('run: node scripts/build-plant-images.mjs');
