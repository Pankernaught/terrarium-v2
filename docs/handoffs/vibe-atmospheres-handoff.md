# Handoff — Vibe / atmosphere switcher

> Paste-able context for the next chat. Planning is **done**; nothing is built yet.
> The authoritative decision record is [docs/adr/0007-vibe-atmospheres.md](adr/0007-vibe-atmospheres.md) —
> read it first. This file carries the *semantics and intent* behind those decisions
> so the rebuild doesn't lose the "why."

## What this is

A user-facing **vibe switcher** in Settings that re-skins the entire app — not just
colors, but a coordinated **Tier B** bundle: palette · background · shape · type ·
motion · mascot. Four vibes, each shipping a light **and** dark pair:

- **Glasshouse** — the *current* look. Becomes the default "classic" vibe. Already exists.
- **Conservatory** — dense-jungle flagship. The proof-of-concept. Deep low-key greens,
  gold "sunbeam" accent, **layered foliage behind content with scroll parallax**.
- **Cottagecore** — soft/rounded. The vibe that forces the token-bundle refactor.
- **Field guide** — naturalist/serif.

## The working style this was designed under (don't lose this)

This plan came out of a **ponytail (lazy-senior-dev) grilling session**. The whole
shape of it is "the laziest thing that actually works, reusing what exists." If the
next chat starts adding abstractions, generators, contexts, or dependencies, it has
drifted. Specifically:

- **Reuse the seam, don't rebuild it.** Color theming already flows through
  `useTokens()`. Background mounts in the existing `Screen` wrapper. Parallax reuses
  planner's existing `scrollY` + `interpolate` pattern. Reduce-motion reuses the
  existing `useReducedMotion()`.
- **Defer the expensive thing until it's both needed and verifiable.** The token-bundle
  migration is NOT done up front — it's bound to Cottagecore, the first vibe that
  actually diverges on shape/type, because that's the only point where the refactor can
  be *verified* against a visible change. (Full reasoning in the ADR, decision 2.)
- **Behavior in code, art in files.** Every piece of art is a swappable PNG file-drop;
  only behavior (parallax, future sway) is code.
- **No speculative machinery.** No placeholder generator (only ~8 bespoke files). No
  svg-transformer dep (PNG renders natively). No global scroll context (optional prop).

## The four settled decisions (summary — ADR has the why)

1. **Conservatory = 3 axes only:** palette + background + mascot. Keeps default
   radii/type/motion/spacing → **zero token refactor to ship the flagship.**
2. **Token-bundle refactor deferred to Cottagecore.** The cost is converting
   module-scope `StyleSheet.create` blocks to render-time styles (~21 files); do it when
   a divergent vibe makes it verifiable.
3. **Art = PNG `require()` per vibe bundle, open `art` record, CI-gated, hand-made
   placeholders, no generator.** Artists overwrite the PNG in place (same name/size);
   devs add a slot with one `require` line + one file. Steps are in the ADR.
4. **Background = scroll parallax (T1) at launch; continuous sway (T2) deferred** as a
   structured upgrade inside `<ScreenBackground>`. Mechanism: `Screen` gets an optional
   `scrollY?: SharedValue<number>` prop, forwarded to `<ScreenBackground>`; screens opt
   in by passing their existing `scrollY`; reduce-motion → static.

Build order: **Glasshouse (default) → Conservatory (POC) → Cottagecore (forces
refactor) → Field guide.**

## Codebase facts established this session (verified, don't re-derive)

- `useTokens()` → `Colors[scheme]`; 26 files use it, 3 still import `Colors`. Nest to
  `Colors[vibe][scheme]`.
- `Radii`/`Typography`/`Motion`/`Fonts`/`elevation` are static constants imported at
  ~21 sites; several used inside module-scope `StyleSheet.create` (the refactor's real
  cost) — see `card.tsx`, `chip.tsx`.
- `Screen` ([src/components/ui/screen.tsx](../src/components/ui/screen.tsx)) is a static
  `View`; does **not** own scroll. Single background insertion point.
- Planner ([src/app/planner.tsx](../src/app/planner.tsx)) already has
  `scrollY = useSharedValue(0)` + `useAnimatedScrollHandler` + `interpolate` (header
  collapse) — the parallax driver to reuse. All 6 screens wrap in `<Screen>`; planner's
  `Animated.ScrollView` is *inside* `<Screen>`.
- `useReducedMotion()` already used in
  [src/components/ui/bottom-sheet.tsx](../src/components/ui/bottom-sheet.tsx).
- **No `react-native-svg-transformer`, no `metro.config.js`** → `.svg` files can't be
  `<Image>`-loaded; SVG only works as JSX components. This is why vibe art is PNG.
- **The plant `.svg` placeholders are CI/worklist scaffolding only — never rendered on
  device** (no resolver, real PNGs absent). Don't copy that approach for vibe art,
  which must actually render.
- Persistence pattern: `usePreferences()`
  ([src/hooks/use-preferences.tsx](../src/hooks/use-preferences.tsx)), Context +
  AsyncStorage — add a `pref:vibe` key like `colorScheme`.
- Settings UI: AppearanceSection / SegmentedControl in
  [src/app/settings.tsx](../src/app/settings.tsx).
- Free warmth lever: `Fonts.rounded` is defined but unused (`text.tsx` never sets
  `fontFamily`).

## Suggested first build steps (Conservatory POC)

1. `pref:vibe` in `usePreferences`; grow `useTokens` to resolve `Colors[vibe][scheme]`
   (color only — do **not** add radii/type/motion to the bundle yet).
2. Add the Conservatory palette (light + dark) to `Colors`.
3. `<ScreenBackground>` + `Screen` optional `scrollY` prop; mount behind `children`.
4. `<ConservatoryBackground>` with layered PNG foliage + scroll parallax (reuse
   planner's `interpolate` pattern) + `useReducedMotion` gate.
5. `assets/vibes/conservatory/` with hand-made marked placeholder PNGs (mascot +
   foliage layers — slots already listed in
   [assets/vibes/ART_WORKLIST.md](../assets/vibes/ART_WORKLIST.md)); the `art` record
   on the vibe bundle; the CI gate. Keep the worklist table current.
6. Vibe switcher in Settings (start: Glasshouse + Conservatory).
7. Hand planner's `scrollY` to `<Screen scrollY={…}>` to demo parallax.

**Hard rule before writing any code:** read the versioned Expo docs at
https://docs.expo.dev/versions/v56.0.0/ (per AGENTS.md). Conservatory ships with **no**
token-bundle refactor — that's a Cottagecore-phase job.
