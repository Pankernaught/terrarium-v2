# Build Guide — split-out handoff

Handoff for a fresh **grilling session** (`/grill-with-docs`, domain-modeling skill).
The goal: pull the build guide out of the planner's Final step and make it its own
work-throughable thing. This session settled the *interaction model*; the
*placement / lifecycle / naming* questions are still open and are the point of the
next session.

## The ask (verbatim intent)

> Split the build guide off into its own thing — not a tiny little page you can
> click at the end of the planner.

### Problems being solved (user's words, paraphrased tightly)

1. **Not discoverable** — buried at the end of the wizard.
2. **Wrong home** — doesn't belong on the planner's final confirmation page.
3. **No re-access** — once you save, there's no way back to the guide.
4. **Text wall** — should be work-throughable (steps/checkboxes), not a static read.
5. **No inline explanation** — glossary terms should be built in fluidly to explain
   what each step is and why.

## DECIDED this session (don't re-litigate unless you disagree)

- **Checklist, not a stepped/wizard flow.** Reasoning: physical assembly is
  non-linear — you discover the sphagnum's in the garage, you batch the watering.
  A stepped flow punishes that. The guide already carries ordered step numbers, so
  ordering survives without locking navigation. 7–9 items fit one scroll, so you can
  see what's ahead while gathering materials (phone in one hand, bag of LECA in the
  other).
- **Checkbox state is ephemeral per-session — NOT persisted.** You're ticking off as
  you build, not tracking a long-term project.
- **Haptics on check.** Ticking the last step → small completion moment (haptic +
  visual). Opt-in polish, not load-bearing.
- **Glossary = reuse `TermSheet`, reject tooltip/popover.** Tapping an inline term
  opens the existing overlay (`<TermSheet slug=… />`), which sits over the checklist
  without navigating away — you keep your place. A tooltip is strictly worse on
  mobile (tiny text, awkward finger positioning, no depth) and buys only one
  swipe-to-dismiss. No new primitive when `TermSheet` already does it.

## OPEN — the actual agenda for the grilling session

1. **Where does the guide live after saving?** A section on the Build Detail page
   you scroll to (like the Pairwise matrix, behind a tap) vs. a separate route
   navigated into from Build Detail (e.g. `/build/[id]/guide`). *This is the next
   question to grill — unanswered when the session was cut.* It also drives the
   answer to "discoverable" (problem #1/#3).
2. **What happens to the Final step?** Minus the guide it's thin: Name +
   Eco-balance + Plants + Save. Does it collapse, get renamed (Review? Name & Save?),
   or stay as-is minus the card?
3. **Lifecycle: live-derived vs. snapshot-at-save.** Today the guide is re-derived
   from draft/build data on every render (pure, no DB). Keep deriving (auto-updates
   when the build is edited, nothing to store) vs. freeze at save (a "build log"
   that doesn't change unless regenerated). Lazy default = keep deriving.
4. **Canonical name + CONTEXT.md.** `CONTEXT.md` has no term for the one-time
   physical-assembly instructions. Candidates: **Build Guide** / Setup Guide /
   Assembly Guide. Must be distinguished from the *ongoing* care concept (Care tab,
   care cycles). Decide the term and whether it earns a `CONTEXT.md` entry.
5. **How do glossary terms actually get into the steps?** `GlossaryText` only
   linkifies `[[slug]]` / `[[slug|display]]` markup (ADR 0006). The guide's
   instruction strings in `guide.ts` are plain generated text with NO markup. So
   someone must decide: hand-author `[[ ]]` markup into the generated instruction
   strings (keeps `guide.ts` import-pure — markup is just strings), or auto-link
   known terms at render. This is unspecified and needs a decision.
6. **ADR?** A split this structural (new placement + lifecycle choice) may clear the
   ADR bar (hard to reverse + a future reader asks "why here?" + real trade-off).
   Decide at the end. Next ADR number is **0009**.

## Code map

- **`src/logic/guide.ts`** — `generateBuildGuide(plants, container, opts) → BuildStep[]`.
  Pure, no store. `BuildStep = { step, title, instruction }`. Steps in order:
  Container Prep → Drainage → Separation → (Charcoal, if any) → Substrate →
  Plant Placement → Initial Watering → Sealing/Ventilation → Light Placement.
  **Throws on empty plants.** Instruction strings are plain text (no glossary markup).
- **`src/components/planner/final-step.tsx`** — current home. Guide is card #4 of 5
  (Name · Eco-balance · Plants · **Build guide** · Save hint). Derived live from the
  draft via `useMemo`, wrapped in try/catch (handles the empty-plants throw). This is
  the card to remove / relocate.
- **`src/app/planner.tsx`** — 4-step flow: Container · Substrate · Plants · **Final**
  (`STEPS` array + `StepBody` switch). `FinalStep` renders the guide today.
- **`src/app/build/[id].tsx`** — Build Detail, read-only. Current sections: hero →
  `GlanceHeader` → `VerdictBand` → Container → Plants → `PhotoTimeline` →
  `PairwiseMatrix` (behind a deliberate tap). **No guide section today** — the likely
  insertion point for open question #1.
- **`src/components/glossary-text.tsx`** — `<GlossaryText text onPressTerm … />`.
  Parses `[[slug]]` markup, renders dotted-underline tappable spans. Pair with…
- **`src/components/term-sheet.tsx`** — `<TermSheet slug onClose />`. The overlay.
  Wiring pattern lives in `src/app/browse.tsx` (`termSlug` state + `<TermSheet>`).

## Notes / constraints

- Ponytail mode was active: bias to reuse (`GlossaryText` + `TermSheet` already
  exist), no new primitives, derive-don't-store unless a reason appears.
- Glossary stack is ADR 0006; inline links + gates already built (per project memory).
- AGENTS.md: read the versioned Expo 56 docs before writing Expo code.
