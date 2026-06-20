/**
 * Frozen substrate-component vocabulary.
 *
 * v2.0 freezes the canonical substrate materials as a `{ id, label }` list (stable
 * id for data + filtering; label for display). `wood` / `rock` are deliberately
 * excluded — they are decor, not a growing medium, so they are not substrate tags.
 *
 * Seed plants reference these `id`s in `substrateTags`; the seed loader
 * (`src/data/index.ts`) rejects any tag outside this frozen set, so a typo or a new
 * material fails CI rather than silently shipping.
 */

export interface Component {
  id: string;
  label: string;
}

/**
 * The 13 canonical substrate materials. `mud` is the outlier — kept for
 * bog/paludarium use.
 *
 * Note: **charcoal is deliberately NOT here.** Horticultural charcoal is used as a
 * thin discrete filtration *layer* between drainage and substrate, not blended into
 * the growing medium — it is modelled as its own layer (`builds.charcoalDepth`), not
 * a mix component (see ADR 0003). Leaf litter is likewise absent: it is a care-tab
 * surface item, not a substrate.
 */
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
  { id: 'potting-soil', label: 'Potting soil' },
  { id: 'worm-castings', label: 'Worm castings' },
  { id: 'vermiculite', label: 'Vermiculite' },
  { id: 'leca', label: 'LECA' },
] as const satisfies readonly Component[];

export type SubstrateComponentId = (typeof SUBSTRATE_COMPONENTS)[number]['id'];

export const SUBSTRATE_COMPONENT_IDS: readonly string[] = SUBSTRATE_COMPONENTS.map(
  (c) => c.id,
);

const LABELS: Record<string, string> = Object.fromEntries(
  SUBSTRATE_COMPONENTS.map((c) => [c.id, c.label]),
);

/** Display label for a substrate id (falls back to the raw id). */
export function componentLabel(id: string): string {
  return LABELS[id] ?? id;
}

export function isSubstrateComponentId(id: string): id is SubstrateComponentId {
  return SUBSTRATE_COMPONENT_IDS.includes(id);
}
