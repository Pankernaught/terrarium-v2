/**
 * `<PlantArt>` — turns a {@link ComposedPlant} (pure geometry from `plant-glyphs.ts`)
 * into `react-native-svg`. The **same** component is used by the `/glyph-lab` design
 * harness and (after integration) the planner cross-section, so what's tuned in the
 * lab is literally what ships — no port between environments (ADR 0012 §8).
 *
 * It draws, base-anchored at the caller's `translate(xPx, surfaceY)`:
 *   - the tapered **stem** (+ a faint **ghost** to max height with a dashed cap), then
 *   - each placed **foliage glyph** — a flat two-tone "cut-paper" form (sage body +
 *     one lighter highlight, no outline), at its seeded rotation/scale jitter.
 *
 * Glyph paths are authored centred on (0,0) within ±{@link GLYPH_UNIT} (the contract
 * the placement loop's footprint bound depends on). Colour derives from the themed
 * `sage` with a per-`plantType` hue/value nudge + seeded per-plant value jitter, so
 * two same-type neighbours differ (ADR 0012 §6).
 */
import { G, Line, Path } from 'react-native-svg';

import type { Palette } from '@/constants/theme';
import {
  GLYPH_UNIT,
  type ComposedPlant,
  type GlyphId,
} from '@/logic/plant-glyphs';
import { rand } from '@/logic/substrate-wave';
import type { PlantType } from '@/types';

/** A glyph = 1–3 `body` path variants + one lighter `highlight`, all within ±GLYPH_UNIT. */
interface GlyphArt {
  body: string[];
  highlight: string;
}

// ponytail: first-pass stub silhouettes — recognizable, not final. Tuned in /glyph-lab.
const GLYPHS: Record<GlyphId, GlyphArt> = {
  ovate: {
    body: [
      'M 0 -9 C 4.5 -5 4.5 5 0 9 C -4.5 5 -4.5 -5 0 -9 Z',
      'M 0 -9 C 5 -4 4 6 0 9 C -4.5 5 -5 -4 0 -9 Z',
    ],
    highlight: 'M 0 -6 C 2 -3 2 4 0 6 C -1 3 -1 -3 0 -6 Z',
  },
  // Begonia — a clearly lopsided angel-wing: pointed apex top-right, one fuller lobe.
  'angel-wing': {
    body: [
      'M 1 -9 C 6.5 -6 7.5 3 2 9 C -1.5 7 -4.5 -1 -3 -6 C -2 -8.5 0 -8.5 1 -9 Z',
      'M 0.5 -9 C 7 -5 6.5 4 1 9 C -2 6.5 -4.5 -2 -2.5 -6.5 C -1.5 -8.5 -0.5 -8.5 0.5 -9 Z',
    ],
    highlight: 'M 0.5 -6 C 3.5 -4 4 2 1 6 C -0.5 4 -2 -1 -1 -4 C -0.3 -5.5 0 -5.5 0.5 -6 Z',
  },
  // Aroid — heart (point down) + a pale midrib & two side veins (highlight subpaths).
  'veined-heart': {
    body: [
      'M 0 9 C -7 0 -8.5 -7 -3.5 -6.5 C -1.2 -6.2 -0.2 -4.2 0 -3 C 0.2 -4.2 1.2 -6.2 3.5 -6.5 C 8.5 -7 7 0 0 9 Z',
      'M 0 9 C -8 1 -8.5 -7.5 -3 -6.5 C -1 -6 -0.2 -4 0 -3 C 0.2 -4 1 -6 3 -6.5 C 8.5 -7.5 8 1 0 9 Z',
    ],
    highlight: 'M -0.45 7 L 0.45 7 L 0.45 -5 L -0.45 -5 Z M 0 -1 L 3 -4 L 2.6 -4.8 L -0.3 -2 Z M 0 -1 L -3 -4 L -2.6 -4.8 L 0.3 -2 Z',
  },
  // Fern — pinnate, paired leaflets stepping off a midrib.
  frond: {
    body: [
      'M 0 9 L -1.2 6 L -4 5 L -1.2 3.5 L -4.5 2 L -1.2 0.5 L -4.2 -1.5 L -1 -3 L -3.5 -5 L -0.8 -6.5 L 0 -9 L 0.8 -6.5 L 3.5 -5 L 1 -3 L 4.2 -1.5 L 1.2 0.5 L 4.5 2 L 1.2 3.5 L 4 5 L 1.2 6 Z',
      'M 0 9 L -1 5.5 L -4.2 4.5 L -1 3 L -4.6 1.5 L -1 -0.2 L -4 -2 L -0.8 -3.4 L -3.3 -5.4 L -0.7 -6.8 L 0 -9 L 0.7 -6.8 L 3.3 -5.4 L 0.8 -3.4 L 4 -2 L 1 -0.2 L 4.6 1.5 L 1 3 L 4.2 4.5 L 1 5.5 Z',
    ],
    highlight: 'M -0.4 8 L 0.4 8 L 0.5 -7 L -0.5 -7 Z',
  },
  // Orchid — clean strappy blade (no whiskers); identity is the broad arching strap.
  'strap-spike': {
    body: [
      'M -2.4 9 C -3.2 2 -2.6 -6 -0.4 -9 C 1.8 -6 2.4 2 1.4 9 Z',
      'M -1.6 9 C -3 3 -2.2 -6 0.2 -9 C 2.2 -6 2.6 3 1 9 Z',
    ],
    highlight: 'M -0.2 7 C -1.4 1 -1 -5 0 -7.5 C 1 -5 1.4 1 0.4 7 Z',
  },
  // Bromeliad — rigid pointed straps fanning from the base.
  'strap-whorl': {
    body: [
      'M 0 9 L -6.5 -3 L -4 -4 L -1.2 -7.5 L 0 -9 L 1.2 -7.5 L 4 -4 L 6.5 -3 Z',
      'M 0 9 L -6 -2 L -3.5 -3.5 L -1 -8 L 0 -9 L 1 -8 L 3.5 -3.5 L 6 -2 Z',
    ],
    highlight: 'M 0 8 L -1.4 -6 L 0 -9 L 1.4 -6 Z',
  },
  'fat-leaf': {
    body: [
      'M 0 -9 C 6 -3 6 6 0 9 C -6 6 -6 -3 0 -9 Z',
      'M 0 -9 C 6.5 -2 5.5 6 0 9 C -5.5 6 -6.5 -2 0 -9 Z',
    ],
    highlight: 'M 0 -6 C 3 -2 3 4 0 6 C -1.5 4 -1.5 -2 0 -6 Z',
  },
  // Moss — a low, soft cushion of small bumps, wider than tall.
  fuzz: {
    body: [
      'M -9 9 C -9 4 -7 1.5 -4.5 1.5 C -3 1.5 -2 3 0 2.5 C 2 3 3 1.5 4.5 1.5 C 7 1.5 9 4 9 9 Z',
      'M -9 9 C -9 4.5 -7.5 2 -5 2 C -3.2 2 -2.2 3.5 -0.3 3 C 1.6 3.5 2.8 2 4.7 2 C 7.2 2 9 4.5 9 9 Z',
    ],
    highlight: 'M -6.5 9 C -6.5 5.5 -4 4.5 0 4.5 C 4 4.5 6.5 5.5 6.5 9 Z',
  },
  // Carnivorous — a narrow pitcher tube with a lighter mouth rim at the top.
  pitcher: {
    body: [
      'M -2.6 -7 C -3.6 -3 -3.4 6 -1.8 9 L 1.8 9 C 3.4 6 3.6 -3 2.6 -7 C 1.8 -8.6 -1.8 -8.6 -2.6 -7 Z',
      'M -2.2 -7.2 C -3.2 -2.5 -3 6 -1.6 9 L 2 9 C 3.4 6 3.2 -2.5 2.2 -7.2 C 1.4 -8.6 -1.6 -8.6 -2.2 -7.2 Z',
    ],
    highlight: 'M -2.6 -7 C -1.6 -9 1.6 -9 2.6 -7 C 1.8 -6.2 -1.8 -6.2 -2.6 -7 Z',
  },
};

// --- Colour ----------------------------------------------------------------

/** Per-`plantType` hue/value nudge off the themed sage: [target hex, blend amount]. */
const TYPE_TINT: Partial<Record<PlantType, [string, number]>> = {
  fern: ['#3E7E6E', 0.3], // cooler
  'fern-ally': ['#3E7E6E', 0.3],
  aroid: ['#2C4A2E', 0.35], // deeper
  moss: ['#7FA24E', 0.4], // brighter, yellower
  succulent: ['#8A9B86', 0.4], // greyer
  carnivorous: ['#6E5A3E', 0.25], // a dull flush
  begonia: ['#7A5050', 0.2], // warm underside
  bromeliad: ['#6E8A3E', 0.25],
  orchid: ['#4A6E5A', 0.2],
};

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** Lerp two #rrggbb colours by `t` (0 = a, 1 = b). */
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

/** Resolve {body, highlight, stem} colours for a plant from theme + type + seed. */
function colorsFor(c: Palette, type: PlantType, seed: number) {
  const tint = TYPE_TINT[type];
  let body = tint ? mix(c.sage, tint[0], tint[1]) : c.sage;
  // Seeded per-plant value jitter so two same-type neighbours differ (±~9%).
  const j = (rand(seed) - 0.5) * 0.18;
  body = mix(body, j > 0 ? '#FFFFFF' : '#000000', Math.abs(j));
  return { body, highlight: mix(body, '#FFFFFF', 0.24), stem: mix(body, '#6E5A3A', 0.35) };
}

// --- Component --------------------------------------------------------------

/**
 * Render a composed plant, base-anchored at (0,0). The caller wraps this in a
 * `<G transform="translate(xPx, surfaceY)">` (the harness and the cross-section both).
 */
export function PlantArt({ composed, seed, c }: { composed: ComposedPlant; seed: number; c: Palette }) {
  const { stem, foliage } = composed;
  const type = foliage[0]?.type ?? 'foliage';
  const col = colorsFor(c, type, seed);

  return (
    <G>
      {/* Ghost headroom (behind the stem), then the solid tapered stem. */}
      {stem.ghostPath ? <Path d={stem.ghostPath} fill={c.sage} opacity={0.28} /> : null}
      {stem.ghostCapY != null ? (
        <Line x1={-2.5} y1={stem.ghostCapY} x2={2.5} y2={stem.ghostCapY} stroke={c.sage} strokeWidth={1} strokeDasharray="2 2" opacity={0.4} />
      ) : null}
      <Path d={stem.path} fill={col.stem} />

      {/* Foliage glyphs on top, each at its seeded jitter. */}
      {foliage.map((g, i) => {
        const art = GLYPHS[g.glyph];
        const d = art.body[g.variant % art.body.length];
        return (
          <G key={i} transform={`translate(${g.x.toFixed(2)}, ${g.y.toFixed(2)}) rotate(${g.rotate.toFixed(1)}) scale(${g.scale.toFixed(3)})`}>
            <Path d={d} fill={col.body} />
            <Path d={art.highlight} fill={col.highlight} opacity={0.7} />
          </G>
        );
      })}
    </G>
  );
}

export { GLYPH_UNIT };
