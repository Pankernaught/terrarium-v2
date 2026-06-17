/**
 * Browse filtering + sorting — the pure predicate behind the Browse screen
 * (port of the query in v1 `pages/browse.py::update_table`, reshaped to the
 * decision-1 mobile filter set: **type / biome / light / difficulty** + free-text
 * search). Pure over a `Plant[]`, so CI unit-tests it in the node runner (the
 * "CI tests pure logic only" split) — the screen is just the control surface.
 *
 * **Toxicity is deliberately NOT a criterion (decision 8).** It is display-only,
 * never a filter or facet: a "non-toxic" filter would imply a blank note means
 * "safe," and blank ≠ safe. So there is no toxicity field on `BrowseCriteria`.
 *
 * Imports only `../types` (engine purity: nothing from `src/db` / `src/data`).
 */
import { lightValues, type Plant } from '../types';

export type BrowseSort = 'name' | 'difficulty' | 'height';

export interface BrowseCriteria {
  /** Case-insensitive substring over common + scientific name. */
  search?: string;
  /** Multi-select; empty/absent = any. Matched against `plantType`. */
  types?: string[];
  /** Multi-select; empty/absent = any. Matched against `nativeBiome`. */
  biomes?: string[];
  /** Multi-select; empty/absent = any. Matches the plant's primary OR secondary light. */
  lights?: string[];
  /** Multi-select; empty/absent = any. Matched against `difficulty` (1–5). */
  difficulties?: number[];
  sort?: BrowseSort;
}

function matches(plant: Plant, c: BrowseCriteria): boolean {
  if (c.search && c.search.trim()) {
    const q = c.search.trim().toLowerCase();
    const hit =
      plant.commonName.toLowerCase().includes(q) || plant.scientificName.toLowerCase().includes(q);
    if (!hit) return false;
  }
  if (c.types && c.types.length > 0) {
    if (!plant.plantType || !c.types.includes(plant.plantType)) return false;
  }
  if (c.biomes && c.biomes.length > 0) {
    if (!plant.nativeBiome || !c.biomes.includes(plant.nativeBiome)) return false;
  }
  if (c.lights && c.lights.length > 0) {
    // A plant matches a light filter on its primary OR its tolerable secondary (d.15).
    const declared = lightValues(plant.light) as string[];
    if (!c.lights.some((l) => declared.includes(l))) return false;
  }
  if (c.difficulties && c.difficulties.length > 0) {
    if (!c.difficulties.includes(plant.difficulty)) return false;
  }
  return true;
}

/** Filter then sort. Sort is stable on a `commonName` secondary key (v1 parity). */
export function filterPlants(plants: readonly Plant[], criteria: BrowseCriteria = {}): Plant[] {
  const out = plants.filter((p) => matches(p, criteria));
  const sort = criteria.sort ?? 'name';
  return out.sort((a, b) => {
    const primary =
      sort === 'difficulty'
        ? a.difficulty - b.difficulty
        : sort === 'height'
          ? a.maxHeightCm - b.maxHeightCm
          : 0;
    return primary !== 0 ? primary : a.commonName.localeCompare(b.commonName);
  });
}
