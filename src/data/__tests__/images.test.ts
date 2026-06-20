/**
 * Image-layer invariants. The real plant photos are a human, accuracy-first CC
 * pass that lands later; this gate guards the *scaffolding* around it so the
 * layer can never drift into an unsafe state:
 *
 *   (a) every plant declares a slug-consistent `plants/<slug>.png` image path;
 *   (b) every plant has a stylized PLACEHOLDER asset on disk
 *       (`assets/plants/_placeholders/<slug>.svg`) — built by
 *       `scripts/build-placeholders.mjs`, so a new seed plant without a placeholder
 *       fails CI rather than rendering a broken image on device;
 *   (c) if a real photo is sourced under a CC-BY / CC-BY-SA license, its
 *       attribution (`imageCredit`) must be present — the license obligation is
 *       machine-enforced, not left to reviewer memory;
 *   (d) no forbidden license ever ships: `-NC` (NonCommercial) or `-ND`
 *       (NoDerivatives — a uniform crop is a derivative). See
 *       `assets/plants/IMAGE_SOURCING.md`.
 *
 * (c) and (d) are intentionally *vacuous today* — no plant has `imageLicense` yet —
 * but they must already pass, so the rule is live the moment the first real photo
 * (and its license) lands.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadPlants } from '..';

const plants = loadPlants();

// Tests run from the repo root (cwd), so the placeholder dir resolves off cwd.
const PLACEHOLDER_DIR = join(process.cwd(), 'assets', 'plants', '_placeholders');

const CC_BY = /cc[- ]?by/i;
// `-NC`/`-ND` as license tokens (e.g. CC-BY-NC-SA, CC-BY-ND-4.0) or spelled out.
// Anchored on `-` / boundary so it never matches an "nc"/"nd" buried in a word.
const FORBIDDEN_LICENSE = /[-\s](nc|nd)\b|noncommercial|noderiv/i;

describe('image path — every plant has a slug-consistent image', () => {
  it('is a non-empty `plants/<slug>.png` matching the record’s own slug', () => {
    for (const p of plants) {
      expect(typeof p.image).toBe('string');
      expect(p.image!.length).toBeGreaterThan(0);
      expect(p.image).toBe(`plants/${p.slug}.png`);
    }
  });
});

describe('placeholder assets — stylized fallback for every plant', () => {
  it('has a placeholder SVG on disk for every plant slug', () => {
    const missing = plants
      .map((p) => p.slug)
      .filter((slug) => !existsSync(join(PLACEHOLDER_DIR, `${slug}.svg`)));
    expect(missing).toEqual([]);
  });
});

describe('license → credit invariant (CC-BY[-SA] requires attribution)', () => {
  it('every CC-BY / CC-BY-SA plant carries a non-empty imageCredit', () => {
    for (const p of plants) {
      if (p.imageLicense && CC_BY.test(p.imageLicense)) {
        expect(typeof p.imageCredit).toBe('string');
        expect(p.imageCredit!.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('forbidden licenses (no -NC, no -ND)', () => {
  it('no plant ships a NonCommercial or NoDerivatives license', () => {
    for (const p of plants) {
      if (p.imageLicense) {
        expect(p.imageLicense).not.toMatch(FORBIDDEN_LICENSE);
      }
    }
  });
});
