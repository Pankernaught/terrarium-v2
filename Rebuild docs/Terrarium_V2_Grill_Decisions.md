# Terrarium V2 — Grill-Session Decisions & Handoff

*Continuation primer for a fresh chat. Amends the V2 rebuild docs
(`Terrarium_V2_Migration_Plan` / `..._Sequence` / `..._Premium_Design` /
`Terrarium_V2_Steps/*`) against v1's `CONTEXT.md`.*

## What this is
A relentless design-review ("grill-me") of the V2 rebuild plan against the v1
build. Goal: complete understanding of the rebuild **in relation to the old
build**. The decisions below are **locked amendments** to the planning docs.
Prior continuations closed **Q8–Q13** (toxicity, port-fidelity/parity, build
guide, plant-photos, substrate-component dataset, care tab → decisions 8–13).
This continuation closed **Q14–Q18** (performance gate → decision 14: acquisition declined,
**60fps drag everywhere**, 30fps a JS-thread design budget; primary/secondary scoring algorithm
→ decision 15: best-pair min-adjacency, distance-0-via-secondary caps to caution, **survival
judged on primaries only**; care-notification scheduling → decision 16: per-task native
repeating triggers under a soonest-due ~50-slot budget guard, digest model deferred to v2.1;
backup/restore → decision 17: versioned envelope now, reused migration ladder, refuse-newer,
replace-semantics, UUID build IDs; content pipeline → decision 18: CC/PD photos accuracy-first,
license hygiene + attribution fields, 3–5 bundled onboarding presets). The prior queue's "last
item" (Q14) turned out **not** to be last — closing it **reopened the queue** with four soft
spots (Q15–Q18), now all resolved. **The grill queue is exhausted; the V2 plan is fully amended
through decision 18.**

---

## Decisions locked this session

1. **Scope.** v2.0 = an evolvable **foundation**, *not* a release; public launch
   is much later. Audience: terrarium hobbyists/enthusiasts **+** beginners.
   Platforms: **iOS + Android**. **Desktop is cut entirely** — all
   "desktop / left-rail" language in the docs is vestigial Dash-web thinking;
   ignore it.

2. **Build loop.** **Claude Code** (agent) + **WebStorm** (IDE). The v1
   **Gemini chat-relay is retired.** The 14 step packs are demoted from "chat
   prompts" to **spec + Definition-of-Done checklists** run locally, where the
   toolchain (Vitest, Expo, parity harness, on-device perf) can actually be
   verified.

3. **Plant-DB governance.** **Curator-owned.** A "public suggestion" feature =
   an **out-of-band button** (mailto / a web form the owner controls) — **no**
   in-app community, **no** backend, **no** moderation queue. `engine/social.py`
   stays scrapped. DB content is editable by **re-authoring the seed**.

4. **Primary/secondary conditions.** Ship **live at launch.** Secondary
   `light`/`soil_moisture` conditions are **authored where botanically real**
   (NOT forced on all 67; primary-only is intentional and must be documented),
   folded into the Step 3 authoring pass. This remains the **only rule-level
   divergence from v1.**

5. **3-D.** Display **deferred to v2.1.** v2.0 ships the **2-D front view as the
   only preview.** Option A's real gate stands: **2-D drag, placements-as-data,
   no 3-D drag.** Drop the 2-D⇄3-D toggle from v2.0; collapse Step 6D to the
   Final/save step. NOTE: v1's "3-D" is a Plotly `Mesh3d` (Dash-only, discarded)
   — only the **geometry math** (`container_profile`, box/cylinder builders)
   ports; nothing *renders* for free.

6. **Port fidelity.** Scoring engine = **strict port of the v1 oracle**;
   primary/secondary is the only rule-level divergence. v1 **bugs** get fixed
   (the `except Exception: pass` score-swallow at `pages/home.py`, the
   grey-"⚠", any provable defect) — that's **correctness, not divergence**.
   **No ad-hoc scoring-constant changes** (light/moisture/pH orders, −35
   survival penalty, 7-pt pH caution, 2.0 L / 1.0 L thresholds, ≥80/≥50 bands).
   The parity harness keeps its teeth.
   **→ Amended by decision 9:** these constraints bind the **initial faithful
   port only**; post-port the scoring logic is expected to be reworked, and the
   dedicated parity harness is **dropped** (the carried-over v1 unit tests are
   the safety net).

7. **Data durability.** v2.0 ships **manual JSON export/import** ("Back up to
   file" / "Restore from file") via `expo-sharing` + `expo-document-picker`,
   covering **builds + placements + care-marks**. **Photos excluded** (binary;
   documented gap). The importer must **degrade gracefully** on missing photo
   files (placeholder hero, never crash). Not cloud, not accounts; real sync
   stays bound to the same future-backend trigger as accounts/suggestions.

8. **Toxicity (Q8 — closed this continuation).** A single nullable **free-text
   `toxicity?: string`**, promoted to a top-level plant field (not nested in
   `special_notes`), **hand-authored by the curator** for toxic/irritant species
   only — **NOT forced on all 67**. This *relaxes* Step 3's DoD from "present on
   all 67" to "present where botanically real." Two consequences locked: (a) the
   primer's structured **Browse toxicity *filter* is deferred** — free text can't
   be faceted, so toxicity is **display-only** in the Tier-3 plant view (icon +
   label indicator on the card when non-empty, per never-color-alone); (b) **blank
   ≠ safe** — a null/empty value means "no note authored," and the UI must **never**
   render it as a safety claim ("Non-toxic ✓"). The owner is the source of record;
   ASPCA et al. are research references, not a gate. This **supersedes primer
   decision 4's** typed enum + structured Browse filter.

9. **Port fidelity, loosened (Q9 — closed this continuation).** The owner flagged
   that the v1 scoring logic is **shallow and provisional — it will be reworked in
   V2**, so a strict byte-exact parity rig is premature. New stance:
   - **Port the v1 logic faithfully as a *starting point*** (don't discard the
     thinking already encoded), then **refine it freely** in V2. v1 is a starting
     reference, **not a permanent contract.**
   - **Safety net = carry the existing v1 engine unit tests across** — port the
     ~91 pytest cases to Vitest (Step 2A's "tests first" already does this). If
     they pass after the port, the language switch didn't silently break anything;
     update them as the logic changes. That's the whole safety net.
   - **DROP the dedicated parity harness** entirely: no hand-authored build corpus,
     no golden-master answer key, no running v1 + TS side-by-side, no Python-in-CI.
     This **reverses decision 6's** "parity harness keeps its teeth"; decision 6's
     constant-freeze + "only primary/secondary diverges" now bind the **initial
     port only**, not forever.
   - **Step 2C scope correction (factual, read from the code):** `engine/builds.py`
     is **pure CRUD** and `tests/test_builds.py` is **100% CRUD** — so the "port
     build scoring / translate `test_builds.py` scoring cases" item is a **phantom.**
     Build "scoring" IS `check_group`, already ported in Step 2A. **All of
     `builds.py` and all 12 `test_builds.py` cases → Step 4** (store); the Sequence
     doc's double-count of `test_builds.py` resolves to **Step 4 only.** Step 2C
     therefore reduces to: decouple `recommend()` (candidates passed in) +
     `makeContainer()` as a pure constructor.

10. **Build guide (Q10 — closed this continuation).** The guide becomes a
    **static, read-only projection of saved build data**, rendered in the
    planner's **Final** step and the `expo-print` export. v1's 298-line
    interactive `pages/build_guide.py` is **deleted**. The premise was a false
    binary: v1 conflated a step-renderer and an override panel on one page; V2's
    planner flow already splits them. The four `generate_build_guide` override
    inputs are **re-homed upstream**, not carried onto the guide:
    - `substrate_depth` → planner **Substrate** step. **Override kept (owner chose
      option A)** and **persisted** as a new build field.
    - `drainage_depth` → planner **Substrate** step. **Override kept** and
      **persisted**.
    - `drainage_material` → **dropped as a v2.0 control**; default
      `"pebbles or LECA"`. The v2.1 substrate mixer owns material/component choice.
    - `include_hardscape` → **derived** from whether the Hardscape step placed
      anything (no control). Strictly more correct than v1's `substrate_tags`
      "rock"/"wood" guess — a latent bug-fix in the spirit of decision 6.
    - **Schema amendment:** add `substrate_depth?` + `drainage_depth?` to the
      build record, alongside Phase 4's `placements`. The guide **and** the
      container diagram read them → preserves the issue-#17 single-source-of-truth
      property. (v1 fact, read from `engine/models/builds.py`: these overrides
      persisted **nowhere** — transient page state only, so reopening the guide
      always reverted to computed defaults. V2 persisting them is a deliberate
      upgrade, not a port.)
    - **Doc reconciliation:** the Plan ↔ Sequence contradiction resolves in favour
      of the **Sequence** (fold into Final + export now); **Plan line 155**
      ("folding … not committed for v2.0") is **retired.**

11. **`plant_photos` table (Q11 — closed this continuation).** **Dropped.** v1's
    `plant_photos` is a stillborn over-model: the table + a profile-gallery UI
    exist, but it has **no write path, is never seeded, and is read exactly once**
    ([plant_profile.py:166](pages/plant_profile.py)) where it always renders
    "No photos yet." Plants carry **no image field at all**, and the repo ships
    **zero** plant images (`assets/` holds only `build_photos/`). It modeled
    curator reference imagery as if it were mutable, per-install DB rows.
    - **Replacement (owner chose option A):** a single static **`image` path on the
      plant record** in the seed — serving both the icon-first selector thumbnail
      and the profile hero — bundled as a static app asset. A distinct stylized
      `icon` and a multi-photo gallery are **deferred** (v1 never populated one).
    - **Phase 4 amendment:** the "mirror four persisted entities" list
      ([Sequence line 89](Rebuild%20docs/Terrarium_V2_Migration_Sequence.md))
      drops to **three** — builds, build-photos, care-marks. `plant-photos` is struck.
    - **Rationale:** SQLite photo tables are for user-generated mutable media →
      that stays `BuildPhoto` (kept + expanded: photo timeline,
      `expo-image-picker`/camera). Plant imagery is curator-owned + static →
      belongs in the bundle/seed (decision 3), read with zero DB round-trip by the
      selector. Clean against decision 7: bundle assets never enter the JSON
      export/import path.
    - **Net-new cost (flagged):** v1 ships zero plant images, so ~67 must be
      sourced/authored regardless — folded into the Step 3 authoring pass, as
      static assets, not DB rows.

12. **Substrate-component dataset (Q12 — closed this continuation).** The rich
    per-component property matrix (aeration / water-retention / nutrient /
    buffering / particle-size) is **deferred to v2.1**, co-located with the mixer
    that is its only consumer — building the mixer dictates the schema, so
    authoring it in v2.0 against an unbuilt consumer is the author-ahead pattern
    this grill keeps cutting. **Retire** Plan line 75 / Sequence 75 & 81's "author
    the substrate-component dataset in v2.0"; Step 3's authoring DoD excludes
    component properties. Facts (read): the v2.0 depth/drainage path consumes only
    `max_height_cm` + `soil_moisture` + container `volume_l`
    ([containers.py:149](engine/containers.py)); `substrate_tags` feeds only the
    guide's display string; **no** property dataset exists today.
    - **v2.0 substrate hygiene (kept):** freeze the **component vocabulary** — the
      ~9 real materials (perlite, peat, sphagnum, sand, coco coir, grit, orchid
      bark, pumice, mud[outlier]) become a canonical list (stable id + label), and
      **`wood`/`rock` split out as hardscape, not substrate** (they only ever fed
      the guide's hardscape grep; decision 10 now makes hardscape placement-driven).
      Normalizes already-consumed data — not premature authoring.
    - **`root_depth_cm` (owner ruling — neither drop nor integrate):** v1's column
      is a phantom (read by no logic; populated in **0** seed rows; the Sequence's
      "depth seeded from root_depth" claim is false — it seeds from `max_height_cm`).
      Ruling: **author root depth for all plants as a *range*** during the Step 3
      pass, **but do NOT integrate it** — the substrate-depth seed stays
      `max_height_cm`-driven, so **no divergence** from the oracle's depth math.
      Shape: a **numeric `root_depth_min_cm` / `root_depth_max_cm` pair** (sortable;
      a ready input for a future v2.1+ depth refinement — unlike toxicity's
      deliberate free text), replacing v1's single nullable float. **Mark it
      reference-only** in the schema/docs so it never again masquerades as a live
      depth driver.

13. **Care tab scope (Q13 — closed this continuation).** Scope **confirmed
    right-sized** for a foundation, with tightenings. v1 fact: `generate_care_guide`
    ([care.py:6](engine/care.py)) emits 5 categories of **static text** (Watering /
    Humidity / Light / Substrate / Trimming) off existing fields, with **no
    intervals or schedule** — there is no v1 schedule to port; the cadence is
    net-new.
    - **Locked — 3 task types only:** **trimming** (build-level; mixed-growth
      detection), **lid-opening** (`opening` + `volume_l`), **watering-*inspection***
      ("look, don't pour" — **never a fixed watering timer**; the load-bearing
      call, since a fixed timer overwaters and kills terrariums). Reuse
      `generate_care_guide` text as the notification body; **local**
      `expo-notifications`; permission **after first build**; per-terrarium on/off
      toggle; mark-done writes the care-marks table.
    - **Cadence intervals = a provisional, curator-tunable lookup table** (task type
      × coarse bucket → interval), **not** a "smart" function implying false
      precision — the numbers exist nowhere in v1, so treat them like the scoring
      constants: provisional and easy to retune.
    - **First occurrence due one interval after build creation** (don't nag on save).
    - **Explicitly excluded from v2.0** (right-sizing = saying no): fertilizing
      reminders, misting-as-a-4th-task, snooze / user-editable intervals, per-task
      toggles. All v2.1.
    - **Trimming granularity (owner chose option A): build-level** — one trimming
      task per terrarium fired on mixed growth, one care-mark stream per build.
      **Retire Plan line 146's "plant-by-plant"** in favour of the Sequence's
      build-level detection ([line 145](Rebuild%20docs/Terrarium_V2_Migration_Sequence.md)).
      Per-plant trimming is a v2.1+ refinement.

14. **Performance gate (Q14 — closed this continuation). Physical-device
    acquisition declined for v2.0.** The prior "acquire a cheap Android" logistics
    item is **resolved: no.** The contradictory device language across the docs
    ("cheap" / "low-end" / "mid-range" — Plan 179, Sequence 31/34/137/175, Premium 26)
    is retired for a **two-pole envelope split by *thread*, not device:**
    - **Measured gate (the only fps number actually validated in v2.0): 60fps on the
      owner's iPhone** (≥ iPhone X / A11-class, 60 Hz panel; ProMotion 120 out of scope —
      no doc promises it).
    - **UI-thread drag holds 60fps on *every* device, low-end included (owner ruling).**
      It is transform/opacity-only on the Reanimated UI thread — the cheapest possible
      animation and the signature interaction; a choppy 30fps drag would forfeit the exact
      guarantee Reanimated was chosen to provide. The bar holds **only while** the drag
      stays transform/opacity (never width/height/margin/top) with sane textures — the
      Premium §3 worklet rule is now **load-bearing, not just style.**
    - **30fps = floor for JS-thread-bound work only** (cold-start, list scroll, screen
      transitions, live Eco-balance recompute) on a **Xiaomi Redmi 10 (Helio G88, 4 GB)**
      reference. This is a **design budget, NOT a measured gate:** no Redmi 10 is owned and
      emulator fps lies (decision 2), so **Android fps is unverified in v2.0.** The Android
      emulator is used for **functional/correctness testing only — never fps.**
    - **Acquisition revisit trigger:** when a *measured* low-end number is genuinely needed
      (realistically near a real release — "much later", decision 1). The **no-purchase**
      path to a real Redmi-class reading is a one-off **cloud device-farm** session
      (Firebase Test Lab / BrowserStack), not owning hardware — out of scope now, named
      only as the escape hatch.
    - **Doc reconciliation:** Plan 179, Sequence phase-map 31 & 34, Sequence Phase 6 exit
      137 & Phase 9 exit 175, Premium §1 table 26 all rewrite to this two-pole, thread-split
      envelope; **"mid-range" is struck** (it silently raised the bar and defeated the gate's
      "test the floor, not a flagship" purpose). Sequence line 185's "only item still open is
      a logistics call" is **retired** — the queue is reopened (below), not exhausted.

15. **Primary/secondary scoring algorithm (Q15 — closed this continuation).** Makes
    decision 4's rule *precise*, grounded in the v1 oracle (`engine/compatibility.py`).
    Scope: **only `light` + `soil_moisture`** reshape to `{primary, secondary?}`; **pH is
    untouched** (no secondary — acidic/neutral/alkaline scoring is unchanged). All leverage is
    in `check_pair`: `check_group` and `recommend()` both delegate to it and average pair
    scores, and `derive_envelope`'s unioned `compatible_lights`/`compatible_moisture` sets are
    **display-only** (the recommender re-runs `check_pair`; it does *not* consume the envelope),
    so the union cannot over-widen scoring.
    - **(15a) Graduated tier — best-pair min-adjacency.** For light and moisture, take the
      adjacency distance of the best-matching pair across {a.primary, a.secondary} ×
      {b.primary, b.secondary} and score it on the **v1 ladder** (light 1→−15 / ≥2→−30;
      moisture 1→−7 / 2→−14). A secondary only changes *which* cross-product pair is closest;
      "via secondary" is then a UI **annotation**, not an extra penalty.
    - **(15a) The distance-0 cap = a precise mild penalty.** A best pair at distance 0 reached
      *only* via a secondary (e.g. `a.secondary == b.primary`, primaries unequal) does **not**
      score a free 100 — it deducts the **one-step caution penalty (−15 light / −7 moisture)**,
      landing in the caution band. Composes naturally (via-secondary on both factors →
      100−15−7 = 78 = caution). **Both-secondary** (a shared value that is *neither* plant's
      primary) takes the same single caution deduction in v2.0; escalating it is a **noted v2.1
      refinement**, not built now (keeps the test surface small).
    - **(15b) Survival tier — primaries only.** The lethal predicates (**light**: `direct` with
      `low`/`medium`; **moisture**: `dry`+`wet`, distance 3) are evaluated on **`a.primary` vs
      `b.primary` only.** A secondary **never** downgrades the survival tier — it rescues
      *within* the graduated tier but cannot turn a lethal primary conflict into a caution. When
      the primary pair is survival-critical, that factor reports lethal, `survival_critical`
      stays true (clamping the group to the 40 ceiling), and the "via secondary" annotation is
      **suppressed for that factor** — survival wins outright. Rationale: **safety asymmetry** (a
      loosely-authored secondary must not be able to relabel a plant-killing combo as "caution");
      the survival tier *means* "kills regardless of care," and choosing a light level is care;
      and it keeps the port minimal (`predicate(a.primary, b.primary)`, v1 logic unchanged but
      for reading `.primary`).
    - **Ripples to bank for the port (Phase 2 / Step 2A):** (a) `recommend()` line-49's
      `candidate.light != sp.light` exact-equality — feeds only the "Matches light requirement"
      reason text — breaks when `light` becomes an object and must be rewritten primary/
      secondary-aware (cosmetic, low stakes); (b) `derive_envelope` unions primary∪secondary per
      plant for the **display** sets only; (c) the carried-over tests gain **two** net-new case
      families — the **distance-0 secondary cap** (15a) and the **primaries-only survival** (15b,
      incl. an explicit "a secondary does NOT rescue a lethal pairing" assertion).
    - **Relationship to decision 4:** decision 4 stands (primary/secondary is the *only*
      rule-level divergence, authored where botanically real); decision 15 is its precise
      algorithm — **no new divergence**, just the exact mechanics of the one already sanctioned.

16. **Care-notification scheduling vs. the iOS 64-pending cap (Q16 — closed this
    continuation).** iOS (`UNUserNotificationCenter`, under `expo-notifications`) caps an app at
    **64 pending local notifications**; the 65th is silently dropped. Android has no hard cap.
    Decision 13's 3 task types per terrarium are scheduled as **Model A — one native *repeating*
    trigger per (terrarium × enabled task):**
    - **Primitive: native repeating triggers**, not explicit next-K scheduling. A lookup-table
      cadence ("every N days") maps to one `TIME_INTERVAL { repeats:true }` / `WEEKLY` trigger
      that counts as **one permanent pending slot** and fires even if the app is never opened
      (the dormant-user case a care app most needs). Pending = **3 × enabled terrariums**; the
      "first fire one interval after creation" rule (decision 13) falls out for free.
    - **Budget guard (the rolling part): target ≤ ~50 pending** (~14 headroom for the permission
      prompt, future features, OS slop). Past the budget, prioritize by **soonest-due across all
      (terrarium, task)**, schedule up to the budget, defer the rest, and **refill on app-open +
      on each fire**. Disclose gracefully in the Care tab ("Reminders active on your N
      nearest-due terrariums; others resume as these complete") — never a silent 65th-drop.
    - **Per-terrarium toggle (decision 13) = the user's pressure valve** — muting unwanted
      terrariums frees slots.
    - **Mark-done = cancel that task's repeating trigger + reschedule one interval from the
      mark-done timestamp** (stays 1 slot; handles early completion).
    - **Android:** no cap; the same code path is harmless (the budget guard simply never trips).
      No Android-specific logic.
    - **Model B (per-terrarium digest) deferred to v2.1** (owner: "refine it later"): one calm
      periodic "check on X" nudge per terrarium → ~1 slot/terrarium, effectively no cap, aligned
      with Premium §4.6's "calmest screen." Its cost is a generic body (local-notification
      content is fixed at schedule time) — losing per-task actionability in the notification
      itself. The long-term escape hatch if real usage piles up past the budget; not pre-built,
      since v2.0's realistic 1–10-terrarium users never approach 64.

17. **Backup/restore schema versioning + round-trip integrity (Q17 — closed this
    continuation).** Makes decision 7's manual JSON backup durable across app updates. Grounded
    in the v1 store: builds use **integer autoincrement PKs**
    ([builds.py:18](engine/models/builds.py)), plant refs are stable **slugs**, and the only
    cross-entity reference *inside the backup* is **care-marks → build** (photos are excluded
    from the payload — decision 7 — so `build_photos → build` doesn't ride along).
    - **Version the envelope NOW, even though no migration runs in v2.0.** Shipping an
      *unversioned* backup is the one unfixable mistake — v2.0 files in the wild would carry no
      version, so v2.1 couldn't tell what it's reading. And the first migration is already known
      (v2.1 adds substrate-mix fields and reuses `placements` for the 3-D display). Envelope:
      `{ schemaVersion, appVersion, exportedAt, data: { builds, placements, careMarks } }`;
      `schemaVersion` starts at **1** with a **no-op migrate** — it exists *so v2.1 can migrate
      v2.0 files.*
    - **Forward migration reuses the local DB's own ladder.** On import, if `schemaVersion <
      current`, run the payload through the **same** pure `migrate_vN→vN+1` chain the on-device
      store uses, *then* validate against the current zod schemas, *then* insert in **one
      transaction.** No separate importer migration path (they would drift).
    - **Newer-than-current = refuse with a clear message** ("made by a newer version — please
      update"). A foundation does not best-effort-guess a future schema.
    - **Restore = replace (wipe + load), with a confirm.** Matches Phase 5's existing
      "export → wipe → restore → identical" criterion and the save-file mental model.
      **Merge/dedupe-by-id deferred to v2.1.**
    - **Atomic + validated:** any validation failure rejects the **whole file** — never a
      half-import. (decision 7's missing-photo graceful-degrade is orthogonal: the payload holds
      photo *references*, not binaries.)
    - **Build IDs → UUID in the fresh V2 store** (owner ruling). Because restore = replace and
      care-marks reference builds, a naïve reinsert that let autoincrement renumber would
      **dangle every care-mark.** UUIDs are inherently round-trip-safe, cost ~nil (generate on
      create), and are the natural key for the **sync backend decision 7 anticipates.** Clean-
      sheet Drizzle/expo-sqlite choice (Phase 4) — zero migration cost from v1's integer PKs.
      Plant refs stay slugs; placements travel *inside* the build (referencing plant slugs), so
      they need no ID remap.
    - **Ripples:** Phase 4 (store) adopts UUID `id` on builds; Phase 5 (Export & backup) builds
      the versioned envelope + the migrate→validate→transaction import + the refuse-newer guard;
      Phase 5 exit gains a "restore rejects a newer-version file and a corrupt file cleanly — no
      half-import" check.

18. **Content pipeline — plant imagery + onboarding presets (Q18 — closed this
    continuation; the grill's last item).** The largest net-new *content* cost in v2.0,
    owner-curated (decision 3). Grounded: `assets/` ships only `build_photos/`, **zero plant
    images** (confirmed), and v1's only "preset" concept is the 16 *container* presets —
    **starter terrariums are net-new** too.
    - **Plant images = CC / public-domain photographs (Wikimedia Commons primary), accuracy
      first.** A plant app for beginners means a *wrong* image corrupts core trust — which
      **rules AI out as the default** (it renders plausible-but-wrong species). One static
      `image` per plant (decision 11) sourced as a real photo of the real species.
    - **Brand consistency via treatment, not source.** Normalize the photos with a uniform card
      frame — fixed aspect ratio, consistent crop, a subtle unified background / duotone — so the
      selector reads as one set, not a scrapbook. (This is also why `-ND` is disqualified below:
      the crop is a derivative.)
    - **License hygiene:** prefer **CC0 / PD → CC-BY → CC-BY-SA**; **avoid `-NC`** (non-commercial
      would block the public launch decision 1 anticipates) and **`-ND`** (no-derivatives blocks
      the normalizing crop). CC-BY-SA is fine to **bundle** — displaying an image is not adapting
      it, so it does not "infect" the app; it only obliges attribution.
    - **Schema implication — store attribution.** CC-BY legally *requires* credit, so the plant
      record gains **`image_credit` + `image_license`** fields, surfaced in a credits screen
      (and/or the Tier-3 line). These ride in the **seed** (decision 11's static path) and never
      enter the **backup payload** (decision 17 — curator content, not user data).
    - **Gaps = last resort, flagged.** For the handful of species with no acceptable CC photo,
      fall back to an owner illustration or a *vetted* AI image — but mark any non-photo
      "stylized" so it is never mistaken for a reference, and keep it the exception. Decision 11's
      deferred stylized `icon` + multi-photo gallery stay **v2.1**.
    - **Onboarding presets = 3–5 curated starter builds as bundled seed** (container + compatible
      plants + placements). High-leverage: they triple as the "<60s to first value" onboarding
      (Plan §4.9 / Premium §5 P0), demo/screenshot material, and end-to-end planner **test
      fixtures**. They **depend on the plant images**, so the order is **images → presets**, both
      folded into the Step 3 / Phase 3 authoring pass. A larger preset library is v2.1.
    - **Sequencing / cost:** the plant images are the **long pole** of the Step 3 pass and **gate
      Phase 3 exit** (the seed is incomplete without them); presets follow. The cut that, if v2.0
      slips, costs the most to rush — budget it as real content work, not a code task.

---

## Grill complete — queue exhausted

**Q8–Q18 are all closed. The grill queue is genuinely exhausted; the V2 plan is fully amended
through decision 18.** No open questions remain. If a future continuation surfaces a new soft
spot, add it as Q19+ here and re-open this section — but as of this session the rebuild is
understood end-to-end against the v1 oracle, with a single sanctioned engine divergence
(primary/secondary, decisions 4 + 15) and every other decision a faithful port or a documented,
deferred fast-follow.

---

## Still to grill (queue)

- ~~**Toxicity (Q8)**~~ — **CLOSED** → decision 8 (free-text, display-only, where-real).
- ~~**Parity-harness fixtures (Step 2C)**~~ — **CLOSED** → decision 9 (drop the harness;
  carry over v1 unit tests; port faithfully then refine freely; `builds.py` CRUD → Step 4).
- ~~**Build guide (Q10)**~~ — **CLOSED** → decision 10 (static projection in Final +
  export; override inputs re-homed to the Substrate/Hardscape steps;
  `substrate_depth`/`drainage_depth` persisted; material defaulted; hardscape
  derived from placements; delete v1's interactive page).
- ~~**`plant-photos` table (Q11)**~~ — **CLOSED** → decision 11 (drop the table; single
  static `image` path per plant in the seed; Phase 4 mirrors three entities).
- ~~**Substrate-component dataset (Q12)**~~ — **CLOSED** → decision 12 (defer the property
  matrix to v2.1; freeze the component vocabulary + split `wood`/`rock` out as hardscape;
  author root depth as a non-integrated, reference-only numeric range).
- ~~**Care tab scope (Q13)**~~ — **CLOSED** → decision 13 (build-level trimming; 3 task
  types; watering = inspection, never a timer; provisional curator-tunable cadence table;
  fertilizing / misting-task / snooze / per-task toggles excluded).
- ~~**Performance gate / physical Android (Q14)**~~ — **CLOSED** → decision 14 (acquisition
  declined; **60fps drag everywhere** via the UI-thread/transform rule; 30fps a JS-thread-only
  design budget on a Redmi 10 we don't own → Android fps unverified; "mid-range" struck).

**Reopened queue (surfaced while closing Q14):**
- ~~**Primary/secondary scoring algorithm (Q15)**~~ — **CLOSED** → decision 15 (best-pair
  min-adjacency on the v1 ladder; distance-0-via-secondary = one-step caution; **survival tier
  judged on primaries only** — a secondary never escapes lethal; envelope union is display-only;
  leverage all in `check_pair`).
- ~~**expo-notifications 64-pending iOS cap (Q16)**~~ — **CLOSED** → decision 16 (Model A:
  per-task native repeating triggers, 3 slots/terrarium; soonest-due ~50-slot budget guard with
  on-open/on-fire refill + graceful Care-tab disclosure; mark-done = cancel+reschedule; digest
  Model B deferred to v2.1).
- ~~**Backup/restore schema versioning (Q17)**~~ — **CLOSED** → decision 17 (version the envelope
  now with a no-op migrate; reuse the DB migration ladder → validate → one transaction;
  refuse-newer; restore = replace, merge deferred to v2.1; atomic; **UUID build IDs** so
  care-marks survive the round-trip).
- ~~**Content pipeline (Q18)**~~ — **CLOSED** → decision 18 (CC/PD photographs, accuracy first,
  AI ruled out as default; normalizing card treatment; license hygiene — no `-NC`/`-ND`;
  `image_credit`/`image_license` seed fields; 3–5 bundled onboarding presets; images are the
  Step 3 long pole and gate Phase 3 exit).

**Queue exhausted — no open items.**

---

## Method note for the continuing chat
Keep the grill posture: **one question at a time**, root/dependency order, each
with a **recommended answer**; **explore the v1 codebase** (the `terrarium-app`
repo) to settle factual questions rather than asking. v1 is the **oracle**,
frozen at tag `v1-oracle`. The only sanctioned engine divergence is
primary/secondary (decision 4).
