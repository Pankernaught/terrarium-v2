# terrarium-v2 — source layout

React Native + Expo rebuild of the v1 Terrarium Planner (Dash).

## Folders (under `src/`)

| Folder | What lives here |
|---|---|
| `app/` | Expo Router file-based routes = the screens. Four tabs: `index` (Terrariums), `browse`, `care`, `settings`. |
| `components/` | Reusable UI — the component library. |
| `logic/` | Pure engine: compatibility, environment, care, guide, container math, recommend. Vitest-tested. |
| `types/` | TypeScript types + zod schemas (plants, containers, builds, results). |
| `data/` | Bundled versioned seed JSON (`plants.json`, `containers.json`) + onboarding presets. |
| `db/` | Drizzle schema + repositories over expo-sqlite (builds, build-photos, care-marks, placements). |
| `constants/`, `hooks/` | Theme tokens + small hooks (from the Expo template). |

## Note on file layout

This template is `src/`-centric and uses **Expo Router** (file-based routing in `src/app/`),
so "screens" are route files under `app/`. Everything else follows the standard folder names.

## Commands

- `npm start` — Expo dev server (Metro). Open on iPhone via Expo Go, or press `i` / `a` / `w`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm test` / `npm run test:run` — Vitest (pure logic only).
