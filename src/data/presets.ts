/**
 * Onboarding presets — 3–5 curated starter builds shipped as seed.
 *
 * They are the "<60s to first value" path, demo/screenshot material, and the
 * end-to-end planner test fixtures. Each is a container + a set of *compatible*
 * plants + their front-plane `placements`. Placements are plain `{ slug, x, y,
 * scale }` data:
 *   - `x`, `y` are normalized [0,1] positions on the 2-D front view, clamped to
 *     the container; y runs 0 = top → 1 = bottom, so ground covers sit near the
 *     bottom and taller specimens higher up.
 *   - `scale` is a relative size multiplier (~0.5–1.2).
 *
 * Referential integrity (every `containerSlug` / placement `slug` resolves, and
 * the plant set is mutually compatible) is asserted by the seed test.
 */
import { z } from 'zod';

export const placementSchema = z.object({
  slug: z.string(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().positive(),
});
export type Placement = z.infer<typeof placementSchema>;

export const presetSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  containerSlug: z.string(),
  placements: z.array(placementSchema).min(1),
});
export type Preset = z.infer<typeof presetSchema>;

export const PRESETS: Preset[] = [
  {
    slug: 'beginner-sealed-jar',
    name: 'Beginner Sealed Jar',
    description:
      'A near-indestructible closed jar: a cushion-moss carpet, a nerve-plant centrepiece, and forgiving java moss. Low light, stays humid on its own.',
    containerSlug: 'mason-jar-medium',
    placements: [
      { slug: 'leucobryum-glaucum', x: 0.3, y: 0.82, scale: 0.7 },
      { slug: 'fittonia-albivenis', x: 0.55, y: 0.68, scale: 0.95 },
      { slug: 'taxiphyllum-barbieri', x: 0.78, y: 0.85, scale: 0.6 },
    ],
  },
  {
    slug: 'tropical-terrarium',
    name: 'Tropical Terrarium',
    description:
      'A layered closed build for a converted aquarium: a bird’s-nest fern backdrop, a friendship-plant mid-layer, and a baby-tears + sheet-moss floor.',
    containerSlug: 'medium-aquarium',
    placements: [
      { slug: 'asplenium-nidus', x: 0.32, y: 0.55, scale: 1.15 },
      { slug: 'pilea-involucrata', x: 0.62, y: 0.66, scale: 0.85 },
      { slug: 'soleirolia-soleirolii', x: 0.8, y: 0.84, scale: 0.6 },
      { slug: 'hypnum-moss', x: 0.2, y: 0.86, scale: 0.55 },
    ],
  },
  {
    slug: 'desert-open-bowl',
    name: 'Desert Open Bowl',
    description:
      'A bright, dry succulent dish in an open bowl: zebra haworthia, a Mexican-snowball rosette, and jelly-bean sedum. Water sparingly, never seal it.',
    containerSlug: 'open-bowl-small',
    placements: [
      { slug: 'haworthia-attenuata', x: 0.35, y: 0.72, scale: 0.9 },
      { slug: 'echeveria-elegans', x: 0.6, y: 0.74, scale: 0.95 },
      { slug: 'sedum-rubrotinctum', x: 0.8, y: 0.8, scale: 0.7 },
    ],
  },
  {
    slug: 'open-foliage-garden',
    name: 'Open Foliage Garden',
    description:
      'An easy open garden of bright-indirect foliage: a baby-rubber-plant anchor, a Chinese-money-plant accent, and a trailing inch plant over the rim.',
    containerSlug: 'open-terrarium-medium',
    placements: [
      { slug: 'peperomia-obtusifolia', x: 0.35, y: 0.62, scale: 1.0 },
      { slug: 'pilea-peperomioides', x: 0.62, y: 0.66, scale: 0.9 },
      { slug: 'tradescantia-zebrina', x: 0.85, y: 0.7, scale: 0.75 },
    ],
  },
];
