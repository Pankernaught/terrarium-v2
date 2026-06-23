# Plant Admin

A Curator-only local web tool for editing two repo data files without hand-editing
JSON: the **Plant Catalog** (`src/data/plants.json`) and the **technical-term
glossary** (`src/data/glossary.json`, ADR 0006). Form-based, switched by the
**Plants | Terms** toggle in the header.

```bash
npm run plant-admin     # → http://localhost:4317
```

Open the URL in a browser. The left pane lists every record (search + filter); the
middle pane is a full form generated from the schema; the right pane is a verify
panel. Both modes share one form engine — add / edit / delete / autosave behave the
same; only the fields, the filter, and the verify panel differ.

## Plants mode

The list filters by plant type; the verify panel is a per-field review checklist
(state kept in `localStorage`). See "What it does on save" below.

## Terms mode (glossary)

Edit the dictionary that powers Browse → Terms and the app's inline tap-to-define
links. Fields: **term**, **slug**, **category**, **definition**, and **see also**
(a list of related-term slugs, autocompleted from every existing term).

- **Enum-backed categories** (light, moisture, pH, growth rate/habit, plant type,
  biome, substrate) are coverage-checked: a term's slug *must* equal the controlled-
  vocab value it explains (e.g. `light` → `bright-indirect`). The validator lists the
  allowed slugs if you pick a wrong one.
- **Free-form categories** (`concept`, `anatomy`) take any kebab slug — this is the
  open-ended part of the dictionary you grow by hand.
- The verify panel shows the **coverage worklist**: every enum-backed vocab value
  that has no entry yet. It is empty when every chip is explained; click a gap to
  open the add form pre-filled with the right slug + category.
- `see also` links and (in Plants mode) inline `[[slug]]` prose links are validated
  against the live glossary on save, so a typo flags in-tool, not just in CI.

## What it does on save (Plants)

1. **Validates** the record against the same rules as `seedPlantSchema`
   (required fields, frozen enums/vocab, ranges, cross-field bounds, unique slug).
   Bad input is rejected — `plants.json` is never written in a broken state.
2. **Derives `image`** as `plants/<slug>.png` (the `images.test` invariant — you
   never type the image path).
3. **Writes `plants.json`**, canonical-ordering new/edited records. Untouched
   records stay byte-identical, so the diff only shows what you changed.
4. **Saves an uploaded photo** (optional, PNG) to `assets/plants/<slug>.png`.
5. **Regenerates placeholder SVGs** (`scripts/build-placeholders.mjs`) so a new
   plant always has the placeholder asset CI requires.

Saving a **term** is simpler: validate (`validateTerm`) → write `glossary.json`.
No image, no placeholder regen.

It does **not** touch the database. Restart the Expo dev server to pick up
changes — the idempotent seed re-syncs both files on launch.

## Notes

- Pure Node (`http`/`fs`) — zero dependencies, no build step.
- `field-spec.js` is the single source of truth for fields + validation; it is
  `require`d by the server and injected into the page so both sides agree.
- The vocabularies in `field-spec.js` **mirror** `src/types/plant.ts`,
  `src/data/substrate-components.ts`, and `src/types/glossary.ts` (categories,
  `vocabSlug`, the `moderate` slug clash). If you add an enum value or substrate
  component there, mirror it here — the glossary coverage worklist reads the same
  vocab.
- Both files are written as 2-space JSON so untouched records stay byte-identical
  (small diffs). `plants.json` uses standard `JSON.stringify`; `glossary.json` keeps
  its inline `seeAlso` arrays and blank lines between category groups, so the server
  has a dedicated format-preserving serializer for it.
- Deleting a plant leaves its photo/placeholder files on disk and orphans any
  saved build that referenced it. Recover via git if needed.
- Real photos must be CC-licensed; fill in image credit/license. See
  `assets/plants/IMAGE_SOURCING.md`.

See `docs/adr/0005-plant-admin-standalone-web-tool.md` for the design rationale.
