/**
 * Glossary filtering — the pure predicate behind the Browse "Terms" mode (ADR
 * 0006), mirroring `browse-filter.ts`. Filter set: **category chips** + free-text
 * search over the term, its slug, and its definition. Pure over a `GlossaryEntry[]`
 * (data passed as an argument), so CI unit-tests it in the node runner — the screen
 * is just the control surface.
 *
 * Imports only `../types` (engine purity: nothing from `src/db` / `src/data`).
 */
import type { GlossaryEntry } from '../types';

export interface GlossaryCriteria {
  /** Case-insensitive substring over term + slug + definition. */
  search?: string;
  /** Multi-select; empty/absent = any. Matched against `category`. */
  categories?: string[];
}

function matches(entry: GlossaryEntry, c: GlossaryCriteria): boolean {
  if (c.search && c.search.trim()) {
    const q = c.search.trim().toLowerCase();
    const hit =
      entry.term.toLowerCase().includes(q) ||
      entry.slug.toLowerCase().includes(q) ||
      entry.definition.toLowerCase().includes(q);
    if (!hit) return false;
  }
  if (c.categories && c.categories.length > 0) {
    if (!c.categories.includes(entry.category)) return false;
  }
  return true;
}

/** Filter then sort alphabetically by display term (stable, case-insensitive). */
export function filterGlossary(
  entries: readonly GlossaryEntry[],
  criteria: GlossaryCriteria = {},
): GlossaryEntry[] {
  return entries.filter((e) => matches(e, criteria)).sort((a, b) => a.term.localeCompare(b.term));
}
