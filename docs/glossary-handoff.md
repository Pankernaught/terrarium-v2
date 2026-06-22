# Handoff — Phase E: glossary authoring tool + tier-3 tagging

> **Phases A–D are done and CI-green** (365 tests, `tsc` + lint clean). The glossary
> ships and works: data, pure logic, the Browse "Plants | Terms" screen + `TermSheet`,
> and inline links (plant-sheet chips/stats/prose) with seed-time + test integrity
> gates. **This doc is only Phase E** — the curator-side authoring tool and the
> tier-3 anatomy pass. Paste it into a fresh chat to build.

## Read first
- **ADR 0006** (`docs/adr/0006-glossary-tool.md`) — the glossary design.
- **ADR 0005** (`docs/adr/0005-plant-admin-standalone-web-tool.md`) — the admin tool you're extending.
- Memory `project_glossary_tool.md` (built-artifact map + the `moderate` slug clash) and
  `project_plant_admin_tool.md` (admin-tool decisions as built).

## What A–D already gave you (don't rebuild)
- `src/types/glossary.ts` — `glossaryEntrySchema` (`slug`, `term`, `category`, `definition`, `seeAlso`),
  `GLOSSARY_CATEGORIES`, `GLOSSARY_CATEGORY_LABELS`, `ENUM_BACKED_CATEGORIES`,
  `VOCAB_SLUG_OVERRIDES`, and `vocabSlug(category, value)`.
- `src/data/glossary.json` — `{ schemaVersion: 1, terms: [...] }`, 73 entries (52 enum-backed +
  15 concept + 6 anatomy). Loader `loadGlossary()` / `lookupTerm(slug)` in `src/data/index.ts`.
- `src/data/__tests__/glossary.test.ts` — the **CI gate**: enum coverage, unique slugs, `seeAlso`
  resolves, the `moderate` disambiguation, and (already wired) **every `[[slug]]` in plant
  `notes`/`nativeContext` resolves**. `loadSeed()` also throws on an unresolved prose link.
- Pure `src/logic/glossary-markup.ts` (`parseGlossaryMarkup`, `glossaryMarkupSlugs`) + `glossary-filter.ts`.

So the data model, the CI integrity gates, and the runtime are settled. Phase E is **authoring
ergonomics**: edit `glossary.json` and tag prose without hand-editing JSON.

## Settled decisions (do not re-litigate)
- One `src/data/glossary.json`, keyed by globally-unique `slug`. Enum-backed categories
  (light/moisture/ph/growthRate/growthHabit/plantType/biome/substrate) are coverage-checked;
  `concept`/`anatomy` are free-form.
- The **`moderate` clash**: `moderate` is both a moisture level and a growth rate, so enum-backed
  slugs go through `vocabSlug()` (`moderate-moisture`, `moderate-growth`); nothing claims a bare
  `moderate`. Any vocab→slug logic in the tool **must** mirror `vocabSlug`.
- Prose links are author-controlled `[[slug]]` / `[[slug|display]]` (NOT auto-scan).
- 2–4 sentence entries (definition + a terrarium "why"); LLM-drafted, curator-curated; no citations v1.

## How the admin tool is built (the shape you extend)
Pure Node, **zero dependencies**, no build step. Three files in `tools/plant-admin/`:
- **`field-spec.js`** — the single source of truth. Exports `SPEC` = `{ GROUPS, ALL_FIELDS,
  WRITE_ORDER, <vocab arrays>, slugify, validatePlant, canonicalize }`. It is both `require()`d by
  the server (authoritative validation) **and injected verbatim** into the page at the
  `/*__FIELD_SPEC__*/` marker, so the form renders and validates from the exact same rules.
- **`server.js`** — `http`/`fs` only. `readDoc()`/`writeDoc()` read & write `src/data/plants.json`
  as **2-space JSON + trailing newline** (untouched records stay byte-identical). Routes:
  GET `/`, GET/POST `/api/plants`, PUT/DELETE `/api/plants/:slug`. `upsert()` validates via
  `spec.validatePlant(record, otherSlugs)` → 422 on failure, else canonicalize + write.
- **`index.html`** — a 3-pane SPA (list | form | verify-panel). `renderForm()` builds the form from
  `SPEC.GROUPS`; `controlHtml(f, v)` switches on `f.kind`; `collect()` reads the DOM back into a
  record; validation runs on blur + autosave (`SPEC.validatePlant`). Start it: `npm run plant-admin`
  → http://localhost:4317 (`PORT` env to override).

`field-spec.js` **mirrors the app's frozen vocab** (`src/types/plant.ts`, `src/data/substrate-components.ts`).

> ⚠️ **Fix this first — a real drift bug.** `field-spec.js` `PLANT_TYPES` is missing `bromeliad`,
> which the app enum has and **13 seed plants use**. Today the tool can't edit those plants (the
> enum validator rejects `bromeliad`). Add it before building, because the glossary's `plantType`
> coverage worklist reads the same vocab and must list all 12 types.

---

## Phase E build plan

### E1 — Glossary editor in the admin tool
Add a **"Plants | Terms" mode toggle** to the SPA; in Terms mode the list/form/verify-panel operate
on glossary entries. Mirror the plant editor's architecture rather than inventing a new one.

**`field-spec.js` additions** (export them all on `SPEC`):
- `GLOSSARY_CATEGORIES`, `GLOSSARY_CATEGORY_LABELS`, `ENUM_BACKED_CATEGORIES` — mirror
  `src/types/glossary.ts`.
- `VOCAB_SLUG_OVERRIDES` + `vocabSlug(category, value)` — mirror the app (the `moderate` clash).
- `ENUM_VOCAB` — the `category → values[]` map for the eight enum-backed groups, reusing the vocab
  arrays already in this file (`LIGHT_LEVELS`, …, `SUBSTRATE_IDS`).
- `GLOSSARY_GROUPS` — the form spec (the `GROUPS` analog), fields:
  `slug` (`text`, `slug:true`), `term` (`text`, required), `category` (`enum` over
  `GLOSSARY_CATEGORIES`, required), `definition` (`textarea`, required),
  `seeAlso` (**new `sluglist` kind** — see below).
- `GLOSSARY_WRITE_ORDER = ['slug','term','category','definition','seeAlso']` + `canonicalizeTerm(rec)`
  (drop empty `seeAlso`, same empty-stripping rules as `canonicalize`).
- `validateTerm(rec, otherSlugs, knownSlugs)`:
  - required `slug`/`term`/`category`/`definition`; `slug` kebab; `category ∈ GLOSSARY_CATEGORIES`;
    `slug` unique vs `otherSlugs`.
  - **enum-backed rule:** if `category` is enum-backed, `slug` must equal `vocabSlug(category, value)`
    for some `value` in `ENUM_VOCAB[category]` (stops the editor minting an enum-backed slug the
    coverage test won't expect). Free-form `concept`/`anatomy` skip this.
  - every `seeAlso` entry resolves to a `knownSlugs` member (include the record's own slug).
  - definition ends with terminal punctuation (mirror the test's prose check).

The **`sluglist` kind** (for `seeAlso`): a dynamic list of slug text inputs (mirror the existing
`kv`/`links` add/remove-row pattern in `index.html`), each backed by a shared `<datalist>` of all
term slugs for autocomplete, with unresolved entries flagged inline. Add a `controlHtml`/`collect`
branch for it.

**`server.js` additions:**
- `GLOSSARY_JSON = src/data/glossary.json`; `readGlossary()`/`writeGlossary()` (same 2-space + newline).
- Routes: GET `/api/glossary`, POST `/api/glossary`, PUT/DELETE `/api/glossary/:slug`. The glossary
  upsert is **simpler than plants** — no image, no `regenPlaceholders()`. Validate via
  `spec.validateTerm(record, otherTermSlugs, allTermSlugs)`, canonicalize, write the `{ schemaVersion,
  terms }` doc preserving untouched entries.
- **Coverage worklist:** include in the GET `/api/glossary` payload a `missing` list = for each
  enum-backed category, the `value`s whose `vocabSlug(category, value)` has no entry. (Empty now — it
  earns its keep when someone adds an enum value.) Surface it in the Terms-mode verify panel.

**`index.html` additions:**
- A header **Plants | Terms** toggle (mirror the app's Browse toggle).
- Recommended: generalize the form engine into a per-mode **entity config**
  (`{ groups, fields, validate, slugKey, listLabels, hasImage, autoSlugFrom }`) so `renderForm`,
  `collect`, `showErrors`, and the list reuse one path. Plants: `autoSlugFrom: 'scientificName'`,
  `hasImage: true`. Terms: `autoSlugFrom: 'term'`, `hasImage: false`, list shows `term` + category.
- Terms-mode verify panel shows the coverage worklist instead of per-field checks.

### E2 — `[[slug]]` validation on plant save
Make a typo'd prose link flag **in-tool** (not only in CI). The server already reads files; in the
**plant** upsert path, read `glossary.json`, build the slug set, and run a prose-link check on
`notes`/`nativeContext` (reuse `glossaryMarkupSlugs` logic — copy the ~6-line regex into
`field-spec.js` as `proseLinkSlugs(text)` so the spec stays self-contained and injectable). Extend
the signature to `validatePlant(rec, existingSlugs, knownGlossarySlugs)` and attach an error to the
offending textarea field. The Phase D seed-time throw + test remain the CI backstop.

### E3 — Tier-3 anatomy pass
1. `grep` the 243 plants' `notes` / `nativeContext` in `src/data/plants.json` for anatomy terms.
   `rhizome`, `frond`, `stolon`, `node`, `petiole`, `crozier` are already defined; expect more in the
   prose (e.g. spore/sori, pup/offset, runner, midrib, lamina, whorl).
2. Define the ones that actually appear (category `anatomy`) via the new editor.
3. Tag occurrences with `[[ ]]` (e.g. `spreads by [[rhizome|rhizomes]]`) via the editor — which now
   flags unresolved links on save. Keep it to genuinely useful, unambiguous mentions.
4. `npm run test:run` — the integrity gate proves every tag resolves.

## Hard constraints
- **Mirror, don't fork the vocab.** `field-spec.js` duplicates the app's frozen vocab by design; keep
  it in sync (and fix the `bromeliad` gap above). The glossary category/vocab/`vocabSlug` additions
  must match `src/types/glossary.ts` rule-for-rule.
- **Pure Node, zero deps.** No Express, no build step. Write JSON as 2-space + trailing newline so
  untouched `glossary.json` entries stay byte-identical (the plant tool's round-trip discipline).
- **Curator-only.** The tool never ships to end users; it edits repo files. The app picks up
  `glossary.json` on the next Expo restart (no DB).
- This is a Node tool, **not RN** — the AGENTS.md "read Expo 56 docs" rule doesn't apply here.

## Definition of done
- Add/edit/delete a term in the tool; `glossary.json` round-trips byte-identical for untouched
  entries; `glossary.test.ts` + `seed.test.ts` stay green.
- The coverage worklist renders (empty today; correctly lists a value if you temporarily remove an
  entry to test it).
- A plant saved with an unresolved `[[slug]]` is rejected (422) with a field error.
- `bromeliad` editable again; the 13 bromeliad plants validate.
- Anatomy terms that appear in prose are defined and tagged; full suite green.
