/**
 * Seed gate. Two jobs:
 *   1. **Build-time validation** — every shipped plant/container/preset parses
 *      against the zod schemas (a malformed record fails CI, not the device).
 *   2. **Throwaway-DB load** — the validated rows insert into a real, in-memory
 *      SQLite database (Node's built-in `node:sqlite`) and the row counts equal
 *      the loaded seed arrays, mirroring the on-device expo-sqlite seed without
 *      pulling a native module into the Node test runner.
 *
 * Plus invariants: toxicity is partial and never a safety claim, the substrate
 * vocabulary is frozen, and the presets reference only real plants/containers.
 */
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import {
  loadContainers,
  loadPlants,
  loadPresets,
  loadSeed,
  SUBSTRATE_COMPONENT_IDS,
} from '..';

const plants = loadPlants();
const containers = loadContainers();
const presets = loadPresets();

describe('seed counts', () => {
  it('ships 243 plants and 16 containers', () => {
    expect(plants).toHaveLength(243);
    expect(containers).toHaveLength(16);
  });

  it('ships 3–5 onboarding presets', () => {
    expect(presets.length).toBeGreaterThanOrEqual(3);
    expect(presets.length).toBeLessThanOrEqual(5);
  });

  it('has unique plant and container slugs', () => {
    expect(new Set(plants.map((p) => p.slug)).size).toBe(plants.length);
    expect(new Set(containers.map((c) => c.slug)).size).toBe(containers.length);
  });
});

describe('throwaway SQLite seed', () => {
  it('loads every validated row into an in-memory DB with counts matching the seed', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE plants (slug TEXT PRIMARY KEY, common_name TEXT, image TEXT);
      CREATE TABLE containers (slug TEXT PRIMARY KEY, name TEXT, volume_l REAL);
      CREATE TABLE presets (slug TEXT PRIMARY KEY, container_slug TEXT, placements TEXT);
    `);

    const insP = db.prepare('INSERT INTO plants VALUES (?, ?, ?)');
    for (const p of plants) insP.run(p.slug, p.commonName, p.image ?? null);
    const insC = db.prepare('INSERT INTO containers VALUES (?, ?, ?)');
    for (const c of containers) insC.run(c.slug, c.name, c.volumeL);
    const insPr = db.prepare('INSERT INTO presets VALUES (?, ?, ?)');
    for (const pr of presets) insPr.run(pr.slug, pr.containerSlug, JSON.stringify(pr.placements));

    expect((db.prepare('SELECT count(*) c FROM plants').get() as { c: number }).c).toBe(
      plants.length,
    );
    expect((db.prepare('SELECT count(*) c FROM containers').get() as { c: number }).c).toBe(
      containers.length,
    );
    expect((db.prepare('SELECT count(*) c FROM presets').get() as { c: number }).c).toBe(presets.length);
    db.close();
  });

  it('loadSeed() returns the bundle and passes referential integrity', () => {
    const seed = loadSeed();
    expect(seed.schemaVersion).toBe(1);
    expect(seed.plants).toHaveLength(plants.length);
    expect(seed.containers).toHaveLength(containers.length);
  });
});

describe('toxicity — free text, blank != safe', () => {
  it('is authored only where botanically real — present on some, absent on most', () => {
    const withTox = plants.filter((p) => p.toxicity);
    expect(withTox.length).toBeGreaterThan(0);
    expect(withTox.length).toBeLessThan(plants.length);
  });

  it('is a non-empty string wherever present', () => {
    for (const p of plants) {
      if (p.toxicity != null) expect(p.toxicity.trim().length).toBeGreaterThan(0);
    }
  });

  it('never renders a blank as a safety claim ("non-toxic" / "safe")', () => {
    // The UI contract is "no note authored", never "Non-toxic ✓". Guard the data
    // so a note can never itself assert safety.
    for (const p of plants) {
      if (p.toxicity) expect(p.toxicity).not.toMatch(/non-?toxic|\bsafe\b|pet[- ]safe/i);
    }
  });
});

describe('substrate vocabulary is frozen', () => {
  it('every substrateTag is a canonical component id', () => {
    for (const p of plants) {
      for (const tag of p.substrateTags) {
        expect(SUBSTRATE_COMPONENT_IDS).toContain(tag);
      }
    }
  });

});

describe('root-depth reference range', () => {
  it('is authored for every plant with min <= max', () => {
    for (const p of plants) {
      expect(typeof p.rootDepthMinCm).toBe('number');
      expect(typeof p.rootDepthMaxCm).toBe('number');
      expect(p.rootDepthMinCm!).toBeLessThanOrEqual(p.rootDepthMaxCm!);
      expect(p.rootDepthMinCm!).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('onboarding presets', () => {
  it('references only real containers and plants', () => {
    const plantSlugs = new Set(plants.map((p) => p.slug));
    const containerSlugs = new Set(containers.map((c) => c.slug));
    for (const preset of presets) {
      expect(containerSlugs.has(preset.containerSlug)).toBe(true);
      expect(preset.placements.length).toBeGreaterThan(0);
      for (const pl of preset.placements) {
        expect(plantSlugs.has(pl.slug)).toBe(true);
        expect(pl.x).toBeGreaterThanOrEqual(0);
        expect(pl.x).toBeLessThanOrEqual(1);
        expect(pl.y).toBeGreaterThanOrEqual(0);
        expect(pl.y).toBeLessThanOrEqual(1);
        expect(pl.scale).toBeGreaterThan(0);
      }
    }
  });
});
