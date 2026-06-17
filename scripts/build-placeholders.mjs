/**
 * Phase 3 placeholder + sourcing scaffolding (decision 11 / decision 18).
 *
 * The real plant photos are the project's "long pole": accuracy-first, CC /
 * public-domain, sourced by a HUMAN curator (Wikimedia primary). That work is NOT
 * automated here. This generator builds the scaffolding *around* it so the app has
 * something to render today and the curator has a clean worklist:
 *
 *   1. A stylized PLACEHOLDER SVG for every seed plant
 *      (`assets/plants/_placeholders/<slug>.svg`). Decision 18: any non-photo image
 *      MUST be marked "stylized" so it can never be mistaken for a reference photo —
 *      hence the uniform card, the muted palette, and the explicit
 *      "PLACEHOLDER — not a reference photo" footer on every file.
 *   2. The curator worklist (`assets/plants/IMAGE_SOURCING.md`) — the rules plus a
 *      table of all 67 plants with their target asset path and a Pending status.
 *
 * Reproducible: re-run with `node scripts/build-placeholders.mjs` after the seed
 * changes. It reads `src/data/plants.json` (FINAL — never written by this script)
 * and only writes under `assets/plants/`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLANTS_JSON = join(ROOT, 'src', 'data', 'plants.json');
const PLACEHOLDER_DIR = join(ROOT, 'assets', 'plants', '_placeholders');
const SOURCING_MD = join(ROOT, 'assets', 'plants', 'IMAGE_SOURCING.md');

// --- Card geometry (uniform across the whole set, decision 18) ---------------
const VIEW_W = 400;
const VIEW_H = 300; // 4:3

// --- Palette keyed by plantType ----------------------------------------------
// Muted, low-saturation pairs [background, accent] so the set reads as one calm
// family and never as a glossy "hero" photo. `default` covers the 43 plants with
// no plantType.
const PALETTE = {
  fern: ['#2f4a3a', '#a7c7b0'],
  'fern-ally': ['#33493b', '#a9c6ae'],
  moss: ['#3a4a2c', '#bccda0'],
  succulent: ['#3d4a3f', '#b7cbb2'],
  carnivorous: ['#3a3550', '#bdb4d6'],
  aroid: ['#27433a', '#9fc4b6'],
  begonia: ['#4a3140', '#d4b0c4'],
  orchid: ['#473650', '#cdb6d4'],
  vine: ['#33452f', '#aec79f'],
  'ground-cover': ['#3a4630', '#b8c8a2'],
  foliage: ['#2e463c', '#a4c5b6'],
  default: ['#374049', '#aebac6'],
};

// --- XML / text helpers ------------------------------------------------------
/** Escape the five XML predefined entities so any name is valid in text/attrs. */
function xmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Greedy word-wrap to at most `maxLines` lines of ~`maxChars` chars. The final
 * line is ellipsis-truncated if content overflows, so even a very long common
 * name fits the card gracefully.
 */
function wrapText(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  if (lines.length === maxLines) {
    // Did everything fit? If not, truncate the last visible line with an ellipsis.
    const shown = lines.join(' ');
    if (shown.length < text.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && (last.length > maxChars - 1)) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last.replace(/[\s.]+$/, '')}…`;
    }
  }
  return lines;
}

// --- One SVG -----------------------------------------------------------------
function buildSvg(plant) {
  const type = plant.plantType ?? 'default';
  const [bg, accent] = PALETTE[type] ?? PALETTE.default;
  const typeLabel = plant.plantType ?? 'plant';

  // Common name: up to 2 lines, centered, vertically balanced around mid-card.
  const nameLines = wrapText(plant.commonName, 22, 2);
  const nameSize = 30;
  const nameLeading = 34;
  const blockH = nameLines.length * nameLeading;
  const nameTop = VIEW_H / 2 - blockH / 2 + nameSize - 6;
  const nameTspans = nameLines
    .map((ln, i) => `<tspan x="${VIEW_W / 2}" y="${nameTop + i * nameLeading}">${xmlEscape(ln)}</tspan>`)
    .join('');

  // Scientific name: one italic line beneath, truncated to fit one row.
  const sciLine = wrapText(plant.scientificName, 36, 1)[0] ?? '';
  const sciY = nameTop + (nameLines.length - 1) * nameLeading + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" role="img" aria-label="Stylized placeholder for ${xmlEscape(plant.commonName)} — not a reference photo">
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="${bg}"/>
  <rect x="8" y="8" width="${VIEW_W - 16}" height="${VIEW_H - 16}" rx="14" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.55"/>
  <text x="20" y="34" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="13" font-weight="600" letter-spacing="1.5" fill="${accent}" opacity="0.85">${xmlEscape(typeLabel.toUpperCase())}</text>
  <text x="${VIEW_W / 2}" text-anchor="middle" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="${nameSize}" font-weight="700" fill="#f4f6f4">${nameTspans}</text>
  <text x="${VIEW_W / 2}" y="${sciY}" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-style="italic" font-size="17" fill="${accent}">${xmlEscape(sciLine)}</text>
  <text x="${VIEW_W / 2}" y="${VIEW_H - 18}" text-anchor="middle" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="12" font-weight="600" letter-spacing="0.5" fill="${accent}" opacity="0.9">PLACEHOLDER — not a reference photo</text>
</svg>
`;
}

// --- Sourcing worklist (markdown) --------------------------------------------
function mdEscape(s) {
  // Pipes would break the table; backticks already wrap the cells that need it.
  return String(s).replaceAll('|', '\\|');
}

function buildSourcingMd(plants) {
  const rows = plants
    .map(
      (p) =>
        `| \`${mdEscape(p.slug)}\` | *${mdEscape(p.scientificName)}* | ${mdEscape(p.commonName)} | \`plants/${mdEscape(p.slug)}.png\` | Pending |`,
    )
    .join('\n');

  return `# Plant image sourcing worklist

> **Status:** scaffolding only. Every plant currently ships a *stylized placeholder*
> (\`assets/plants/_placeholders/<slug>.svg\`) — clearly marked, never a reference
> photo (decision 18). The table below is the human curation worklist for replacing
> those placeholders with real, accurately-identified photographs.

## Why accuracy is the whole game

A wrong species **corrupts trust** in the entire plant library: a user who spots one
misidentified photo stops believing any of them. So this pass is *accuracy-first* —
it is better to leave a placeholder than to ship a confident, wrong photo. When in
doubt about an ID, leave the row \`Pending\`.

## Sourcing rules

- **Wikimedia Commons is the primary source.** Prefer images already curated there;
  fall back to other reputable, clearly-licensed sources only when Commons has no
  accurately-identified image.
- **License preference (best first):**
  1. **CC0 / Public Domain** (PD, PD-US, no rights reserved)
  2. **CC-BY** (attribution required)
  3. **CC-BY-SA** (attribution + share-alike)
- **Never allowed:**
  - **\`-NC\` / NonCommercial** — incompatible with the app.
  - **\`-ND\` / NoDerivatives** — we crop every image to a uniform 4:3 card, and a
    uniform crop is a **derivative**, so \`-ND\` licenses are out.
- **Always record provenance.** A real photo without a verifiable source/license is
  not usable — leave the row \`Pending\` rather than guessing.

## How to land a real photo

When a correctly-identified, correctly-licensed photo is found for a plant:

1. Crop/export it to the uniform card and drop it at **\`assets/plants/<slug>.png\`**
   (the exact path each plant's \`image\` field already points to — \`plants/<slug>.png\`).
2. On that plant's record in **\`src/data/plants.json\`**, fill the two seed-only
   fields:
   - **\`imageCredit\`** — a non-empty attribution string (photographer + source).
   - **\`imageLicense\`** — the license id (e.g. \`CC0\`, \`CC-BY-4.0\`, \`CC-BY-SA-4.0\`).
   > These two fields are **seed-only**: they stay in \`plants.json\` for attribution
   > and **must never enter the export / backup payload** (decision 17/18). Do not
   > invent either value — a missing credit/license means the photo is not ready.
3. Flip the row's **Status** below from \`Pending\` to \`Done\` (note the license used).

The image invariants test (\`src/data/__tests__/images.test.ts\`) enforces the
machine-checkable half of these rules: slug-consistent paths, a placeholder for every
plant, credit-required-with-CC-BY, and no \`-NC\`/\`-ND\` licenses.

## Worklist (${plants.length} plants)

| Slug | Scientific name | Common name | Target asset | Status |
| --- | --- | --- | --- | --- |
${rows}
`;
}

// --- run ---------------------------------------------------------------------
const plants = JSON.parse(readFileSync(PLANTS_JSON, 'utf8')).plants;

mkdirSync(PLACEHOLDER_DIR, { recursive: true });

let written = 0;
for (const plant of plants) {
  writeFileSync(join(PLACEHOLDER_DIR, `${plant.slug}.svg`), buildSvg(plant));
  written += 1;
}

writeFileSync(SOURCING_MD, buildSourcingMd(plants));

console.log(`placeholders: wrote ${written} SVG(s) to assets/plants/_placeholders/`);
console.log(`worklist: wrote assets/plants/IMAGE_SOURCING.md (${plants.length} rows)`);
