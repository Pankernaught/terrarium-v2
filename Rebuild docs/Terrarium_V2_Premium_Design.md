# Terrarium V2 — Engineering the “Premium” Feel

*The techniques we’re using, the token system that drives them, and how they map onto each screen. For a solo, offline-first RN/Expo build.*

*Amended by the V2 grill session (decisions 1–18) — see `Terrarium_V2_Grill_Decisions.md`. Most relevant here: desktop is cut (iOS + Android only, decision 1); the 3-D scene is deferred to v2.1 (decision 5), so v2.0’s only preview is the 2-D front view; and the **60fps performance gate is now thread-split** (decision 14) — the drag holds 60fps on every device because it is transform/opacity-only on the UI thread, while 30fps is a JS-thread design budget on a low-end reference, so the §1/§3 “animate transform+opacity only” rule is load-bearing, not stylistic. Decisions 10–13 and 15–18 (build-guide projection, plant-image source, substrate deferral, care scope, scoring algorithm, notification scheduling, backup versioning, content pipeline) are data/flow/content concerns with no token-level impact here.*

Premium is restraint: pick a few techniques and execute them relentlessly. For a solo, offline-first RN app the wins are a small token system (spacing / type / shadow / color / motion / haptics), semantic haptics, gentle springs, and progressive disclosure — applied everywhere. This document lists the techniques we’re keeping, turns them into tokens, and maps them onto the dashboard, planner, and plant sheet.

## 1.  The techniques we’re using

Each is tuned for two facts: we’re building in React Native (mobile), not the web, and the app is offline-first — all data is local, so there is no network to hide.

| **Technique** | **How we apply it (RN)** |
| --- | --- |
| Spring physics & easing | Gentle, near-critically-damped springs (little/no overshoot) for a calm, earth-modern feel. Reserve overshoot for one or two delight moments (the Eco-balance fill). Reanimated withSpring on the UI thread. |
| Shared-element transitions | Card-photo → build-detail hero — a perfect fit for a photo-centric app. Reanimated sharedTransitionTag / Expo Router shared transitions; make it P1 and test on a device. |
| Semantic haptics | Best ROI on the list. expo-haptics, mapped to events (see the Haptic map). Always semantic, never decorative. |
| Perceptual color (OKLCH), as a method | Resolve OKLCH → hex at build time (e.g. with culori); RN’s StyleSheet doesn’t parse oklch() at runtime. The one runtime payoff: interpolate the Eco-balance meter green → amber → red in OKLCH so it doesn’t go muddy. |
| Adaptive dark mode | A light + dark palette built off one lightness ladder (shift lightness, hold the mood) — two resolved palettes, not live oklch() math on device. |
| Typography | One quality typeface, 2–3 static weights, a tight modular scale of 1.2 (minor third). |
| Shadows & borders | Cross-platform premium = 1 soft shadow + a hairline border (the brief’s “pixel borders + soft shadows”). True multi-layer ambient shadows are iOS-only (P2). |
| Progressive disclosure / Hick’s law | The backbone — this is the tier system. The premium layer makes the tier boundaries physical (a real gesture between Tier 2 and Tier 3). |
| Macro-whitespace / Gestalt grouping | Negative space as the boundary, not borders/boxes — operationalized by the spacing scale so it’s consistent, not vibes. |
| Optimistic UI | Offline writes are effectively instant: never await the SQLite write before re-rendering — update state, persist async. Add an undo snackbar for destructive actions. |
| Precompute & memoize | The offline equivalent of predictive fetch: cache each build’s score and its 2-D preview layout (and, in v2.1, its 3-D mesh) so screen transitions are instant rather than recomputing on navigate. |
| 60fps / no layout thrash | Animate only transform + opacity via Reanimated worklets; never width/height/margin/top (that triggers layout). The drag holds **60fps on every device** — the UI-thread/transform rule is what earns it (decision 14); 30fps is the floor for JS-thread work on a low-end reference only. |

## 2.  Beyond the tokens: what else counts as premium

- **Accessibility is premium.** Respect reduce motion (Reanimated useReducedMotion() / AccessibilityInfo) by toning springs down to fades; support OS dynamic type without breaking layouts; never encode meaning in color alone. These are also App Store review items.
- **Empty & skeleton states.** No network doesn’t mean no waiting — the compatibility recompute and the 2-D preview still need graceful states (the 3-D scene is a v2.1 concern). Use skeleton shapes (not spinners), and make them flash, not linger.
- **Calm microcopy.** The Tier-1 plain-English verdict (“Mostly healthy — one plant wants more light”) does more for “premium” than any meter. Budget real effort into generating good versions from the score.
- **The signature interaction is the budget sink.** Every other technique here is cheap polish. In v2.0, spend the delight budget on the one signature interaction — **drag-to-plant in the 2-D front view** — and keep everything else calm and consistent. The 3-D terrarium scene (where weeks otherwise go) is **deferred to v2.1** (decision 5), so it can’t sink the v2.0 budget.

## 3.  The token system — the engine of “premium”

Premium consistency is a small set of tokens applied relentlessly. Define these once (a theme.ts) and never use an off-token value.

### 3.1  Motion tokens (Reanimated, all on the UI thread)

| **Token** | **Config (spring unless noted)** | **Used for** |
| --- | --- | --- |
| motion.snappy | stiffness 220 · damping 26 · mass 1 (near-critical) | buttons, toggles, tab switches |
| motion.settle | stiffness 140 · damping 24 (no overshoot) | bottom sheets, modals, page transitions |
| motion.delight | stiffness 180 · damping 14 (slight overshoot) | Eco-balance fill, save-success moment |
| motion.dragReturn | stiffness 200 · damping 20 | a plant/hardscape springing back to its slot |
| motion.micro | timing 120ms · ease-out | opacity fades, chip select, micro-states |

Reduce-motion: collapse all of these to a 120ms opacity fade.

### 3.2  Spacing scale (never an off-scale value)

4 · 8 · 16 · 24 · 32 · 48 — gaps within a group use 4–8; between groups 16–24; section padding 24–32; screen-level breathing room 32–48.

### 3.3  Type scale (base 16, ratio 1.2)

| **Role** | **Size** | **Weight** | **Notes** |
| --- | --- | --- | --- |
| Display (final-build name, hero) | 33 | 700 | razor-tight letter-spacing |
| Headline (screen title) | 28 | 700 |  |
| Title (card name, section head) | 23 | 600 |  |
| Subhead | 19 | 600 |  |
| Body | 16 | 400 | default reading size |
| Caption / stat value | 13 | 600 | bold the value |
| Overline / stat label | 11 | 500 | uppercase, letter-spaced, muted — bold the value, never the label |

### 3.4  Shadow + border scale

| **Token** | **iOS** | **Android** | **Used for** |
| --- | --- | --- | --- |
| e0 resting card | opacity .06 · radius 8 · y+2 + hairline border (forest @ 8%) | elevation 1 + hairline border | build cards, plant cards |
| e1 raised / sheet | two layers: (.08·r2·y1) + (.10·r24·y8) | elevation 6 + hairline | bottom sheet, popover, active modal |
| e2 dragged | (.16·r32·y12) — lifts higher | elevation 12 | a card/plant while being dragged |

The hairline border (StyleSheet.hairlineWidth, tinted forest at low opacity) is what keeps Android cards from looking flat where it can’t stack shadows.

### 3.5  Color (earth-modern; design in OKLCH, ship hex)

| **Role** | **Light** | **Dark** | **Note** |
| --- | --- | --- | --- |
| Background | #F6F4EC (warm off-white) | #14201A (deep charcoal-green) |  |
| Surface / card | #FCFBF6 | #1C2A22 |  |
| Primary (forest) | #2E5D3A | #5FAE74 | raise L in dark so it doesn’t go flat |
| Sage (secondary) | #5E7A52 | #8FB07F |  |
| Terracotta (accent) | #A55A3A | #C8825F | use sparingly — one accent per screen |
| Text / muted | #232826 / #6B7268 | #ECEFE7 / #9AA59A |  |

| **The one place OKLCH earns its keep — the Eco-balance meter.**<br>Interpolate its colour from healthy → warning across OKLCH/LCH hue (~145° green → ~75° amber → ~30° red) at roughly constant lightness, so the sweep stays vivid and even. The naïve RGB lerp passes through a muddy brown dead zone in the middle. This is a self-contained, high-visibility payoff. |
| --- |

### 3.6  Haptic map (expo-haptics — semantic only)

| **Event** | **Haptic** |
| --- | --- |
| Plant added to build / chip selected | selectionAsync() |
| Plant or hardscape snaps to grid / drop accepted | impactAsync(Light) |
| Build step completed / sheet committed | impactAsync(Medium) |
| Placement creates a survival-critical conflict | notificationAsync(Warning) |
| Build saved | notificationAsync(Success) |
| Destructive action confirmed (delete) | impactAsync(Heavy) |

## 4.  Applied to your layout, screen by screen

### 4.1  Navigation

- Bottom tab bar (iOS + Android — desktop is cut, so no left rail), human-drawn icons, above the gesture bar (safe-area inset). Tab switches use motion.snappy; the active icon does a subtle scale+tint, not a bounce.

### 4.2  Dashboard

- Responsive grid that scales and centers (fixes today’s left-aligned dead space). Cards at e0; macro-whitespace (24) between them.
- Shared-element: tapping a card’s photo expands that image into the build-detail hero (motion.settle). The single most “premium” transition for a photo-centric app.
- Drag-to-reorder builds with motion.dragReturn; the card lifts to e2 while held; impactAsync(Light) on pickup and drop.
- Optimistic delete + undo: the card animates out immediately; a snackbar offers Undo for ~5s before the SQLite delete commits.
- Cold-start: skeleton cards that flash for a frame, not lingering spinners.

### 4.3  Build detail

- Read-only by default. Glance header → verdict band (plain-English sentence + Eco-balance meter) → Tier-2 expanders (motion.settle); the full pairwise matrix is Tier-3 behind a deliberate tap.
- Cards at e0 with the hairline border; generous 24–32 padding so the screen breathes.
- Photo timeline; the newest photo is the dashboard thumbnail and the shared-element source.

### 4.4  The planner (where the budget goes)

- Persistent build preview, docked-peekable, showing the 2-D front view — the only preview in v2.0 (no 2D ⇄ 3D toggle; the 3-D display is a v2.1 fast-follow).
- Drag-to-place in the 2D front view: gesture tracked on the UI thread (Gesture Handler + Reanimated), plant glued to the finger, motion.dragReturn if dropped outside a valid zone, snap with impactAsync(Light). This is the signature interaction — spend polish here.
- Eco-balance meter fills with motion.delight (the one sanctioned overshoot) and colours via the OKLCH sweep in §3.5. A survival-critical conflict fires notificationAsync(Warning) and pulses the meter red.
- Compatibility shows primary conflicts only; the full matrix is a Tier-3 expand. Placements are data, so when the 3-D display lands in v2.1 it simply reflects them — and there is no 3-D drag.

### 4.5  Plant bottom sheet

- Slides up with motion.settle (low overshoot), tracks the finger, and dismisses on a velocity-aware swipe-down (flick = dismiss even if not far). Tier 1→2→3 inside the sheet, separated by scroll/expand gestures. Feels far more native than a full-page push.

### 4.6  Care tab

- Deliberately the calmest screen: no sound, minimal motion, notificationAsync(Success) on mark-done. Overdue nudges are gentle, not alarmist.

## 5.  Priority — restraint means sequencing

#### P0 — cheap, do first (80% of the “premium” for ~20% of the work)

Token system (motion / spacing / type / shadow / color / haptics) · macro-whitespace · tiered progressive disclosure · gentle spring defaults · animate only transform/opacity · reduce-motion + dynamic-type support · color-never-alone · plain-English verdicts · empty/skeleton states · the OKLCH Eco-balance meter.

#### P1 — medium effort, high delight

Shared-element card → hero · drag-to-place physics in the planner · velocity-aware bottom sheet · drag-to-reorder dashboard · optimistic delete + undo.

#### P2 — expensive; do NOT let these block v2.0

The entire 3-D scene (display **and** any 3-D drag) — deferred to v2.1 (decision 5) · true multi-layer iOS ambient shadows · a runtime OKLCH theming engine · variable-font optical sizing · audio design.

## 6.  Anti-patterns — the “trying too hard” tells

- Overshoot/bounce on everything → reads as a toy. Reserve it for one or two moments.
- UI sound effects in a calm, plant-focused app — off the table; most phones are on silent and it fights the aesthetic.
- Chasing runtime OKLCH or variable-font opsz in React Native — yak-shaving on platform features that don’t cleanly exist there yet. Resolve OKLCH to hex at build time; pick static font weights.
- A golden-ratio (1.618) type scale — the jumps are too big for an info-dense app; use 1.2.
- Animating layout props (width/height/margin/top) → guaranteed jank; use transforms.
- Drop-shadow soup on Android, which can’t render it — hairline border + single soft shadow instead.
- Skeletons that linger — you’re local; if a skeleton is visible for more than a flash, something is wrong.
- Decorative haptics — a buzz with no meaning trains users to ignore them (or disable them).

Premium, for a terrarium app, = calm, instant, tactile, and restrained. Build the P0 token set and apply it everywhere; in v2.0, spend the rest of the budget on the one signature interaction (drag-to-plant in 2-D) — the tasteful 3-D display is a v2.1 fast-follow.
