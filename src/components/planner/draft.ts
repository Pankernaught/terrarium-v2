/**
 * The planner **draft** — the in-flight working copy of a build as the owner moves
 * through the 4 steps (Container · Substrate · Plants · Final). It
 * mirrors the editable fields of a persisted `Build` but is plain React state; it
 * is only written to the store via the build repo on the **Final** step's save.
 * Holding it as one object keeps every step a pure
 * `(draft) → patch` function and lets the persistent preview read a single source.
 *
 * **New** vs **edit**: a planner opened with `?build=<id>` hydrates the draft from
 * that build (`draftFromBuild`); with no param it starts from `emptyDraft()`.
 *
 * This module is pure data-shaping — no React, no DB driver. The `Build` import is
 * type-only (erased at build), so nothing native is pulled in.
 */
import type { Build } from '@/db/schema';
import type { SaveBuildInput, UpdateBuildPatch } from '@/db/builds-repo';
import type { Dimensions } from '@/logic/containers';
import type { Placement } from '@/logic/placement';
import type { SubstrateMix } from '@/logic/substrateMixer';
import type { ContainerOpening, ContainerShape } from '@/types';

/**
 * Drainage *material* is not a user-controlled field in v2.0; the Substrate step
 * shows this default and the v2.1 substrate mixer will own material choice.
 */
export const DEFAULT_DRAINAGE_MATERIAL = 'pebbles or LECA';

/** The editable fields of a build, as plain step-driven state. */
export interface PlannerDraft {
  /** Present only when editing an existing build (drives save vs. update). */
  id?: string;
  name: string;
  containerSlug: string | null;
  containerShape: ContainerShape | null;
  containerDimensions: Dimensions | null;
  containerVolumeL: number | null;
  containerOpening: ContainerOpening | null;
  plantSlugs: string[];
  placements: Placement[];
  substrateDepth: number | null;
  drainageDepth: number | null;
  /**
   * Depth (cm) of the discrete horticultural-charcoal filtration layer that sits
   * between drainage and substrate, or `null` when no charcoal layer is included.
   * Charcoal is a distinct layer, not a substrate-mix component (see ADR 0003);
   * the Substrate step toggles it on at a fixed default depth.
   */
  charcoalDepth: number | null;
  /** The custom substrate-mixer recipe, or `null` for no custom mix (opt-in). */
  substrateMix: SubstrateMix | null;
  tags: string[];
  description: string | null;
}

/** A blank draft for a brand-new build. */
export function emptyDraft(): PlannerDraft {
  return {
    name: '',
    containerSlug: null,
    containerShape: null,
    containerDimensions: null,
    containerVolumeL: null,
    containerOpening: null,
    plantSlugs: [],
    placements: [],
    substrateDepth: null,
    drainageDepth: null,
    charcoalDepth: null,
    substrateMix: null,
    tags: [],
    description: null,
  };
}

/** Hydrate a draft from a saved build (the `?build=<id>` edit path). */
export function draftFromBuild(b: Build): PlannerDraft {
  return {
    id: b.id,
    name: b.name,
    containerSlug: b.containerSlug,
    containerShape: (b.containerShape as ContainerShape | null) ?? null,
    containerDimensions: b.containerDimensions ?? null,
    containerVolumeL: b.containerVolumeL,
    containerOpening: (b.containerOpening as ContainerOpening | null) ?? null,
    plantSlugs: b.plantSlugs ?? [],
    placements: b.placements ?? [],
    substrateDepth: b.substrateDepth,
    drainageDepth: b.drainageDepth,
    charcoalDepth: b.charcoalDepth ?? null,
    substrateMix: b.substrateMix ?? null,
    tags: b.tags ?? [],
    description: b.description,
  };
}

/** Shape a draft into the repo `save` input (new build, Final step). */
export function draftToSaveInput(d: PlannerDraft): SaveBuildInput {
  return {
    name: d.name.trim() || 'Untitled terrarium',
    containerSlug: d.containerSlug,
    containerShape: d.containerShape,
    containerDimensions: d.containerDimensions,
    containerVolumeL: d.containerVolumeL,
    containerOpening: d.containerOpening,
    plantSlugs: d.plantSlugs,
    placements: d.placements,
    substrateDepth: d.substrateDepth,
    drainageDepth: d.drainageDepth,
    charcoalDepth: d.charcoalDepth,
    substrateMix: d.substrateMix,
    tags: d.tags,
    description: d.description,
  };
}

/** Shape a draft into the repo `update` patch (editing an existing build). */
export function draftToUpdatePatch(d: PlannerDraft): UpdateBuildPatch {
  // Every editable field is sent so an emptied field clears (repo treats a
  // present key as authoritative; an omitted key is left unchanged).
  return draftToSaveInput(d);
}
