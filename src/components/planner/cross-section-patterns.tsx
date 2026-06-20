/**
 * Substrate **texture library** for the cross-section viewer.
 *
 * The substrate body is painted in layers (see `cross-section.tsx`):
 *   1. a flat brown **base** ({@link SOIL_BASE_FILL}),
 *   2. an always-on **soil stipple** that gives bare substrate its identity, and
 *   3. one **component overlay** per ingredient in the build's `substrateMix`,
 *      each filled with that component's `<Pattern>` at an opacity proportional to
 *      its share of the mix — so a 3:1 perlite:peat blend reads as mostly perlite
 *      specks over a faint peat stipple.
 *
 * Each component's look is authored as a small table of {@link Mark}s tiled across a
 * {@link TILE}×{@link TILE} cell. Keeping the marks as **data** (not hand-written
 * JSX per component) means the colour-and-shape vocabulary lives in one readable
 * place, and {@link SubstratePatternDefs} renders only the patterns a given build
 * actually needs. This is `.tsx` (not `.ts`) only because it emits `<Pattern>`
 * nodes; it holds no component state.
 *
 * Colours are deliberately **fixed earthy hex**, not theme tokens: soil is brown in
 * light and dark mode alike, and the cross-section is an illustration of real
 * material, not a themed surface.
 */
import {
  Circle,
  FeDropShadow,
  Filter,
  Line,
  LinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
} from 'react-native-svg';

/** Flat base colour under the stipple + overlays — a mid potting-soil brown. */
export const SOIL_BASE_FILL = '#6F5238';

/** Tile size (px, userSpaceOnUse) every substrate pattern repeats over. */
const TILE = 16;

/**
 * A single primitive within a pattern tile (or a scattered mark).
 *
 * The `path` variant carries a `d` string authored **centred on (0,0)**, so the
 * scatter loop can `translate`/`rotate`/`scale` it freely. Filled blobs set `fill`;
 * stroked strands (sphagnum, coco-coir) set `stroke` + `strokeWidth` instead.
 */
export type Mark =
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill: string; opacity?: number; rx?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; opacity?: number }
  | { kind: 'path'; d: string; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number };

/**
 * The always-on stipple drawn over the brown base for *every* substrate, mix or no
 * mix — fine dark flecks that keep bare soil from reading as a flat slab.
 */
const SOIL_STIPPLE_MARKS: Mark[] = [
  { kind: 'circle', cx: 3, cy: 4, r: 2, fill: '#4A3826', opacity: 0.5 },
  { kind: 'circle', cx: 11, cy: 2, r: 1.6, fill: '#5A4631', opacity: 0.45 },
  { kind: 'circle', cx: 8, cy: 9, r: 2, fill: '#43331F', opacity: 0.5 },
  { kind: 'circle', cx: 13, cy: 12, r: 1.6, fill: '#5A4631', opacity: 0.4 },
  { kind: 'circle', cx: 5, cy: 13, r: 1.8, fill: '#4A3826', opacity: 0.45 },
];

/**
 * Per-component marks, keyed by the `SUBSTRATE_COMPONENTS` id. Each entry is a coarse
 * caricature of how the material reads in a mix — white perlite specks, chunky orange
 * bark, grey grit, clay-orange LECA balls, etc. Authored, not literal.
 *
 * **Chunky** (bark, leca, pumice, grit) and **standard** (perlite, peat,
 * worm-castings, vermiculite, sphagnum, coco-coir) components are authored as 3
 * organic `path` variants each, centred on (0,0). The scatter loop interleaves the
 * variants and applies per-instance rotation + scale jitter, so a field of bark
 * never reads as the same stamped shape twice — the fix for the "digital perfection"
 * the geometric primitives gave off.
 *
 * **Fine** components (sand, potting-soil) stay as small primitives: at their low
 * blending opacity, perfect-circle regularity is invisible and dissolves into the
 * base more cleanly than a blob would. **Mud** is a flat band tint, not scattered
 * marks at all (see {@link getComponentStyle}) — its job is to deepen, not to read
 * as objects.
 */
const COMPONENT_MARKS: Record<string, Mark[]> = {
  // Volcanic glass — bright white irregular specks scattered through the soil.
  perlite: [
    { kind: 'path', fill: '#F4F2EA', d: 'M -2.9 -0.8 C -3 -2.2 -1.6 -2.9 0 -2.8 C 1.8 -3 3 -1.8 2.9 -0.2 C 3.1 1.6 1.8 2.9 0.2 2.8 C -1.6 3 -3 1.6 -2.9 -0.8 Z' },
    { kind: 'path', fill: '#F4F2EA', d: 'M -3.1 -0.4 C -3.1 -2 -1.6 -3 0.2 -2.9 C 1.9 -2.8 3.1 -1.4 3 0.2 C 3.1 1.9 1.6 3 -0.2 2.9 C -1.9 2.8 -3.1 1.4 -3.1 -0.4 Z' },
    { kind: 'path', fill: '#E8E6DC', d: 'M -2.6 -1 C -2.6 -2.4 -1.2 -2.7 0.4 -2.6 C 2 -2.6 2.8 -1.4 2.7 0.2 C 2.8 1.8 1.6 2.6 0 2.6 C -1.6 2.7 -2.6 1.4 -2.6 -1 Z' },
  ],
  // Dense dark moisture-holding crumbs.
  peat: [
    { kind: 'path', fill: '#33251A', d: 'M -2.6 -0.8 C -2.7 -2 -1.4 -2.6 0 -2.5 C 1.6 -2.7 2.7 -1.6 2.6 -0.2 C 2.8 1.4 1.6 2.6 0.2 2.5 C -1.4 2.7 -2.6 1.4 -2.6 -0.8 Z' },
    { kind: 'path', fill: '#2C2016', d: 'M -2.8 -0.4 C -2.8 -1.8 -1.4 -2.7 0.2 -2.6 C 1.7 -2.5 2.8 -1.2 2.7 0.2 C 2.8 1.7 1.4 2.7 -0.2 2.6 C -1.7 2.5 -2.8 1.2 -2.8 -0.4 Z' },
    { kind: 'path', fill: '#33251A', d: 'M -2.3 -1 C -2.3 -2.2 -1 -2.5 0.4 -2.4 C 1.8 -2.4 2.5 -1.2 2.4 0.2 C 2.5 1.6 1.4 2.4 0 2.4 C -1.4 2.5 -2.3 1.2 -2.3 -1 Z' },
  ],
  // Sphagnum — pale-green sinuous strands.
  sphagnum: [
    { kind: 'path', stroke: '#7E8C5A', strokeWidth: 1.6, d: 'M -6 1 C -3.5 -2.5 -1 2.5 1 0 C 3 -2.5 5 1.5 6.5 -0.5' },
    { kind: 'path', stroke: '#8C9A66', strokeWidth: 1.6, d: 'M -6.5 -0.5 C -4 2 -1.5 -2 0.5 0.5 C 2.5 3 4.5 -1 6 1' },
    { kind: 'path', stroke: '#7E8C5A', strokeWidth: 1.4, d: 'M -5.5 0 C -3 -2 -1.5 2 0 0 C 2 -2.5 4 2 6 -0.5' },
  ],
  // Sand — fine tan grains (small + dense, blends into the base).
  sand: [
    { kind: 'circle', cx: 0, cy: 0, r: 0.9, fill: '#D9C9A3' },
    { kind: 'circle', cx: 0, cy: 0, r: 0.8, fill: '#CFBE96' },
    { kind: 'circle', cx: 0, cy: 0, r: 1, fill: '#D9C9A3' },
    { kind: 'circle', cx: 0, cy: 0, r: 0.8, fill: '#CFBE96' },
  ],
  // Coco coir — wavy brown fibres.
  'coco-coir': [
    { kind: 'path', stroke: '#6E4A2C', strokeWidth: 1.6, d: 'M -6.5 0.5 C -3.5 -1.5 -0.5 1.5 2 -0.5 C 4 -2 5.5 0.5 6.8 -1' },
    { kind: 'path', stroke: '#7A5230', strokeWidth: 1.6, d: 'M -6 -1 C -3 0.5 0 -1.5 2.5 0 C 4.5 1 5.5 -0.5 6.5 0.8' },
    { kind: 'path', stroke: '#6E4A2C', strokeWidth: 1.5, d: 'M -6.2 0 C -3.5 -1 -1 1.5 1.5 0 C 3.5 -1.5 5 0.5 6.5 -0.8' },
  ],
  // Grit — small angular grey chips.
  grit: [
    { kind: 'path', fill: '#9AA0A0', d: 'M -2.6 -1.8 L 0.4 -2.4 L 2.6 -0.8 L 2.2 1.8 L -0.6 2.4 L -2.6 0.6 Z' },
    { kind: 'path', fill: '#878D8D', d: 'M -2.4 -2.2 L 1.2 -1.8 L 2.6 0.4 L 1.4 2.4 L -1.8 1.8 L -2.6 -0.6 Z' },
    { kind: 'path', fill: '#9AA0A0', d: 'M -2.2 -1.4 L 1.6 -2.2 L 2.4 0.8 L 0.6 2.2 L -2.4 1.4 Z' },
  ],
  // Orchid bark — chunky angular orange-brown shards.
  'orchid-bark': [
    { kind: 'path', fill: '#8A5A33', d: 'M -5.6 -1.8 L -3 -2.4 L 1.5 -2 L 5.4 -1.2 L 5 1.4 L 1 2.2 L -3.5 1.8 L -5.4 0.6 Z' },
    { kind: 'path', fill: '#7A4E2B', d: 'M -5 -2.2 L -1.5 -1.6 L 3 -2.2 L 5.6 -0.8 L 4.6 1.8 L 0.5 1.4 L -3.8 2 L -5.2 -0.2 Z' },
    { kind: 'path', fill: '#8A5A33', d: 'M -4.4 -2 L -1 -2.4 L 3.4 -1.6 L 4.8 0.2 L 3.6 2.2 L -0.5 1.8 L -4 2.2 L -4.6 -0.4 Z' },
  ],
  // Pumice — pale porous grey lumps.
  pumice: [
    { kind: 'path', fill: '#C7C2B8', d: 'M -3.8 -1.2 C -4.2 -3 -2.4 -4.1 -0.5 -3.9 C 1.6 -4.3 4 -3 3.9 -0.8 C 4.4 1.4 3.2 3.8 0.9 3.9 C -1.4 4.4 -4 3.2 -3.8 -1.2 Z' },
    { kind: 'path', fill: '#B9B4AA', d: 'M -4.6 -0.6 C -4.8 -2.4 -2.8 -3.4 -0.8 -3.2 C 1.8 -3.6 4.6 -2.6 4.7 -0.4 C 4.9 1.6 3.4 3.2 1 3.3 C -1.6 3.7 -4.4 2.8 -4.6 -0.6 Z' },
    { kind: 'path', fill: '#C7C2B8', d: 'M -3.4 -1.8 C -3.2 -3.4 -1.4 -3.8 0.2 -3.6 C 2.2 -3.8 3.8 -2.2 3.6 -0.4 C 3.9 1.8 2.6 3.6 0.4 3.5 C -1.8 3.7 -3.6 2 -3.4 -1.8 Z' },
  ],
  // Mud — a flat dark band tint, not scattered marks (see getComponentStyle).
  mud: [],
  // Potting soil — medium-brown crumb stipple (fine, stays primitive).
  'potting-soil': [
    { kind: 'circle', cx: 0, cy: 0, r: 2.6, fill: '#4A3724' },
    { kind: 'circle', cx: 0, cy: 0, r: 2.8, fill: '#54402A' },
    { kind: 'circle', cx: 0, cy: 0, r: 2.4, fill: '#4A3724' },
  ],
  // Worm castings — rich dark rounded pellets.
  'worm-castings': [
    { kind: 'path', fill: '#33261A', d: 'M -3 -0.6 C -3 -2.2 -1.4 -3 0.2 -2.9 C 2.2 -3 3.2 -1.4 3.1 0.2 C 3.2 2 1.8 3 0 2.9 C -1.8 3 -3 1.6 -3 -0.6 Z' },
    { kind: 'path', fill: '#2B2015', d: 'M -3.4 -0.2 C -3.4 -1.8 -1.8 -2.8 0 -2.7 C 1.8 -2.6 3.4 -1.4 3.3 0.4 C 3.4 2 1.6 2.8 -0.2 2.7 C -2 2.6 -3.4 1.4 -3.4 -0.2 Z' },
    { kind: 'path', fill: '#33261A', d: 'M -2.7 -0.8 C -2.7 -2.2 -1.2 -2.8 0.4 -2.7 C 2 -2.7 2.9 -1.4 2.8 0.2 C 2.9 1.8 1.6 2.7 0 2.7 C -1.6 2.8 -2.7 1.4 -2.7 -0.8 Z' },
  ],
  // Vermiculite — golden flat mineral flakes.
  vermiculite: [
    { kind: 'path', fill: '#B89A5A', d: 'M -3 -1 C -1 -1.6 1.5 -1.5 3 -0.9 C 3.4 -0.2 3.3 0.4 2.9 1 C 1 1.6 -1.5 1.5 -3 0.9 C -3.4 0.2 -3.3 -0.4 -3 -1 Z' },
    { kind: 'path', fill: '#C2A766', d: 'M -3.2 -0.8 C -1.2 -1.4 1.4 -1.6 3.1 -1 C 3.5 -0.2 3.4 0.6 2.8 1.1 C 0.8 1.5 -1.6 1.4 -3.1 0.8 C -3.5 0.2 -3.5 -0.3 -3.2 -0.8 Z' },
    { kind: 'path', fill: '#B89A5A', d: 'M -2.6 -1 C -0.8 -1.4 1.2 -1.4 2.8 -0.8 C 3.2 -0.2 3.1 0.5 2.6 1 C 0.8 1.4 -1.2 1.4 -2.8 0.8 C -3.2 0.2 -3 -0.4 -2.6 -1 Z' },
  ],
  // LECA — round clay-orange balls.
  leca: [
    { kind: 'path', fill: '#9A5A38', d: 'M -4.4 -0.8 C -4.4 -3 -2.4 -4.4 0 -4.4 C 2.6 -4.4 4.4 -2.6 4.4 -0.2 C 4.4 2.4 2.6 4.3 0 4.3 C -2.6 4.3 -4.4 2.2 -4.4 -0.8 Z' },
    { kind: 'path', fill: '#8A5030', d: 'M -4.8 -0.4 C -4.8 -2.6 -2.8 -4 -0.2 -4 C 2.4 -4 4.6 -2.4 4.6 0 C 4.6 2.6 2.4 4 -0.2 4 C -2.8 4 -4.8 2.2 -4.8 -0.4 Z' },
    { kind: 'path', fill: '#9A5A38', d: 'M -3.8 -0.6 C -3.8 -2.6 -2 -3.8 0 -3.8 C 2.2 -3.8 3.8 -2.2 3.8 0 C 3.8 2.2 2.2 3.8 0 3.8 C -2 3.8 -3.8 2.2 -3.8 -0.6 Z' },
  ],
};

/** Substrate component visual tiers — drive opacity, jitter, shadow and spacing. */
export type SubstrateTier = 'fine' | 'standard' | 'chunky';

/**
 * Per-instance render style for a scattered component, resolved from its tier.
 *
 *  - `opacity` — multiplied onto each mark; fine tiers blend, chunky reads solid.
 *  - `rotate` — whether to apply 0–360° rotation jitter (pointless for round
 *    primitives, essential for directional paths).
 *  - `shadow` — chunky structural pieces get a tight drop shadow to lift them off
 *    the dirt matrix.
 *  - `minDist` — minimum centre-to-centre spacing (px) enforced by dart-throwing,
 *    so same-component marks spread instead of clumping or snapping to a grid.
 *  - `density` — multiplier on the base mark count (sand wants many small grains).
 *  - `tint` — fine blend components (mud) paint a flat band tint instead of marks.
 */
export interface ComponentStyle {
  tier: SubstrateTier;
  opacity: number;
  rotate: boolean;
  shadow: boolean;
  minDist: number;
  density: number;
  tint?: string;
}

const TIER_OF: Record<string, SubstrateTier> = {
  'orchid-bark': 'chunky',
  leca: 'chunky',
  pumice: 'chunky',
  grit: 'chunky',
  perlite: 'standard',
  peat: 'standard',
  'worm-castings': 'standard',
  vermiculite: 'standard',
  sphagnum: 'standard',
  'coco-coir': 'standard',
  sand: 'fine',
  mud: 'fine',
  'potting-soil': 'fine',
};

/** Resolve the render style for a component id (defaults to standard if unknown). */
export function getComponentStyle(componentId: string): ComponentStyle {
  const tier = TIER_OF[componentId] ?? 'standard';
  if (componentId === 'mud') {
    return { tier, opacity: 0.5, rotate: false, shadow: false, minDist: 0, density: 0, tint: '#2E241B' };
  }
  if (tier === 'chunky') {
    return { tier, opacity: 1, rotate: true, shadow: true, minDist: 12, density: 0.8 };
  }
  if (tier === 'standard') {
    return { tier, opacity: 0.7, rotate: true, shadow: false, minDist: 7, density: 1 };
  }
  // fine — sand wants lots of tiny grains; potting-soil a gentle crumb stipple.
  return { tier, opacity: componentId === 'sand' ? 0.5 : 0.55, rotate: false, shadow: false, minDist: 3.5, density: componentId === 'sand' ? 2.6 : 1.2 };
}

/** SVG id for the always-on soil stipple pattern. */
export const SOIL_STIPPLE_PATTERN_ID = 'xs-soil-stipple';

/** Tight drop shadow that lifts chunky structural marks off the dirt matrix. */
export const SUBSTRATE_SHADOW_FILTER_ID = 'xs-substrate-shadow';

/** Horizontal ambient-occlusion gradient — darkens where soil meets the glass walls. */
export const AO_GRADIENT_ID = 'xs-ao-sides';

/** Vertical moisture gradient — soil reads damper / darker toward the bottom. */
export const MOISTURE_GRADIENT_ID = 'xs-moisture';

/** Returns the authored marks for a component id, or `undefined` for unknowns. */
export function getComponentMarks(componentId: string): readonly Mark[] | undefined {
  return COMPONENT_MARKS[componentId];
}

/** Render one tile's worth of marks (shared by the stipple + every component). */
function renderMarks(marks: Mark[], keyPrefix: string) {
  return marks.map((m, i) => {
    const key = `${keyPrefix}-${i}`;
    if (m.kind === 'circle') {
      return <Circle key={key} cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} opacity={m.opacity} />;
    }
    if (m.kind === 'rect') {
      return <Rect key={key} x={m.x} y={m.y} width={m.w} height={m.h} fill={m.fill} rx={m.rx} opacity={m.opacity} />;
    }
    if (m.kind === 'path') {
      return (
        <Path
          key={key}
          d={m.d}
          fill={m.fill ?? 'none'}
          stroke={m.stroke}
          strokeWidth={m.strokeWidth}
          strokeLinecap="round"
          opacity={m.opacity}
        />
      );
    }
    return (
      <Line key={key} x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={m.stroke} strokeWidth={m.width} strokeLinecap="round" opacity={m.opacity} />
    );
  });
}

/**
 * Renders the shared substrate `<Defs>`: the always-on soil stipple `<Pattern>`, the
 * chunky-mark drop-shadow `<Filter>`, and the two environmental `<LinearGradient>`s
 * (side ambient occlusion + bottom moisture). Component overlays are scattered
 * individual marks (see `cross-section.tsx`), so no per-component patterns live here.
 *
 * The gradients use `objectBoundingBox` units (0–1), so each maps onto whatever rect
 * references it — the AO rect spanning the full interior, the moisture rect the
 * substrate band.
 */
export function SubstratePatternDefs() {
  return (
    <>
      <Pattern id={SOIL_STIPPLE_PATTERN_ID} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
        {renderMarks(SOIL_STIPPLE_MARKS, 'stipple')}
      </Pattern>

      <Filter id={SUBSTRATE_SHADOW_FILTER_ID}>
        <FeDropShadow dx={0.5} dy={1} stdDeviation={0.8} floodColor="#1a1108" floodOpacity={0.4} />
      </Filter>

      {/* Side ambient occlusion — dark at both glass walls, clear through the middle. */}
      <LinearGradient id={AO_GRADIENT_ID} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.15} />
        <Stop offset="0.05" stopColor="#000000" stopOpacity={0} />
        <Stop offset="0.95" stopColor="#000000" stopOpacity={0} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0.15} />
      </LinearGradient>

      {/* Moisture grounding — damp/dark at the band's bottom, fading up to dry. */}
      <LinearGradient id={MOISTURE_GRADIENT_ID} gradientUnits="objectBoundingBox" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#140d06" stopOpacity={0.25} />
        <Stop offset="1" stopColor="#140d06" stopOpacity={0} />
      </LinearGradient>
    </>
  );
}
