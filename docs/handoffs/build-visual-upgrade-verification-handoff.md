# Build visual upgrade — verification handoff

> **PARTLY SUPERSEDED 2026-06-23.** The **per-habit plant silhouettes** and the
> **tiered/ghost height warning** were reverted to the original 3px sticks + binary
> overflow (the blobs didn't read as plants — see ADR 0011). The silhouette/ghost
> verification items below are **moot**. Still live and worth verifying: the glass
> sheen, condensation (sealed+lidded), substrate seams + surface crust, and the
> un-clipped H label.

**Status:** code BUILT, `tsc` clean, logic CI-green, **UNCOMMITTED on `main`**. Visual
verification **PARTIAL** — see below. This doc is the resume point.

Covers the 7-item cross-section upgrade (ADR 0011): per-habit plant silhouettes,
tiered visual height warning + ghost-to-max foliage, glass sheen, condensation,
H-label clip fix, substrate surface crust, and the pre-existing sine-wave seams.

## Confirmed visually (web preview, 2026-06-23)

- **Renders DB-free.** `/planner` (new build) renders the cross-section without
  `expo-sqlite` — `loadPlants()` reads bundled `plants.json` and a new build starts
  from `emptyDraft()`. The home library and DB-backed routes are irrelevant here.
- **(c) Glass sheen + condensation.** `xs-glass-sheen` gradient is present and applied
  (`url(#xs-glass-sheen)` rect); condensation droplets are visible in the upper air of
  a **lidded** build.
- **(d) H dimension label no longer clips.** `H: 25cm` sits fully inside the canvas
  (the `PAD_X = 28` fix). Width label + vessel still centre.
- Lid line + vessel walls render correctly.

## NOT yet verified (blocked this session)

- **(a)** distinct silhouettes per `growthHabit` + distinct sage tints for same-habit plants
- **(b)** ghost breaking above the rim + tiered badge with `~Xcm` copy; a fitting plant showing neither
- **(e)** seams still wave + the surface crust reads (substrate *was* configured, but no
  planted screenshot was captured before the blocker)

## Why it blocked

The preview browser runs the page in a **hidden tab** (`document.visibilityState ==
"hidden"`), so the browser **never fires `requestAnimationFrame`**. The cross-section
itself renders (it's synchronous), but the Plants **catalog** defers its ~243 rows one
frame via `InteractionManager.runAfterInteractions` (`plants-step.tsx`, `rowsReady`).
With rAF parked, that gate never resolves → the catalog is stuck on its spinner → no
plants can be added → no planted scene to verify. **This is a preview-harness artifact,
not an app bug.** On a real device/simulator there is no hidden-tab rAF throttling.

## How to finish — two paths

**Path A — device/simulator (project norm, most reliable).** A Pixel_9 Android emulator
is already provisioned. `expo start` then run on Android, or use Expo Go. Native
`react-native-svg` renders directly; the rAF/hidden-tab issue does not exist. This is
the canonical UI-verification path for this repo.

**Path B — web preview (if device is unavailable).**
1. `app.json` → set `web.output` from `"static"` to `"single"` (SPA mode). Static/SSR
   output fails to bundle on web because `expo-sqlite`'s web worker imports a `.wasm`
   Metro can't resolve on the server-render target. **Revert to `"static"` afterward** —
   it's production web-deploy config, not part of this feature.
2. `preview_start "web"` (the config is in `.claude/launch.json`). Resize to mobile.
3. Navigate to `/planner` (new build renders DB-free).
4. To unstick the deferred catalog in the hidden tab: in `preview_eval`, install a
   `setTimeout`-based `requestAnimationFrame` shim, **then remount `PlantsStep`
   (Back → Next)** so its `runAfterInteractions` re-registers through the shim.
   *(This last step was interrupted before it was confirmed to work; if a held
   interaction handle keeps the gate stuck even after remount, fall back to Path A.)*

## Controlled test scene (use these exact plants)

Container: **Rectangular 30×20×25, Lidded** (the defaults a single "Rectangular" tap
seeds). Substrate + drainage auto-seed from the 15 L volume; **add Charcoal** for the
third seam and a couple of mix ingredients (e.g. Perlite, Peat) for substrate marks.
Air above substrate (headroom) ≈ 13–18 cm.

**Only 6 of 243 seed plants carry `typicalHeightCm`,** and the ghost-to-max foliage renders
only when `maxHeightCm > typicalCm`. So the scene must use those 6 to exercise the soft
tier + ghost. Selection below covers all 6 habits, all 3 fit tiers, and a same-habit
tint pair:

| Plant | slug | habit | typ/max cm | expected |
|---|---|---|---|---|
| Asparagus Fern | `asparagus-setaceus` | climbing | 20 / 60 | **HARD** ⚠️ + ghost |
| Parlor Palm | `chamaedorea-elegans` | upright | 10 / 40 | **SOFT** ↑ + ghost breaking rim |
| Bambino Alocasia | `alocasia-amazonica-bambino` | upright | 10 / 35 | **SOFT** (2nd upright → tint check) |
| Air Plant | `tillandsia-ionantha` | rosette | 2 / 12 | **FITS** (control: no badge) |
| String of Turtles | `peperomia-prostrata` | trailing | – / 5 | fits (trailing silhouette) |
| Star Moss | `hyophila-involuta` | mounding | – / 3 | fits (mounding dome) |
| Pocket Moss | `fissidens-fontanus` | creeping | – / 3 | fits (creeping spread) |

Add each via its catalog row `aria-label="Add <commonName>"`. Then screenshot the
docked hero preview at the top of the Plants step (or open **Arrange** for a full-size
canvas) and check (a), (b), (e). Tooltip copy comes from `planner.fit.outgrow` /
`planner.fit.tooTall` (tap the badge).

## Finding worth surfacing to the owner

Because only **6/243** plants have `typicalHeightCm`, the **soft "will outgrow at maturity"
tier is unreachable for the other 237** — with `typical == max`, a plant can only read
as `fits` or `hard` (ghost height = 0). If the soft nudge is meant to be a common,
gentle signal, `typicalHeightCm` needs authoring across the catalog. Until then the tiered
warning is effectively binary for almost the whole catalog. (Belongs with the
carry-forward data-authoring backlog, not this code change.)

## Temp changes made this session

- `app.json` `web.output` flipped to `"single"` then **reverted** to `"static"`.
- `.claude/launch.json` — added a `"web"` preview config (**kept**; aids future verification).
- Cleared `.expo/static-tmp` cache (regenerates on next build).
- Killed a stale 2h-old `expo start` (pid 7552) that was holding port 8081.

## Commit plan (unchanged from the original plan, once verified)

1. **First commit = the wave seams:** `src/logic/substrate-wave.ts` +
   `src/logic/__tests__/substrate-wave.test.ts` + the wave changes in `cross-section.tsx`.
2. **Then the rest:** silhouettes, tiered warning + ghost, sheen, condensation, H-label
   fix, crust, copy keys, ADR 0011 + both handoff docs.
