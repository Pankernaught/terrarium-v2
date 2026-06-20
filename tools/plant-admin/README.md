# Plant Admin

A Curator-only local web tool for adding, editing, and removing plants in the
Plant Catalog (`src/data/plants.json`). Form-based — no hand-editing JSON.

```bash
npm run plant-admin     # → http://localhost:4317
```

Open the URL in a browser. The left pane lists every plant (search by name/slug,
filter by plant type); the right pane is a full form generated from the schema.

## What it does on save

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

It does **not** touch the database. Restart the Expo dev server to pick up
changes — the idempotent seed re-syncs `plants.json` on launch.

## Notes

- Pure Node (`http`/`fs`) — zero dependencies, no build step.
- `field-spec.js` is the single source of truth for fields + validation; it is
  `require`d by the server and injected into the page so both sides agree.
- The vocabularies in `field-spec.js` **mirror** `src/types/plant.ts` and
  `src/data/substrate-components.ts`. If you add an enum value or substrate
  component there, mirror it here.
- Deleting a plant leaves its photo/placeholder files on disk and orphans any
  saved build that referenced it. Recover via git if needed.
- Real photos must be CC-licensed; fill in image credit/license. See
  `assets/plants/IMAGE_SOURCING.md`.

See `docs/adr/0005-plant-admin-standalone-web-tool.md` for the design rationale.
