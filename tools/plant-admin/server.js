/**
 * Plant Admin — a Curator-only local web tool for managing the Plant Catalog.
 *
 * Pure Node (no Express, no build step, zero new dependencies). It serves a
 * self-contained page and reads/writes `src/data/plants.json` directly. See
 * docs/adr/0005-plant-admin-standalone-web-tool.md.
 *
 *   npm run plant-admin   →   http://localhost:4317
 *
 * On every write it:
 *   1. authoritatively re-validates the record (shared field-spec.js),
 *   2. derives `image` as `plants/<slug>.png` (images.test invariant),
 *   3. canonical-orders new/edited records (untouched rows stay byte-identical),
 *   4. saves any uploaded photo to `assets/plants/<slug>.png`,
 *   5. regenerates placeholder SVGs so a new plant never breaks CI.
 *
 * It deliberately does NOT touch the database — the existing idempotent seed
 * picks up `plants.json` on the next Expo dev-server restart.
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const spec = require('./field-spec');

const ROOT = path.join(__dirname, '..', '..');
const PLANTS_JSON = path.join(ROOT, 'src', 'data', 'plants.json');
const ASSETS_DIR = path.join(ROOT, 'assets', 'plants');
const PLACEHOLDER_SCRIPT = path.join(ROOT, 'scripts', 'build-placeholders.mjs');
const INDEX_HTML = path.join(__dirname, 'index.html');
const FIELD_SPEC_JS = path.join(__dirname, 'field-spec.js');

const PORT = Number(process.env.PORT) || 4317;

// --- plants.json I/O ---------------------------------------------------------
function readDoc() {
  const raw = fs.readFileSync(PLANTS_JSON, 'utf8');
  return { raw, doc: JSON.parse(raw) };
}

/** Stringify exactly as the file is formatted (2-space, trailing newline). */
function writeDoc(doc) {
  fs.writeFileSync(PLANTS_JSON, JSON.stringify(doc, null, 2) + '\n');
}

/** Regenerate placeholder SVGs + the sourcing worklist. Resolves with a note. */
function regenPlaceholders() {
  return new Promise((resolve) => {
    execFile('node', [PLACEHOLDER_SCRIPT], { cwd: ROOT }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, message: (stderr || err.message).trim() });
      else resolve({ ok: true, message: (stdout || '').trim() });
    });
  });
}

/** Decode a `data:image/png;base64,...` URL to a Buffer (PNG only). */
function decodePng(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  return Buffer.from(m[1], 'base64');
}

// --- request helpers ---------------------------------------------------------
function send(res, status, body, headers) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, headers));
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 25 * 1024 * 1024) reject(new Error('Body too large (25MB cap)'));
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// --- write path (add / edit) -------------------------------------------------
async function upsert(res, body, originalSlug) {
  const incoming = body && body.record;
  if (!incoming || typeof incoming !== 'object') return send(res, 400, { error: 'Missing record' });

  // Derive slug + image; never trust client-supplied image.
  const slug = String(incoming.slug || '').trim();
  const record = Object.assign({}, incoming, { slug, image: slug ? `plants/${slug}.png` : '' });

  const { doc } = readDoc();
  const plants = doc.plants;
  const others = new Set(
    plants.map((p) => p.slug).filter((s) => s !== originalSlug),
  );

  const errors = spec.validatePlant(record, others);
  if (Object.keys(errors).length) return send(res, 422, { error: 'Validation failed', errors });

  // Optional photo upload → assets/plants/<slug>.png.
  let imageSaved = null;
  if (body.imageDataUrl) {
    const buf = decodePng(body.imageDataUrl);
    if (!buf) return send(res, 400, { error: 'Image must be a base64 PNG data URL' });
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.writeFileSync(path.join(ASSETS_DIR, `${slug}.png`), buf);
    imageSaved = `assets/plants/${slug}.png`;
  }

  const canonical = spec.canonicalize(record);
  if (originalSlug) {
    const idx = plants.findIndex((p) => p.slug === originalSlug);
    if (idx === -1) return send(res, 404, { error: `No plant with slug "${originalSlug}"` });
    plants[idx] = canonical;
  } else {
    if (plants.some((p) => p.slug === slug)) {
      return send(res, 422, { error: 'Validation failed', errors: { slug: 'Slug already exists' } });
    }
    plants.push(canonical);
  }

  writeDoc(doc);
  const placeholders = await regenPlaceholders();
  send(res, 200, { ok: true, count: plants.length, imageSaved, placeholders, plants });
}

async function remove(res, slug) {
  const { doc } = readDoc();
  const before = doc.plants.length;
  doc.plants = doc.plants.filter((p) => p.slug !== slug);
  if (doc.plants.length === before) return send(res, 404, { error: `No plant with slug "${slug}"` });
  writeDoc(doc);
  const placeholders = await regenPlaceholders();
  send(res, 200, { ok: true, count: doc.plants.length, placeholders, plants: doc.plants });
}

// --- router ------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split('/').filter(Boolean);

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const html = fs.readFileSync(INDEX_HTML, 'utf8')
        .replace('/*__FIELD_SPEC__*/', fs.readFileSync(FIELD_SPEC_JS, 'utf8'));
      return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8' });
    }

    if (req.method === 'GET' && url.pathname === '/api/plants') {
      const { doc } = readDoc();
      return send(res, 200, { plants: doc.plants });
    }

    if (req.method === 'POST' && url.pathname === '/api/plants') {
      return upsert(res, await readBody(req), null);
    }

    if (parts[0] === 'api' && parts[1] === 'plants' && parts[2]) {
      const slug = decodeURIComponent(parts[2]);
      if (req.method === 'PUT') return upsert(res, await readBody(req), slug);
      if (req.method === 'DELETE') return remove(res, slug);
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    send(res, 500, { error: String(err && err.message || err) });
  }
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  🌿  Plant Admin running at  http://localhost:${PORT}\n`);
  console.log(`     editing  ${path.relative(process.cwd(), PLANTS_JSON)}`);
  console.log(`     Ctrl+C to stop.\n`);
});
