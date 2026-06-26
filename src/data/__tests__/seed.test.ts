/**
 * Seed gate. Two jobs:
 *   1. **Build-time validation** — every shipped plant parses against the zod
 *      schemas (a malformed record fails CI, not the device).
 *   2. **Throwaway-DB load** — the validated rows insert into a real, in-memory
 *      SQLite database (Node's built-in `node:sqlite`) and the row counts equal
 *      the loaded seed arrays, mirroring the on-device expo-sqlite seed without
 *      pulling a native module into the Node test runner.
 *
 * Plus invariants: toxicity is partial and never a safety claim, and the substrate
 * vocabulary is frozen.
 */
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { loadPlants, loadSeed, SUBSTRATE_COMPONENT_IDS } from '..';

const plants = loadPlants();

describe('seed counts', () => {
  it('ships 201 plants', () => {
    expect(plants).toHaveLength(201);
  });

  it('has unique plant slugs', () => {
    expect(new Set(plants.map((p) => p.slug)).size).toBe(plants.length);
  });
});

describe('throwaway SQLite seed', () => {
  it('loads every validated row into an in-memory DB with counts matching the seed', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE plants (slug TEXT PRIMARY KEY, common_name TEXT, image TEXT);`);

    const insP = db.prepare('INSERT INTO plants VALUES (?, ?, ?)');
    for (const p of plants) insP.run(p.slug, p.commonName, p.image ?? null);

    expect((db.prepare('SELECT count(*) c FROM plants').get() as { c: number }).c).toBe(
      plants.length,
    );
    db.close();
  });

  it('loadSeed() returns the validated bundle', () => {
    const seed = loadSeed();
    expect(seed.schemaVersion).toBe(1);
    expect(seed.plants).toHaveLength(plants.length);
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
