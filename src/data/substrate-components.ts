/**
 * Frozen substrate-component vocabulary (decision 12).
 *
 * v2.0 does **two** pieces of substrate hygiene and nothing more:
 *   1. Freeze the ~9 real substrate materials as a canonical `{ id, label }` list
 *      (stable id for data + filtering; label for display).
 *   2. Split `wood` / `rock` out as **hardscape**, not substrate — they only ever
 *      fed the v1 build guide's hardscape grep, and decision 10 makes hardscape
 *      placement-driven (Phase 6), so they are no longer substrate tags.
 *
 * The per-component **property matrix** (aeration / water-retention / nutrient /
 * buffering / particle-size) is **deferred to v2.1**, co-located with the substrate
 * mixer that is its only consumer (decision 12). Do not author it here.
 *
 * Seed plants reference these `id`s in `substrateTags` / `hardscapeTags`; the seed
 * loader (`src/data/index.ts`) rejects any tag outside this frozen set, so a typo
 * or a new material fails CI rather than silently shipping.
 */

export interface Component {
  id: string;
  label: string;
}

/** The 9 canonical substrate materials (decision 12). `mud` is the outlier. */
export const SUBSTRATE_COMPONENTS = [
  { id: 'perlite', label: 'Perlite' },
  { id: 'peat', label: 'Peat' },
  { id: 'sphagnum', label: 'Sphagnum moss' },
  { id: 'sand', label: 'Sand' },
  { id: 'coco-coir', label: 'Coco coir' },
  { id: 'grit', label: 'Grit' },
  { id: 'orchid-bark', label: 'Orchid bark' },
  { id: 'pumice', label: 'Pumice' },
  { id: 'mud', label: 'Mud' },
] as const satisfies readonly Component[];

/** `wood` / `rock` — hardscape, split out of substrate (decision 12 / decision 10). */
export const HARDSCAPE_COMPONENTS = [
  { id: 'wood', label: 'Wood' },
  { id: 'rock', label: 'Rock' },
] as const satisfies readonly Component[];

export type SubstrateComponentId = (typeof SUBSTRATE_COMPONENTS)[number]['id'];
export type HardscapeComponentId = (typeof HARDSCAPE_COMPONENTS)[number]['id'];

export const SUBSTRATE_COMPONENT_IDS: readonly string[] = SUBSTRATE_COMPONENTS.map(
  (c) => c.id,
);
export const HARDSCAPE_COMPONENT_IDS: readonly string[] = HARDSCAPE_COMPONENTS.map(
  (c) => c.id,
);

const LABELS: Record<string, string> = Object.fromEntries(
  [...SUBSTRATE_COMPONENTS, ...HARDSCAPE_COMPONENTS].map((c) => [c.id, c.label]),
);

/** Display label for a substrate/hardscape id (falls back to the raw id). */
export function componentLabel(id: string): string {
  return LABELS[id] ?? id;
}

export function isSubstrateComponentId(id: string): id is SubstrateComponentId {
  return SUBSTRATE_COMPONENT_IDS.includes(id);
}
export function isHardscapeComponentId(id: string): id is HardscapeComponentId {
  return HARDSCAPE_COMPONENT_IDS.includes(id);
}
