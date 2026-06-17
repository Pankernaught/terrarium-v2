# terrarium-v2 — source layout

React Native + Expo rebuild of the v1 Terrarium Planner (Dash). See `Rebuild docs/` for the
full spec (decisions 1–18) and `MIGRATION.md` for phase status + how to continue the build.

## Folders (under `src/`)

| Folder | What lives here | Built in |
|---|---|---|
| `app/` | Expo Router file-based routes = the screens. Four tabs: `index` (Terrariums), `browse`, `care`, `settings`. | Phase 1 shell; real screens 5–7 |
| `components/` | Reusable UI — the component library. | Phase 5 |
| `logic/` | Ported pure engine: compatibility, environment, care, guide, container math, recommend. Vitest-tested. | Phase 2 |
| `types/` | TypeScript types + zod schemas (plants, containers, builds, results). | Phase 2–3 |
| `data/` | Bundled versioned seed JSON (`plants.json`, `containers.json`) + onboarding presets. | Phase 3 |
| `db/` | Drizzle schema + repositories over expo-sqlite (builds, build-photos, care-marks, placements). | Phase 4 |
| `constants/`, `hooks/` | Theme tokens + small hooks (from the Expo template; refined in Phase 9). | — |

## Reconciliation note

The migration docs name a flat `screens/` folder. This template is `src/`-centric and uses
**Expo Router** (file-based routing in `src/app/`), so "screens" are route files under `app/`.
Everything else maps 1:1 to the plan's names.

## Commands

- `npm start` — Expo dev server (Metro). Open on iPhone via Expo Go, or press `i` / `a` / `w`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` / `npm run test:run` — Vitest (pure logic only).
