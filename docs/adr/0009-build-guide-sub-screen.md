---
status: accepted
---

# The Build Guide is a post-save sub-screen off Build Detail, not a planner card

The one-time physical-assembly steps move out of the planner's Final step and
become their own route, `/build/[id]/guide`, reached from a section card on
Build Detail. The guide is derived live from the saved Build (not stored), and
its glossary terms are hand-authored `[[slug]]` markup rendered through the
existing ADR 0006 stack.

## Context

Today `generateBuildGuide` ([guide.ts](../../src/logic/guide.ts)) is rendered as
a static, read-only card — #4 of 5 — inside the planner's Final step
([final-step.tsx:128-161](../../src/components/planner/final-step.tsx)). Four
problems with that home:

1. **Not discoverable** — buried at the end of the create wizard.
2. **No re-access** — once you Save, the guide is gone; nothing on Build Detail
   shows it.
3. **Wrong moment** — it's a static read on a *confirmation* screen, when you
   actually want it in hand while physically building (which happens *after*
   save).
4. **Text wall** — a flat list, not something you work through.

The **Build** is the canonical saved entity (CONTEXT.md), it persists every
input the guide needs — `plantSlugs`, `containerId`, `substrateDepth`,
`drainageDepth`, `charcoalDepth`, `substrateMix`
([schema.ts:58-84](../../src/db/schema.ts)) — and Build Detail
([build/[id].tsx](../../src/app/build/[id].tsx)) already loads `build`, `plants`,
and `container` into scope. So a post-save home costs no new data and re-derives
the *identical* guide the planner used to preview.

The app has no users but the author, so there is no migration or deprecation
path to honor — the planner card is simply deleted.

## Decision

1. **New route `/build/[id]/guide`.** A focused, full-screen checklist you open
   while building (phone in one hand, LECA in the other) — not an inline
   section competing with photos and the matrix in Build Detail's scroll. The
   route re-resolves `build → plants → container` from the `id` param, exactly as
   Build Detail does.
2. **Entry point: a section card** on Build Detail, placed right after the
   verdict band, reading "Build guide · N steps →", that navigates to the route.
   A content destination earns a labeled, sized tap target — not a fourth icon
   in the crowded header. This is what makes it discoverable (problem #1/#2).
3. **Remove the guide from the planner entirely.** Final step collapses to Name ·
   Eco-balance · Plants · Save; the `generateBuildGuide` import and its
   `useMemo`/try-catch projection leave `final-step.tsx`. The Save hint gains one
   line setting the expectation ("…your step-by-step build guide is next"). No
   second, lesser rendering of the same content to rot.
4. **Derive-on-render, never snapshot.** The guide is pure output of saved Build
   data; storing a frozen copy would only add a redundant column and invent a
   "regenerate" affordance. Consequence accepted: editing a Build re-derives its
   guide — correct, since you re-open the guide to (re)build.
5. **Glossary via ADR 0006, hand-authored.** Glossary terms are explicit
   `[[slug]]` markup written into the *static* portions of `guide.ts`'s
   instruction strings (never the interpolated plant names / depths), rendered
   with `<GlossaryText>` → `<TermSheet>` (the `browse.tsx` wiring pattern). We
   reject auto-linking at render: substring-matching free text full of "light",
   "direct", "moss", plurals and casing is a false-positive minefield, and ADR
   0006 already chose author-controlled markup over scanning. Markup is just
   string content, so `guide.ts` stays import-pure.

## Consequences

- **`guide.ts`** gains `[[slug]]` markup in instruction bodies (titles stay plain
  — a heading is a label, the link belongs in the sentence). A ~10-line test
  pulls slugs from the generated guide via `glossaryMarkupSlugs` and asserts each
  resolves through `lookupTerm` — the existing integrity check
  ([glossary.test.ts:89](../../src/data/__tests__/glossary.test.ts)) only scans
  plant `notes`/`nativeContext`, so the guide needs its own coverage or a typo'd
  slug ships unguarded.
- **CONTEXT.md** gains a **Build Guide** entry: *the ordered, one-time
  physical-assembly steps for constructing a Build — derived, ephemeral, distinct
  from the ongoing Care cycle.* `_Avoid_: Setup guide, assembly guide,
  instructions` ("setup" is already on the **Build** entry's avoid list).
- **Checkbox state is ephemeral** (per ADR-less prior decision): you tick steps as
  you build; nothing persists. A route loses that state on back-nav, which is
  correct — it's not a tracked project.
- **Lost nicety:** no in-planner guide preview before save. Acceptable — you build
  after saving, and the Save hint sets the expectation.
