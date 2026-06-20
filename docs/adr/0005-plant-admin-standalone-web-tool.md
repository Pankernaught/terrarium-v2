# Plant admin tool is a standalone local web app, not an in-app screen

The Curator needs a form-based UI for adding, editing, and removing plants from the Plant Catalog (`src/data/plants.json`). The plant schema has ~25 fields with typed inputs, enum dropdowns, range constraints, multi-select checkboxes, and a dynamic key/value editor — hand-editing JSON is error-prone and slow.

A dedicated Expo dev screen (e.g. `/admin/plants` behind `__DEV__`) was considered. It would share the existing schema types and seed pipeline, but would add dead weight to the production bundle (even behind a flag, the code is bundled), require React Native form primitives that are more awkward than plain HTML inputs, and complicate file-write access (Expo's sandboxed environment makes writing back to `src/data/plants.json` from within the app non-trivial).

Instead, the tool is a single Node script at `tools/plant-admin/server.js` that serves a self-contained HTML page. It reads and writes `src/data/plants.json` and saves uploaded images directly — no build step, no Expo dependency, no production footprint. The Curator starts it with `npm run plant-admin` and accesses it at localhost. After editing, the existing idempotent seed pipeline picks up changes on the next Expo dev-server restart.

**Implementation notes (refinements during the build):**

- **Pure Node `http`/`fs`, not Express.** Express is not a project dependency, and adding it (plus a multipart parser for uploads) would violate this repo's dependency discipline. Node's built-in `http` is sufficient; uploaded photos are sent as base64 PNG data URLs in the JSON body, so no multipart parsing is needed.
- **`image` is derived, never entered.** `src/data/__tests__/images.test.ts` enforces `image === "plants/<slug>.png"`, so the server computes it from the slug rather than exposing it as a form field.
- **Photos save to `assets/plants/<slug>.png`** (repo root, beside the placeholder dir), not `src/assets/plants/` — that is the real asset convention the image tests resolve against.
- **Placeholder regeneration is part of every save.** A new plant has no placeholder SVG, and `images.test` fails CI without one. So after writing `plants.json` the server runs `scripts/build-placeholders.mjs`. This is distinct from the database seed (which is deliberately left for the Expo restart) — it is a CI-correctness step, not a data-sync step.
- **Untouched records stay byte-identical.** The server re-serializes the whole file with `JSON.stringify(doc, null, 2)`, which round-trips the existing formatting exactly; only new/edited records are re-keyed into canonical order, so diffs show only real changes.
- **`field-spec.js` is shared** between server (authoritative validation) and client (form generation + on-blur validation) — one spec, two runtimes, no drift.

This tool is Curator-only and never ships to users.
