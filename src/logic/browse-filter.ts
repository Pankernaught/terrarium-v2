/**
 * Browse filtering + sorting — the pure predicate behind the Browse screen (port
 * of the query in v1 `pages/browse.py::update_table`). Filter set: **type / biome
 * / light / difficulty** + free-text search. Pure over a `Plant[]`, so CI
 * unit-tests it in the node runner — the screen is just the control surface.
 *
 * **Toxicity is deliberately NOT a criterion.** It is display-only, never a filter
 * or facet: a "non-toxic" filter would imply a blank note means "safe," and blank
 * ≠ safe. So there is no toxicity field on `BrowseCriteria`.
 *
 * Imports only `../types` (engine purity: nothing from `src/db` / `src/data`).
 */
import { lightValues, type Plant } from '../types';

export type BrowseSort = 'name' | 'name-desc' | 'difficulty' | 'difficulty-desc' | 'height';

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
  /** Range filter [min, max] in °C. Plant matches if its tempCRange overlaps. */
  tempRange?: [number, number];
  /** Range filter [min, max] in % RH. Plant matches if its humidityPctRange overlaps. */
  humidRange?: [number, number];
  /** Range filter [min, max] in cm. Plant matches if maxHeightCm is within range. */
  heightRange?: [number, number];
  /** When true, only plants with smallTerrariumFriendly === true are returned. */
  smallTerrariumFriendly?: boolean;
  /** 'all' (default) = plant must pass every active facet. 'any' = plant passes if any facet matches. */
  matchMode?: 'all' | 'any';
  sort?: BrowseSort;
}

function matches(plant: Plant, c: BrowseCriteria): boolean {
  // Search always narrows regardless of matchMode.
  if (c.search?.trim()) {
    const q = c.search.trim().toLowerCase();
    const hit =
      plant.commonName.toLowerCase().includes(q) || plant.scientificName.toLowerCase().includes(q) || (plant.notes ?? '').toLowerCase().includes(q);
    if (!hit) return false;
  }

  // Collect one boolean per active facet/range, then AND or OR the lot.
  const facets: boolean[] = [];
  if (c.types?.length) facets.push(!!plant.plantType && c.types.includes(plant.plantType));
  if (c.biomes?.length) facets.push(!!plant.nativeBiome && c.biomes.includes(plant.nativeBiome));
  if (c.lights?.length) {
    // A plant matches a light filter on its primary OR its tolerable secondary (d.15).
    const declared = lightValues(plant.light) as string[];
    facets.push(c.lights.some((l) => declared.includes(l)));
  }
  if (c.difficulties?.length) facets.push(c.difficulties.includes(plant.difficulty));
  if (c.tempRange) {
    const [fLo, fHi] = c.tempRange;
    const [pLo, pHi] = plant.tempCRange;
    facets.push(pLo <= fHi && pHi >= fLo);
  }
  if (c.humidRange) {
    const [fLo, fHi] = c.humidRange;
    const [pLo, pHi] = plant.humidityPctRange;
    facets.push(pLo <= fHi && pHi >= fLo);
  }
  if (c.heightRange) {
    const [fLo, fHi] = c.heightRange;
    facets.push(plant.maxHeightCm >= fLo && plant.maxHeightCm <= fHi);
  }
  if (c.smallTerrariumFriendly) facets.push(!!plant.smallTerrariumFriendly);

  if (!facets.length) return true;
  return c.matchMode === 'any' ? facets.some(Boolean) : facets.every(Boolean);
}

/** Filter then sort. Sort is stable on a `commonName` secondary key (v1 parity). */
export function filterPlants(plants: readonly Plant[], criteria: BrowseCriteria = {}): Plant[] {
  const out = plants.filter((p) => matches(p, criteria));
  const sort = criteria.sort ?? 'name';
  const desc = sort.endsWith('-desc');
  const base = (desc ? sort.slice(0, -5) : sort) as 'name' | 'difficulty' | 'height';
  const dir = desc ? -1 : 1;
  return out.sort((a, b) => {
    if (base === 'difficulty') {
      const d = a.difficulty - b.difficulty;
      return d !== 0 ? d * dir : a.commonName.localeCompare(b.commonName);
    }
    if (base === 'height') {
      const d = a.maxHeightCm - b.maxHeightCm;
      return d !== 0 ? d : a.commonName.localeCompare(b.commonName);
    }
    return a.commonName.localeCompare(b.commonName) * dir;
  });
}
