/**
 * The contract every planner step body implements. A step is a pure-ish view over
 * the shared {@link PlannerDraft}: it reads the draft (+ the resolved selected
 * plants) and emits patches through `update`. It owns no persistence and no
 * cross-step state — the planner screen holds the draft and the step navigation.
 */
import type { Plant } from '@/types';

import type { PlannerDraft } from './draft';

export interface StepProps {
  draft: PlannerDraft;
  /**
   * The selected plants resolved from the seed bundle (`loadPlants()`, decision 11
   * — zero DB round-trip). Used to seed/recommend from the chosen plants. Empty for
   * a brand-new build until the Plants step (Phase 6 chat 2) populates `plantSlugs`.
   */
  plants: Plant[];
  /** Shallow-merge a partial patch into the draft. */
  update: (patch: Partial<PlannerDraft>) => void;
}
