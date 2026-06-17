/**
 * The fixed v2.0 hardscape palette — a small set of generic wood/rock pieces the
 * owner can drop onto the 2-D front plane (decision 10: hardscape is *placement*,
 * not a substrate tag; the build-guide line is derived from whether anything is
 * placed). Asset ids are namespaced into placement slugs via `hardscapeSlug(id)`
 * so they never collide with plant slugs on the shared plane.
 *
 * No real art in v2.0 — each asset renders as a labelled emoji sprite, the same
 * placeholder stance as the plant photos (the owner long-pole). A richer asset
 * library is a later polish pass.
 */
export interface HardscapeAsset {
  id: string;
  label: string;
  emoji: string;
}

export const HARDSCAPE_ASSETS: readonly HardscapeAsset[] = [
  { id: 'driftwood', label: 'Driftwood', emoji: '🪵' },
  { id: 'rock', label: 'Rock', emoji: '🪨' },
  { id: 'stone', label: 'Stone', emoji: '⚪' },
  { id: 'bark', label: 'Bark', emoji: '🟤' },
];

const BY_ID = new Map(HARDSCAPE_ASSETS.map((a) => [a.id, a]));

/** Look up a hardscape asset by its bare id (the part after the `hardscape:` prefix). */
export function hardscapeAsset(id: string): HardscapeAsset | undefined {
  return BY_ID.get(id);
}
