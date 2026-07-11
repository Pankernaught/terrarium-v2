/**
 * Per-vibe art slots — static `require()` literals (Metro bundles only static
 * requires, never `require(dynamicString)`). Each vibe owns its art the way each
 * plant owns its image; the render reads `VibeArt[vibe].<slot>`.
 *
 * Two roles, kept distinct (ADR 0007 A6): ambient **critters** live in the backdrop
 * (an open set — file-drop + a line below); a featured **mascot** greets in empty
 * states (named poses). Both are open/expandable: a new critter or pose is one
 * `require()` line + one PNG at the path. A typo'd path is a runtime miss, not a
 * compile error — the CI gate (`src/data/__tests__/vibe-art.test.ts`) text-scans the
 * `require()` paths here and asserts each file exists under `assets/vibes/`.
 *
 * Values are Metro asset ids (`require()` → `number`), which `expo-image`'s `<Image
 * source>` accepts directly.
 */
import type { VibeId } from '@/constants/theme';

/** Mascot poses — named, expandable (add a pose: extend this union + a `require`). */
export type MascotPose = 'default' | 'sad' | 'pensive';

export interface VibeArtBundle {
  /** Bottom-canopy fill pool — slot-filled into a dense overlapping mass. Plain
   *  `number[]`: a sprite carries no metadata, the layout decides scale/flip/row. */
  bottomSprites?: number[];
  /** Tall accent pool — ≤1 chosen per launch, scaled to rise as a centerpiece. */
  focalSprites?: number[];
  /** Open critter set — ship one, expand by file-drop. */
  critters?: Record<string, number>;
  /** Featured-mascot poses (empty states). */
  mascot?: Partial<Record<MascotPose, number>>;
}

export const VibeArt: Partial<Record<VibeId, VibeArtBundle>> = {
  conservatory: {
    // Drop hand-drawn transparent PNGs (base rooted at the image's bottom edge) into
    // assets/vibes/conservatory/canopy|focal/ and add one require() line each — e.g.
    // require('…/canopy/pothos.png'). The CI gate (vibe-art.test.ts) text-scans the
    // @/assets paths here and fails on a missing file, so only add a line with its PNG.
    bottomSprites: [],
    focalSprites: [],
    critters: {
      snail: require('@/assets/vibes/conservatory/critters/snail.png'),
    },
    mascot: {
      default: require('@/assets/vibes/conservatory/mascot/default.png'),
      sad: require('@/assets/vibes/conservatory/mascot/sad.png'),
      pensive: require('@/assets/vibes/conservatory/mascot/pensive.png'),
    },
  },
};

/** The active vibe's mascot pose, or `undefined` when the vibe defines none
 *  (graceful — Glasshouse stays text-only). Keeps `<EmptyState>` vibe-agnostic. */
export function vibeMascot(vibe: VibeId, pose: MascotPose): number | undefined {
  return VibeArt[vibe]?.mascot?.[pose];
}
