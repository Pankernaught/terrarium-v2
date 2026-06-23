# Handoff — Conservatory character art (mascot & critters)

> Paste-able context for the next chat. The **decision record** is
> [docs/adr/0007-vibe-atmospheres.md](adr/0007-vibe-atmospheres.md), amendment
> **A6–A11** (2026-06-22) — read it first for the *what* and the terse *why*. This
> file carries the **artistic vision** and the **full build context** so the next
> chat builds the right feeling, not just the right code.
>
> The vibe-system handoff ([docs/vibe-atmospheres-handoff.md](vibe-atmospheres-handoff.md))
> is the parent; this is the character-art chapter.

## What this is

Two layers of character art that turn the **Conservatory** vibe from "a green skin"
into a **living terrarium**:

1. **Ambient critters** — tiny creatures tucked into the background foliage, on every
   screen, that you *notice* rather than *look at*.
2. **A featured mascot** — a single posed character who greets you in empty states
   (welcoming on first-run, commiserating on a failed search).

Conservatory is the flagship and (per A10) **becomes the default vibe**, so this is
what a new user sees on first launch.

## Artistic vision (build for this feeling)

**Conservatory's one line: "Lush, humid, overgrown depth."** Everything here serves
that. The palette already does the heavy lifting — deep jungle greens, a gold
"sunbeam" accent, near-black depths in dark mode. The character art adds the thing a
palette can't: **life that moves and reacts.**

**The diorama, not the wallpaper.** The backdrop is layered (far foliage → mid →
near) and scroll-parallaxes at different rates, so the app reads as a *terrarium you're
looking into* — glass with depth behind it — not a flat themed surface. Critters live
*inside* that diorama, between the leaves. When you scroll, a critter drifts with the
leaf it's sitting on. That parallax-coupling is what sells "it's alive in there."

**Ambient, not attention-seeking.** The critters are a reward for noticing, never a
demand for attention. They sit low (in the foliage band) and in the margins (the empty
gutters beside the content column). They never overlap text, never animate
distractingly, never block a tap. The bar: a user focused on their task should be able
to ignore them completely — and a user who glances at the edges should catch a little
frog half-hidden under a leaf and smile. If they're ever *noticeable while you're
reading*, they're too loud.

**The mascot is a companion, not a brand stamp.** It shows up exactly when the screen
is empty — the one moment there's nothing else to look at and a friendly face is
welcome, not noise. First-run home, an empty care schedule: the `default` pose says
"let's grow something." A search that found nothing: the `sad` pose shares the small
disappointment with you. Same character, reading the room. (We deliberately *don't* put
it on failed searches as a cheery mascot — that reads as mocking.)

**Restraint is the aesthetic.** This is a calm, premium app (the token system is "the
engine of premium"). The character art has to feel *hand-placed and intentional*, like
a terrarium someone arranged — not procedurally scattered, not animated for its own
sake. A few well-chosen critters beat a swarm. One static, centered mascot beats a
bouncing one. The motion budget is already spent on the parallax; the characters are
the still life within it.

**Light and dark are both first-class.** Dark mode is the *flagship* mood — deep jungle
night, the gold sunbeam glowing. Each character must read on both the light surface
(`#F7F9F0`) and the near-black dark surface (`#152217`) on its own value contrast, with
a subtle rim so it never dissolves into the background.

### What the real art should be (for the artist)

The placeholders are loud magenta hazard-checkerboards — deliberately unmistakable,
*not* a style reference. The real art direction:

- **Critters:** small terrarium fauna — tree frogs, snails, a beetle, a gecko, a
  springtail, a tiny isopod. Storybook-naturalist, soft-edged, slightly stylized. Sized
  to peek (≈40–90px on screen). Transparent PNG, one per critter, expandable set.
- **Mascot:** one recurring character with personality — most likely a friendly frog or
  a leaf-sprite that fits the jungle. Poses are *expressions* of the same character:
  `default` (open, welcoming), `sad` (drooping, sympathetic). Transparent PNG, ~100px on
  screen, more poses by file-drop later.
- **Tone:** warm, a little whimsical, never cute-to-the-point-of-childish. It shares the
  app's calm. Think botanical-illustration-meets-gentle-mascot.

## Current state (what's already built)

On branch **`feat/vibe-atmospheres`** (not yet committed). The Conservatory vibe POC is
built and CI-green (typecheck + 383 tests + clean lint on the diff); **UI is
device-unverified** (consistent with this project's CI/device split):

- `Colors[vibe][scheme]` nesting; Conservatory light+dark palettes — `src/constants/theme.ts`
- `pref:vibe` (mirrors `colorScheme`) — `src/hooks/use-preferences.tsx`
- `useTokens()` resolves `Colors[vibe][scheme]`, exposes `vibe` — `src/hooks/use-tokens.ts`
- `<Screen scrollY?>` mounts a full-bleed backdrop behind padded content — `src/components/ui/screen.tsx`
- `<ScreenBackground>` dispatcher + `<ConservatoryBackground>` (3 PNG layers,
  scroll-parallax, reduce-motion gate) — `src/components/vibes/`
- Open `require()` art map + CI gate — `src/components/vibes/art.ts`,
  `src/data/__tests__/vibe-art.test.ts`
- Settings switcher (generic `SegmentedControl`) — `src/app/settings.tsx`
- Planner hands its `scrollY` to `<Screen>` to demo parallax — `src/app/planner.tsx`
- Marked placeholder PNGs — `assets/vibes/conservatory/`

**Important:** the current backdrop has a placeholder **mascot** layer (bottom-right,
120×120). Per A8, that layer is **reassigned to a critter** and the mascot moves to
empty states. Don't keep two mascots.

## Decision ledger (settled — do not re-derive)

See ADR A6–A11. In one breath:

1. Two roles: **ambient critters** (backdrop, everywhere) + **featured mascot** (empty
   states). Distinct art, distinct mounts.
2. Cast: **one posed mascot** (`default`/`sad`, open) + **open `critters` set**; ship
   one critter now, expand by file-drop.
3. Critters: **foliage zone + side margins**, a few **fixed hand-placed spots**, inherit
   foliage parallax; never behind text.
4. Backdrop's placeholder mascot layer → **becomes a critter**.
5. **Conservatory is now the default vibe** (`DEFAULT_VIBE`); art stays Conservatory-only
   with **graceful absence** elsewhere (render iff the vibe defines it).
6. Empty-state scope: **Tier 1** (home, care) `default`; **Tier 2** (Browse no-match)
   `sad`; **Tier 3** none.
7. Featured mascot: **centered above title, ~100px, static**.
8. **One PNG per asset**; add `-dark` only if a specific asset fails on one scheme.
9. Parked: sweetening the clinical empty-state copy.

## Art contract & assets

```ts
// src/components/vibes/art.ts — Conservatory bundle
conservatory: {
  foliageBack, foliageFront,                                  // built
  critters: { <name>: require('@/assets/vibes/conservatory/critters/<name>.png') },
  mascot:   {
    default: require('@/assets/vibes/conservatory/mascot/default.png'),
    sad:     require('@/assets/vibes/conservatory/mascot/sad.png'),
  },
}
```

- New asset folders: `assets/vibes/conservatory/mascot/` and `.../critters/`.
- Reuse the existing `mascot.png` placeholder as the **first critter** (rename/move);
  hand-make new marked placeholders for `mascot/default.png`, `mascot/sad.png`, and the
  shipped critter (stdlib-Python encoder, loud checkerboard, same as before — throwaway,
  not committed).
- The CI gate (`vibe-art.test.ts`) text-scans `require()` paths, so nested slots work
  unchanged — but confirm it still finds every new file, and **update the worklist
  table** (`assets/vibes/ART_WORKLIST.md`) with the new slots + their pixel dimensions
  (the swap rule depends on documented dimensions).

## Codebase seam to reuse (don't rebuild)

- **Backdrop:** add critters as siblings of the foliage PNGs *inside*
  `src/components/vibes/conservatory-background.tsx`. They go in (or beside) the existing
  parallax `Animated.View`s — reuse the `interpolate(scrollY)` pattern already there. No
  new infrastructure, no global context.
- **Mascot accessor:** the featured mascot needs to be read by the active vibe + pose,
  gracefully (vibe may not define one). Add a tiny accessor near the art map (e.g.
  `vibeMascot(vibe, pose): number | undefined`) so `<EmptyState>` stays vibe-agnostic.
- **EmptyState:** there is **no shared empty-state component** — `index.tsx` and
  `care.tsx` each have a *duplicated* local `EmptyState`, and `browse.tsx` uses inline
  `ListEmptyComponent` cards. Extract one shared `<EmptyState>` in `src/components/ui/`
  that takes `{ pose, title, body, cta? }`, renders the vibe mascot pose iff defined
  (centered, ~100px, static, on the card's solid surface — never behind text), and use
  it at all four sites. This is the lazy *and* clean move (kills the duplication).
- **Default flip:** one line — `DEFAULT_VIBE = 'conservatory'` in `use-preferences.tsx`.

## Build plan (ordered)

1. Flip `DEFAULT_VIBE` → `conservatory` (`use-preferences.tsx`).
2. Restructure `art.ts` to the A7 contract; create `mascot/` + `critters/` folders;
   make marked placeholder PNGs (reuse old `mascot.png` as critter #1); update the CI
   gate references + the worklist table.
3. `conservatory-background.tsx`: remove the mascot layer; add a few hand-placed critter
   spots (foliage band + margins), inheriting parallax + the reduce-motion gate.
4. Shared `<EmptyState>` in `ui/` + the graceful `vibeMascot(vibe, pose)` accessor.
5. Swap `index.tsx` + `care.tsx` to the shared `<EmptyState>` (`default` pose); swap
   `browse.tsx`'s two no-match cards (`sad` pose).
6. Verify: `npx tsc --noEmit`, `npx vitest run` (gate green), lint the diff clean.

## Working style (don't lose this)

This was designed under **ponytail (lazy-senior-dev)**. The whole shape is "the laziest
thing that actually works, reusing what exists." Tells you've drifted: a procedural
scatter engine, a new animation system, art behind content, per-vibe art authored
before Conservatory's is even evaluated, a global context. **Behavior in code, art in
files. Mechanism for many, ship one. Defer the expensive thing until it's verifiable.**

Per AGENTS.md: read the versioned Expo docs (https://docs.expo.dev/versions/v56.0.0/)
before writing code — `expo-image` renders the PNGs (`source={require(...)}`,
`contentFit`), reanimated drives the parallax (reuse the planner pattern).
