/**
 * Glossary domain type — the technical-term dictionary (ADR 0006).
 *
 * One entry per term, keyed by a **globally-unique `slug`**. Vocab terms reuse the
 * canonical enum ids from `./plant` (`LIGHT_LEVELS`, `PLANT_TYPES`, …) and the
 * substrate component ids, so a rendered chip can resolve its own definition with a
 * direct lookup — no string-matching, normalization, or parallel key table. The
 * `category` groups entries for the Terms-mode filter and separates the
 * coverage-checked enum-backed groups from the free-form concept/anatomy dictionary.
 *
 * **Slug uniqueness.** Enum values are unique across every controlled vocabulary
 * with one exception — `moderate` is both a moisture level *and* a growth rate — so
 * `vocabSlug()` disambiguates those two with a category suffix and nothing claims a
 * bare `moderate` key. Everywhere a chip resolves its definition it knows its own
 * category, so it calls `vocabSlug(category, value)`; prose `[[slug]]` links and
 * `seeAlso` cross-links use the bare unique slug.
 *
 * Layering: this is a pure type/shape module (zod only). The loader
 * (`loadGlossary`/`lookupTerm`) and the enum-coverage check live in `src/data`; the
 * pure `filterGlossary`/`parseGlossaryMarkup` consumers live in `src/logic`.
 */
import { z } from 'zod';

/**
 * The ten glossary groups. The first eight are **enum-backed** — every value of the
 * matching controlled vocabulary must have an entry (coverage-checked in
 * `src/data`). `concept` and `anatomy` are **free-form**: the curator authors slugs
 * and display terms freely, with no coverage check.
 */
export const GLOSSARY_CATEGORIES = [
  'light',
  'moisture',
  'ph',
  'growthRate',
  'growthHabit',
  'plantType',
  'biome',
  'substrate',
  'concept',
  'anatomy',
  'pest-disease',
] as const;
export type GlossaryCategory = (typeof GLOSSARY_CATEGORIES)[number];

/** Display labels for the category filter chips and the sheet's category badge.
 *  An explicit map (not `humanize`) so `ph` reads "pH", not "Ph". */
export const GLOSSARY_CATEGORY_LABELS: Record<GlossaryCategory, string> = {
  light: 'Light',
  moisture: 'Moisture',
  ph: 'pH',
  growthRate: 'Growth rate',
  growthHabit: 'Growth habit',
  plantType: 'Plant type',
  biome: 'Biome',
  substrate: 'Substrate',
  concept: 'Concept',
  anatomy: 'Anatomy',
  'pest-disease': 'Pest & Disease',
};

/**
 * The eight coverage-checked groups — every controlled-vocab value must resolve to
 * an entry. `concept`/`anatomy` are deliberately excluded (they have no enum).
 */
export const ENUM_BACKED_CATEGORIES = [
  'light',
  'moisture',
  'ph',
  'growthRate',
  'growthHabit',
  'plantType',
  'biome',
  'substrate',
] as const satisfies readonly GlossaryCategory[];
export type EnumBackedCategory = (typeof ENUM_BACKED_CATEGORIES)[number];

export const glossaryEntrySchema = z.object({
  /**
   * Globally-unique kebab id. Enum-backed entries use the canonical vocab value
   * (disambiguated by `vocabSlug` for the moisture/growthRate `moderate` clash);
   * free-form entries are curator-authored.
   */
  slug: z.string().min(1),
  /** Display name, shown as the list label and sheet title (e.g. `'LECA'`). */
  term: z.string().min(1),
  category: z.enum(GLOSSARY_CATEGORIES),
  /** 2–4 sentences: a plain definition + a terrarium-specific "why it matters". */
  definition: z.string().min(1),
  /** Cross-links to other entries, by slug. Powers the `seeAlso` swap in `TermSheet`. */
  seeAlso: z.array(z.string()).default([]),
});
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

/**
 * Category-qualified slug overrides. The enum vocabularies are globally unique
 * except `moderate`, which is both a `moisture` level and a `growthRate`; both get a
 * suffixed slug so neither silently claims the bare `moderate` key. Keyed
 * `"<category>/<value>"`.
 */
export const VOCAB_SLUG_OVERRIDES: Readonly<Record<string, string>> = {
  'moisture/moderate': 'moderate-moisture',
  'growthRate/moderate': 'moderate-growth',
};

/**
 * The glossary slug for an enum-backed `(category, value)` pair — identity except
 * for the disambiguated `moderate` collision. A chip rendering `plant.growthRate`
 * resolves its definition via `lookupTerm(vocabSlug('growthRate', plant.growthRate))`.
 */
export function vocabSlug(category: EnumBackedCategory, value: string): string {
  return VOCAB_SLUG_OVERRIDES[`${category}/${value}`] ?? value;
}
