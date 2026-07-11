---
status: accepted
---

# Vibe / atmosphere switcher

A user-facing **vibe switcher** in Settings re-skins the whole app across a
coordinated bundle of axes (palette · background · shape · type · motion · mascot),
moving the app beyond its single "premium/calm" identity. Ships **Tier B** (color +
texture + shape). Vibes: **Glasshouse** (the current look, becomes the default
"classic"), **Conservatory** (dense-jungle flagship), **Cottagecore**, **Field
guide**. **Status: planning only — nothing is implemented yet.** This ADR records
the decisions from the grilling session so the build doesn't re-derive them.

## Context

The theming seam already exists and is half-migrated:

- **Color is solved.** Everything flows through `useTokens()`
  ([src/hooks/use-tokens.ts](../../src/hooks/use-tokens.ts)) → `Colors[scheme]`. 26
  files use the hook; only 3 still import `Colors` directly. Nesting the palette to
  `Colors[vibe][scheme]` recolors every screen with ~zero component edits.
- **The catch:** `Radii`, `Typography`, `Motion`, `Fonts`, `elevation()` are
  **static module constants** ([src/constants/theme.ts](../../src/constants/theme.ts))
  imported directly at ~21 sites — and several are used *inside* module-scope
  `StyleSheet.create` (e.g. `card.tsx`, `chip.tsx`), where a hook can't run. Routing
  those through a theme bundle is the real refactor.
- **Background is net-new.** The single insertion point is the `Screen` wrapper
  ([src/components/ui/screen.tsx](../../src/components/ui/screen.tsx)) — today a static
  `View` painting `c.background`. It does **not** own scrolling; each screen owns its
  own scroll surface.

## Decisions

### 1. Conservatory diverges on exactly 3 axes

Palette, background, and mascot. It **keeps** Glasshouse's radii, type, motion, and
spacing. (Memory: "density belongs in the backdrop, not the layout.") Consequence:
the flagship ships with **zero token-bundle migration** — only the `Colors[vibe]`
recolor, the new `<ScreenBackground>`, and art slots.

### 2. The token-bundle refactor is deferred to Cottagecore, not done up front

The refactor's cost is **not** find/replace — it's converting module-scope
`StyleSheet.create` blocks to render-time styles (`useMemo(() => StyleSheet.create(…),
[tokens])` or a `makeStyles(tokens)` factory). Two facts drove the deferral:

- The unit of work is **per-file, not per-axis**: once a file's styles read `tokens`,
  it's vibe-ready across radii *and* type *and* fonts at once.
- **Cottagecore (soft radii + rounded type) is a global change** — it forces
  converting essentially all ~21 files anyway. Doing the migration *with* Cottagecore
  means each converted file is verified against a **visible** difference; doing it
  up-front means verifying "looks identical," which catches nothing — and risks
  migrating `motion` for an axis no shipped vibe may ever change.

"More vibes are coming" makes the work *real*, not *earlier*. The first divergent
vibe is what makes the refactor safe to do.

### 3. Art = PNG file-drop placeholders, owned per-vibe, expandable

Each vibe **owns its art** the way each plant owns its `image`: as static `require()`
literals on the vibe bundle (TS, not JSON — Metro can only bundle static `require`,
never `require(dynamicString)`).

```ts
conservatory: {
  art: {                                            // open Record<string, ImageSource>
    mascot:       require('@/assets/vibes/conservatory/mascot.png'),
    foliageBack:  require('@/assets/vibes/conservatory/foliage-back.png'),
    foliageFront: require('@/assets/vibes/conservatory/foliage-front.png'),
    // a 4th/5th slot is just another line — expandable by construction
  },
}
```

- **PNG, not SVG.** RN renders PNG natively via `<Image>` with **zero new deps**. SVG
  files would require `react-native-svg-transformer` + a `metro.config.js` (neither
  exists) — adding a dependency for what the native path already does. PNG also
  matches plants (`plants/<slug>.png`) and is what human artists deliver.
- **Behavior in code, art in files.** The background is a *component*
  (`<ConservatoryBackground>`) whose parallax/sway logic is code, but whose foliage
  layers are PNG files. So even the most complex piece stays a file-drop for the artist.
- **Open `art` record** trades per-slot compile-time type-safety for expandability (a
  typo'd slot name is a runtime miss). The CI gate covers missing files; this is the
  right trade given "must be expandable."
- **CI gate** (mirrors [images.test.ts](../../src/data/__tests__/images.test.ts)):
  every art file a bundle references must exist on disk under `assets/vibes/`.
- **No generator.** The plant generator
  ([scripts/build-placeholders.mjs](../../scripts/build-placeholders.mjs)) earns its
  keep at ~67 plants because of scale + churn + *template uniformity* (one card, N data
  rows). Vibe art is ~8 *dissimilar* bespoke files that barely change — none of the
  three conditions hold. Hand-author the placeholders once.

> **Correction worth recording:** the plant `.svg` placeholders are **never rendered
> on device** — there's no svg-transformer, no `metro.config.js`, no resolver, and the
> real PNGs don't exist yet. They are *CI/worklist scaffolding*, not a runtime
> fallback. Vibe placeholders **must** render (they show where art goes in the
> flagship), which is exactly why they use **PNG + `<Image>`**, not the plant SVG
> approach.

#### Human steps — swapping a placeholder for real art (artist)

1. Get the slot's path from the vibe bundle's `art` map (e.g.
   `assets/vibes/conservatory/mascot.png`).
2. Export the real art to **PNG**, **same filename**, **same pixel dimensions** as the
   placeholder it replaces.
3. Overwrite the file in place. Done — no code change. (HMR/rebuild picks it up.)

#### Human steps — future expansion (dev)

- **Add a slot to a vibe:** add one `require('@/assets/vibes/<vibe>/<slot>.png')` line
  to that vibe's `art` map, drop a marked placeholder PNG at the path. The CI gate
  picks it up automatically.
- **Add a whole new vibe:** add a bundle (palette + `art` map + optional background
  component), create `assets/vibes/<vibe>/`, drop placeholders. Add it to the Settings
  switcher list. The gate enforces its art exists.

These steps live (co-located with the assets, mirroring `IMAGE_SOURCING.md`) in
[assets/vibes/ART_WORKLIST.md](../../assets/vibes/ART_WORKLIST.md) — keep its worklist
table current as slots/vibes are added.

### 4. Background ships scroll-parallax; continuous sway is deferred

Three tiers were considered: T0 static, T1 scroll-parallax, T2 continuous sway.
**T1 ships at launch; T2 (sway) is a documented, structured upgrade — not vague
"maybe later."**

Mechanism (reuses what's already there — no new infrastructure):

1. **`Screen` gains one optional prop, `scrollY?: SharedValue<number>`.** When the
   active vibe has a background, `Screen` mounts `<ScreenBackground scrollY={scrollY}/>`
   absolutely-positioned behind `children`.
2. **Screens opt in by passing their existing `scrollY`.** Planner already owns one
   ([planner.tsx:115](../../src/app/planner.tsx)); the *same* shared value feeds both
   header-collapse and parallax (one ref, two consumers — no conflict). A screen
   without scroll omits the prop → background renders at rest (graceful degrade).
3. **`<ScreenBackground>` parallaxes each PNG layer** via `useAnimatedStyle` +
   `interpolate(scrollY.value, …)` at different rates — the planner's own UI-thread
   pattern, reused.
4. **Reduce-motion:** reuse `useReducedMotion()` (already used in
   [bottom-sheet.tsx:55](../../src/components/ui/bottom-sheet.tsx)) → layers static.
5. **Sway (T2)** is a continuous Reanimated loop added *inside* `<ScreenBackground>`
   later, behind the same reduce-motion gate — zero change to `Screen`, the bundle, or
   any screen.

Rejected: a global scroll context, or making `Screen` own the scroll view. Both are
real refactors that fight the existing per-screen scroll ownership (especially
planner's header-collapse). The optional-prop approach is incremental opt-in.

### 5. Build order

**Glasshouse** (already exists) → **Conservatory** (the proof-of-concept: proves a
vibe can recolor + re-backdrop the whole app) → **Cottagecore** (forces the
token-bundle refactor) → **Field guide**.

> Default vibe: the 2026-06-22 amendment (below) flips the default `pref:vibe` from
> Glasshouse to **Conservatory**, so new users land in the vibe that ships character
> art. Glasshouse becomes the opt-in "classic." Build order is unchanged.

## Architecture invariants (so they aren't re-derived)

- Persistence: copy the `colorScheme` pattern in `usePreferences()`
  ([src/hooks/use-preferences.tsx](../../src/hooks/use-preferences.tsx)) for a
  `pref:vibe` key (Context + AsyncStorage).
- Settings UI: extend AppearanceSection / SegmentedControl in
  [src/app/settings.tsx](../../src/app/settings.tsx).
- Quick warmth lever (independent of vibes): `Fonts.rounded` (`ui-rounded`) is defined
  but unused — `text.tsx` never sets `fontFamily`.
- Keep the team rules: never encode meaning in color alone; AA contrast on deep
  palettes; respect reduce-motion; every vibe ships a light **and** dark pair; channel
  all new looks through tokens (no scattered magic values).

## Consequences

- Conservatory is shippable with no refactor — fast proof-of-concept.
- The painful migration is real but deferred to the moment it's both needed and
  verifiable (Cottagecore).
- Art is fully file-drop for artists; expansion is one line + one file for devs.
- Open `art` record means slot typos are caught by CI (missing file) / a small
  non-empty-key check, not the compiler.

## Amendment (2026-06-22): character art — mascot & critters

The Conservatory POC is **built** (palette nest → `Colors[vibe][scheme]`,
`<ScreenBackground>`/`<ConservatoryBackground>` scroll-parallax, `pref:vibe`, the
Settings switcher, the CI gate). A follow-up grilling session then settled how
*character art* works — the mascot and the "little critters" that make a vibe feel
alive. These refine decision 3 (art) and decision 1 (Conservatory's axes); A10
supersedes decision 5's "Glasshouse default." Full intent + artistic vision live in
[docs/handoffs/vibe-mascot-critters-handoff.md](../handoffs/vibe-mascot-critters-handoff.md).

### A6. Character art plays two roles — keep them distinct

- **Ambient critters** — small creatures living *in the backdrop*, on every screen,
  unobtrusive. The "the terrarium is alive" layer.
- **Featured mascot** — a larger, deliberate character in *empty states*. The greeter.

Different art, different mount points, different intent. Don't conflate them.

### A7. The cast: one posed mascot + an open critter set

- One **main mascot** with **named, open pose slots** (`default`, `sad`, … expandable).
- An **open `critters` set** — same file-drop + CI-gate contract as foliage. Ships
  **one** critter now; more are PNG drops, no code change (mechanism for many, ship
  one — mirrors decision 3). The artist's "other little guys" land by file-drop.
- Art contract on the Conservatory bundle:

```ts
conservatory: {
  foliageBack, foliageFront,                               // backdrop (built)
  critters: { <name>: require('@/assets/vibes/conservatory/critters/<name>.png') },
  mascot:   {
    default: require('@/assets/vibes/conservatory/mascot/default.png'),
    sad:     require('@/assets/vibes/conservatory/mascot/sad.png'),
  },
}
```

The CI gate is a text-scan for `require()` paths, so nesting doesn't break it — every
referenced file is still asserted to exist.

### A8. Critters live in the foliage zone + margins, hand-placed

- Tucked among the bottom foliage band and lifted into the side gutters — **a few
  fixed, hand-placed spots, not a procedural scatter** (a scatter engine is code to
  debug for a feeling 3–4 chosen spots already give). They inherit the foliage
  layers' parallax.
- **Unobtrusive by construction:** content sits *above* the band / inside the centered
  `maxWidth` column, so critters never land behind text — no AA risk, for free.
- The backdrop's current placeholder *mascot* layer is **reassigned to a critter**; the
  main mascot moves out to empty states.
- Rejected (for now): full-screen scatter that puts critters behind content — the
  louder, legibility-reopening design. Revisit only if the foliage zone feels too
  contained.

### A9. Featured mascot: Tier-1 + Tier-2 empty states only

- **Tier 1** (first-run: home "No terrariums yet", care "Nothing to tend yet") →
  `default` pose.
- **Tier 2** (Browse search no-match: "No plants match" / "No terms match") → `sad`
  pose. A failed search earns a commiserating face, not a cheery one.
- **Tier 3** (inline sub-section empties in `build/[id]`) → nothing. Too small;
  double-stacks with the ambient critters already in that screen's backdrop.
- **Layout:** centered above the title, ~100px, **static** — ambient critters carry the
  motion, so the featured mascot is a calm focal point (and sidesteps reduce-motion for
  this element).
- **Implementation:** extract one shared `<EmptyState>` (home + care are duplicated
  today). It renders the active vibe's mascot pose **iff defined** → graceful, so
  Glasshouse stays text-only. Browse's two no-match cards reuse it with the `sad` pose.
  The duplication dies as a bonus.

### A10. Conservatory becomes the default vibe (supersedes decision 5's default)

- All character art is per-vibe; only Conservatory ships it, and **graceful absence
  stays the rule** (render iff the vibe defines the art) — Glasshouse shows none.
- But the art is invisible until you switch, so **flip the default `pref:vibe` to
  `conservatory`** (the `DEFAULT_VIBE` constant in `usePreferences`). One line, fully
  reversible, zero art cost. Glasshouse becomes the opt-in "classic."
- Rejected: authoring mascot + critters for *every* vibe — the most art for a payoff
  you can't judge until the Conservatory version proves the feeling.

### A11. One PNG per asset; dark override only on demand

- Each pose/critter is a **single transparent PNG** designed to read on both
  Conservatory schemes (own value contrast + a subtle rim, never relying on the
  background). Conservatory's surfaces diverge hard (`#F7F9F0` vs `#152217`).
- Add a `<asset>-dark.png` **only** for a specific asset that fails on one scheme once
  real art lands — pay per-asset, not preemptively across every slot.

### Parked

- **Sweetening the clinical empty-state copy** — a separate pass; the `<EmptyState>`
  extraction is where it lands.
- **Content-level critters (on / around the cards, not just the backdrop)** —
  deferred until the real art lands. Today critters live in the *backdrop*
  (`StyleSheet.absoluteFill` behind content), so the opaque cards occlude any critter
  positioned where a card sits; they only peek through the gaps (below content, side
  gutters, row-gaps). Making a critter appear *on* a card (a frog on a build card's
  corner, a snail tucked beside a planner row) means lifting critters **out of the
  backdrop into the content layer** — per-screen, content-relative placement. That is
  the design A8 deliberately rejected: it reopens the legibility/AA question (art over
  text) and adds a new mount mechanism + a global-ish placement concern (a handoff
  "drift tell"). **Why wait:** the payoff can't be judged on the magenta placeholders
  — same reasoning as A10 (don't build the expensive, taste-dependent layer before the
  real art proves the feeling). **Trigger:** revisit once Conservatory's real critter/
  mascot art is in place and the backdrop-only critters feel too contained. **Scope
  when revisited:** its own content-layer mount with an occlusion/AA guard so critters
  never sit over text, and an ADR amendment recording the placement rules — not a free
  extension of `CRITTER_SPOTS`. (Adding more *backdrop* peek-spots stays in-bounds and
  needs no ADR change — that's just more `CRITTER_SPOTS` lines.)

## Amendment (2026-06-26): Conservatory canopy — slot-filled plant scatter

The Conservatory backdrop is **reworked from two full-width foliage PNGs into a dense
canopy of individual, overlapping hand-drawn plant sprites** that re-arrange each cold
launch. This **reverses two earlier calls** and records why the reversal is warranted.
Code: [canopy.ts](../../src/components/vibes/canopy.ts) (pure layout),
[conservatory-background.tsx](../../src/components/vibes/conservatory-background.tsx)
(render), [art.ts](../../src/components/vibes/art.ts) (pools),
[canopy.test.ts](../../src/data/__tests__/canopy.test.ts) (invariants).

### B1. A scatter engine now exists — but only for the canopy (revises A8)

A8 rejected a procedural scatter ("code to debug for a feeling 3–4 chosen spots already
give") and kept critters at fixed hand-placed spots. That reasoning held for **a few
critters**; it does not hold for **a canopy of many plants meant to read differently
every launch** — hand-placing dozens of per-load arrangements is the unlazy path. So:

- **Critters stay fixed-spot** (`CRITTER_SPOTS`, A8 unchanged) — still a feeling a few
  spots give.
- **The canopy is the scatter engine**, but a *constrained* one: **slot-fill**, not free
  scatter. The bottom is divided into N overlapping slots; each slot is guaranteed
  filled (a random sprite + bounded jitters). This buys the dense "mature planting" look
  **every** load — no gap-roulette, which free random placement can't promise — while
  staying trivially testable (assert every slot filled, no adjacent duplicate).

### B2. Two depth rows replace the two foliage PNGs (revises decision 3)

`foliageBack`/`foliageFront` are **retired** (files left on disk, unreferenced). The two
parallax layers are reused as **two slot-filled depth rows** — back (smaller, higher,
slow drift) and front (larger, bottom-rooted, fast drift). The depth illusion that sold
the old band now emerges from the sprites themselves. Parallax mechanism (decision 4)
and reduce-motion gate are **unchanged**; randomization is not motion, so reduce-motion
users still get a (static) canopy.

### B3. Art contract: two flat sprite pools, same file-drop + CI gate

The bundle gains `bottomSprites: number[]` (canopy fill) and `focalSprites: number[]`
(see B4) — plain arrays of `require()` ids, no per-sprite metadata (the layout decides
scale/flip/row/z at runtime). Sprite art contract: **transparent PNG, plant base rooted
at the image's bottom edge, varied aspect welcome** (sprites scale by *width*, anchored
at the bottom → taller art rises higher for free). Drop a PNG in
`assets/vibes/conservatory/canopy/` (or `focal/`), add one `require()` line. The
existing text-scan gate ([vibe-art.test.ts](../../src/data/__tests__/vibe-art.test.ts))
covers them with no change. Empty pools render nothing — the mechanism ships now, the
art lands by file-drop.

### B4. "Sides" cut; a focal category added instead

The request began as two sprite categories, **bottom + sides**. Sides were **dropped**:
on a phone the content runs edge-to-edge (only `Spacing.md` gutter) and the backdrop
sits *behind* content, so side sprites would land behind text — reopening the A8
legibility rule for no payoff until a gutter-having tablet/web layout exists (YAGNI;
revisit then as a third pool + render path). The "two categories" instinct is instead
spent where it earns its keep: an optional **focal** plant — `focalSprites`, **≤1 per
cold launch (~50% chance)**, scaled taller to rise ~½–⅔ screen as a centerpiece. It
*does* poke into the text band behind content; the focal-chance constant is the dial if
a load feels busy.

### B5. Randomness is per cold launch; layout is a pure, testable function

`buildCanopy(pool, rng = Math.random)` is **pure** (no React/RN) and computed **once at
module load**, so the arrangement is fresh each app start but **stable across
navigation** (the backdrop mounts behind every `Screen` — re-rolling per mount would
teleport plants on every screen change). `rng` is injected only so
[canopy.test.ts](../../src/data/__tests__/canopy.test.ts) can pin it and assert the
invariants. Per-slot jitters (bounded): horizontal flip, scale, x-nudge, z-order, and
(back row) a small vertical lift. Tunables are named constants at the top of
`canopy.ts` — the calibration knobs, set against real art.

## Related

ADR 0005 (plant-admin), ADR 0006 (glossary); habitat-expansion (idea: atmosphere
could optionally follow habitat type).
