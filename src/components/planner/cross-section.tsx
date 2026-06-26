/**
 * The **terrarium cross-section** — the planner's signature 2-D viewer. A side-on
 * render of the build that reads at a glance: the vessel's true shape and opening,
 * the drainage / charcoal / substrate **layer stack** at real depths, and every
 * plant as a true-scale **height bar** with an emoji cap and a **root-depth band**.
 *
 * It replaces the old top-down sprite plane (`preview.tsx`, kept dormant for the
 * future 3-D view — ADR 0004). Placement data is unchanged: a plant's `x` still
 * positions it horizontally (drag below), while `y`/`scale` are ignored here — the
 * cross-section derives vertical position from the substrate surface and real cm.
 *
 * ## How it's drawn
 *
 *  - **Shape** comes from a {@link getContainerProfile} (`container-profiles.ts`),
 *    the extensibility seam — the renderer never branches on shape. Layers and
 *    plants are clipped to the profile's interior silhouette, so a rounded base
 *    clips fills for free.
 *  - **Vertical bands** (cm → px) come from the pure {@link containerProfile}
 *    (`logic/containers.ts`), which stacks drainage → charcoal → substrate and
 *    flags plant overflow above the rim.
 *  - **Substrate texture** is layered brown base → soil stipple → per-component
 *    pattern overlays at mix-proportional opacity (`cross-section-patterns.tsx`).
 *  - **Progressive reveal:** with no container dimensions yet, only a dashed
 *    placeholder + nudge is shown; each layer appears as its data arrives.
 *
 * ## Interaction
 *
 * Horizontal drag (active step only) slides a plant along its `x`; a guide
 * line tracks the finger and the placement commits on release. Overflowing plants
 * get a ⚠️ cap badge that taps to explain. SVG nodes aren't touch targets, so drag
 * handles and badges are thin RN overlays positioned over the canvas.
 */
import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { Text } from '@/components/ui';
import { Motion, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { usePreferences } from '@/hooks/use-preferences';
import { lengthUnit, lengthValue } from '@/logic/units';
import {
  containerProfile,
  type Dimensions,
} from '@/logic/containers';
import { clamp01, type Placement } from '@/logic/placement';
import { ampFor, rand, waveOffset } from '@/logic/substrate-wave';
import type { ContainerOpening, ContainerShape, Plant } from '@/types';

import {
  getContainerProfile,
  type ContainerShapeProfile,
  type Rect as GeomRect,
} from './container-profiles';
import {
  AO_GRADIENT_ID,
  MOISTURE_GRADIENT_ID,
  SOIL_BASE_FILL,
  SOIL_STIPPLE_PATTERN_ID,
  SPECULAR_GRADIENT_ID,
  SUBSTRATE_SHADOW_FILTER_ID,
  SubstratePatternDefs,
  getComponentMarks,
  getComponentStyle,
  type ComponentStyle,
  type Mark,
} from './cross-section-patterns';
import type { PlannerDraft } from './draft';

export type DraggableKind = 'plant' | null;

export interface TerrariumCrossSectionProps {
  draft: PlannerDraft;
  /** Resolved plant records for the selected slugs (labels + heights + roots). */
  plants: readonly Plant[];
  /** Which item category the active step lets you slide left/right (`null` = view-only). */
  draggableKind: DraggableKind;
  /** Commit a moved placement (parent runs `upsertPlacement`). */
  onCommit: (next: Placement) => void;
  height?: number;
  /** Multiplier for all rotated (vertical) text labels. Default 1. */
  textScale?: number;
}

// --- Canvas padding (px) ----------------------------------------------------
const PAD_X = 28; // side breathing room (also clears the rotated H dimension label)
const PAD_TOP = 30; // room for overflow stubs + ⚠️ badges above the rim
const PAD_BOTTOM = 28; // room beneath the floor (extra for width dimension line)
const OVERFLOW_STUB = 10; // dashed stub length above the rim for a too-tall plant
const LID_GAP = 5; // floating gap above the rim for a lidded container
const STEM_W = 3;
const LABEL_FONT_SIZE = 7; // px, plant name alongside the bar
/**
 * Floor (cm) for a dimension that is momentarily empty/0 while the owner edits the
 * field. We clamp to this instead of dropping the scene so the SVG never unmounts
 * mid-edit (which strands the interior clip — see the `clipId` note in `SceneSvg`).
 */
const MIN_DIM_CM = 3;

/** Stable integer seed derived from a component id string. */
function idSeed(id: string): number {
  let h = 0;
  // Math.imul keeps multiplication within 32-bit int range, avoiding the
  // float64 precision loss that makes (large_base + i*37) == large_base.
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Nudge a #rrggbb colour's lightness by a stable per-plant seed (±~12%, toward
 * white or black), so two same-type plants standing next to each other read as
 * distinct individuals rather than one cloned bar. The colour half of ADR 0012 §6.
 */
function tintSage(hexColor: string, seed: number): string {
  const j = (rand(seed) - 0.5) * 0.24; // ±12% toward white (j>0) or black (j<0)
  const target = j > 0 ? 255 : 0;
  const t = Math.abs(j);
  const ch = (i: number) => {
    const v = parseInt(hexColor.slice(i, i + 2), 16);
    return Math.round(v + (target - v) * t).toString(16).padStart(2, '0');
  };
  return `#${ch(1)}${ch(3)}${ch(5)}`;
}

/** Open polyline `d` through points — used for the substrate surface crust line. */
function polylinePath(pts: readonly [number, number][]): string {
  if (pts.length === 0) return '';
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d;
}

/** Max dart-throwing attempts before a mark is dropped to preserve spacing. */
const SCATTER_MAX_ATTEMPTS = 12;

// ponytail: visual calibration knob — px-per-cm at which a mark draws full size.
// Marks are physical grit, so they ride the vessel's cmToPx like the bands and
// roots do; below this the view is compacted (docked glance / large vessel) and
// marks shrink with it. Capped at 1 so the normal full view is untouched.
const MARK_REF_CMTOPX = 12;
const MARK_MIN_SCALE = 0.45; // floor so a tiny vessel doesn't dissolve the grit

// --- Organic layer boundaries ----------------------------------------------
// The material seams (substrate surface, substrate/charcoal, charcoal/drainage)
// undulate instead of sitting dead-level. Each seam is an independent, seeded
// sum-of-sines wave so the layers interlock like hand-poured sediment. The floor
// stays flat — it's the glass base. Adjacent bands share the *same* seam wave, so
// they tessellate with no gap or overlap regardless of SVG draw order.
const WAVE_STEP = 6; // px sample spacing along a boundary
const WAVE_POKE = 0.15; // a scatter mark may cross a wavy seam by ≤15% of its radius

/** Sample a seam into [x, y] points spanning the vessel width (seeded → stable). */
function seamPoints(geom: GeomRect, baseY: number, amp: number, seed: number): [number, number][] {
  const pts: [number, number][] = [];
  const right = geom.x + geom.width;
  for (let x = geom.x; x < right; x += WAVE_STEP) pts.push([x, baseY + waveOffset(x, amp, seed)]);
  pts.push([right, baseY + waveOffset(right, amp, seed)]);
  return pts;
}

/** Closed band fill: wavy top edge, bottom edge either a wavy seam or a flat y. */
function bandPath(geom: GeomRect, top: [number, number][], bottom: [number, number][] | number): string {
  let d = `M ${top[0][0].toFixed(1)} ${top[0][1].toFixed(1)}`;
  for (let i = 1; i < top.length; i++) d += ` L ${top[i][0].toFixed(1)} ${top[i][1].toFixed(1)}`;
  if (typeof bottom === 'number') {
    d += ` L ${(geom.x + geom.width).toFixed(1)} ${bottom.toFixed(1)} L ${geom.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
  } else {
    for (let i = bottom.length - 1; i >= 0; i--) d += ` L ${bottom[i][0].toFixed(1)} ${bottom[i][1].toFixed(1)}`;
    d += ' Z';
  }
  return d;
}

/** Render one scattered mark in local space (centred on 0,0), placed by `transform`. */
function renderScatteredMark(mark: Mark, key: string, transform: string, opacity: number): React.ReactNode {
  if (mark.kind === 'circle') {
    return <Circle key={key} cx={0} cy={0} r={mark.r} fill={mark.fill} opacity={opacity} transform={transform} />;
  }
  if (mark.kind === 'rect') {
    return <Rect key={key} x={-mark.w / 2} y={-mark.h / 2} width={mark.w} height={mark.h} fill={mark.fill} rx={mark.rx} opacity={opacity} transform={transform} />;
  }
  if (mark.kind === 'path') {
    return (
      <Path
        key={key}
        d={mark.d}
        fill={mark.fill ?? 'none'}
        stroke={mark.stroke}
        strokeWidth={mark.strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
        transform={transform}
      />
    );
  }
  const dx = mark.x2 - mark.x1;
  const dy = mark.y2 - mark.y1;
  return <Line key={key} x1={0} y1={0} x2={dx} y2={dy} stroke={mark.stroke} strokeWidth={mark.width} strokeLinecap="round" opacity={opacity} transform={transform} />;
}

/**
 * Scatter individual marks for one substrate component across the substrate band.
 *
 * Density scales with band area × mix share × the tier's density multiplier. Each
 * placement is found by **dart-throwing**: a seeded candidate is rejected if it lands
 * within `style.minDist` of an already-placed mark, retried up to
 * {@link SCATTER_MAX_ATTEMPTS} times, then dropped — so same-component marks spread
 * out instead of clumping, without snapping to a grid (the seed keeps it stable).
 * Each placed mark gets per-instance scale (and, for directional marks, rotation)
 * jitter, so the field never reads as a stamped repeat. Chunky tiers are wrapped in a
 * drop-shadow group to lift them off the dirt. Inter-component overlap is intentional.
 */
function substrateComponentMarks(
  id: string,
  marks: readonly Mark[],
  geom: GeomRect,
  surfaceY: number,
  bottomY: number,
  style: ComponentStyle,
  parts: number,
  /** Vessel px-per-cm; marks shrink with it so a compacted view shrinks the grit. */
  cmToPx: number,
  /** Wavy top/bottom seam y at x; a mark may cross by ≤ {@link WAVE_POKE} of its radius. */
  seamTop?: (x: number) => number,
  seamBottom?: (x: number) => number,
): React.ReactNode {
  const bandH = bottomY - surfaceY;
  if (bandH <= 2) return null;

  // Mud (and any future fine-blend tint) paints a flat band wash, not scattered marks.
  if (style.tint) {
    return <Rect key={`${id}-tint`} x={geom.x} y={surfaceY} width={geom.width} height={bandH} fill={style.tint} opacity={style.opacity} />;
  }
  if (marks.length === 0) return null;

  const baseCount = Math.min(40, Math.max(4, Math.round((geom.width * bandH) / 80)));
  const count = Math.min(220, Math.round(baseCount * Math.max(1, parts) * style.density));
  const base = idSeed(id);
  const minDist2 = style.minDist * style.minDist;
  const clear = style.minDist * 0.5 * (1 - WAVE_POKE); // keep most of a mark inside the seam
  // Shrink grit when the vessel is drawn small (docked glance / large container);
  // never enlarge it past the full-view design size.
  const viewScale = Math.max(MARK_MIN_SCALE, Math.min(1, cmToPx / MARK_REF_CMTOPX));
  const placed: { x: number; y: number }[] = [];
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    let mx = 0;
    let my = 0;
    let ok = false;
    for (let a = 0; a < SCATTER_MAX_ATTEMPTS; a++) {
      const s = base + i * 97 + a * 1009;
      const cx = geom.x + rand(s) * geom.width;
      const cy = surfaceY + rand(s + 11) * bandH;
      // Reject anything that would float as a sliced disc past a wavy seam (the
      // band clip is the hard backstop; this just stops ugly half-marks at the edge).
      if (seamTop && cy - clear < seamTop(cx)) continue;
      if (seamBottom && cy + clear > seamBottom(cx)) continue;
      let collides = false;
      for (let p = 0; p < placed.length; p++) {
        const ddx = placed[p].x - cx;
        const ddy = placed[p].y - cy;
        if (ddx * ddx + ddy * ddy < minDist2) {
          collides = true;
          break;
        }
      }
      if (!collides) {
        mx = cx;
        my = cy;
        ok = true;
        break;
      }
    }
    if (!ok) continue; // dropped — keeps the field spaced rather than crammed
    placed.push({ x: mx, y: my });

    const mark = marks[i % marks.length];
    const eff = (mark.opacity ?? 1) * style.opacity;
    const sc = (0.8 + rand(base + i * 13 + 5) * 0.5) * viewScale; // 0.8–1.3, scaled to the view
    const rot = style.rotate ? Math.floor(rand(base + i * 7 + 3) * 360) : 0;
    const transform = `translate(${mx}, ${my}) rotate(${rot}) scale(${sc})`;
    nodes.push(renderScatteredMark(mark, `${id}-${i}`, transform, eff));
  }

  if (style.shadow) {
    return <G key={`${id}-marks`} filter={`url(#${SUBSTRATE_SHADOW_FILTER_ID})`}>{nodes}</G>;
  }
  return <G key={`${id}-marks`}>{nodes}</G>;
}

// --- Resolved render models (pure, computed from the draft) -----------------

interface LayerBands {
  /** y (px) of the floor, drainage top, charcoal top, substrate (planting) surface. */
  floorY: number;
  drainageTopY: number;
  charcoalTopY: number;
  surfaceY: number;
  hasDrainage: boolean;
  hasCharcoal: boolean;
  hasSubstrate: boolean;
}

interface PlantModel {
  slug: string;
  label: string; // plant common name, shown as vertical bar label
  emoji: string;
  xPx: number;
  capY: number; // y of the *typical*-height bar top (clamped to rim)
  ghostCapY: number | null; // y of the *max*-height ghost top; null when no headroom to show
  surfaceY: number;
  overflow: boolean; // typical height exceeds the vessel interior
  rootBottomY: number | null; // null = no root data
}

interface Scene {
  geom: GeomRect;
  profile: ContainerShapeProfile;
  opening: ContainerOpening | null;
  bands: LayerBands;
  plants: PlantModel[];
  activeMixIds: string[];
  cmToPx: number;
  widthCm: number;
  heightCm: number;
  containerShape: ContainerShape;
  /** Per-seam wave amplitudes (px), capped share of each seam's thinner band. */
  wave: { ampSurface: number; ampMid: number; ampLower: number };
  /** Per-mount random seam seeds — fresh contour each build, stable across re-renders. */
  seeds: { surface: number; mid: number; lower: number };
}

const PLANT_EMOJI = '🌿';

/** Resolve the full draggable-aware scene, or `null` until a container size exists. */
function buildScene(
  draft: PlannerDraft,
  plants: readonly Plant[],
  W: number,
  H: number,
  seedBase: number,
  textScale: number,
): Scene | null {
  const dims = draft.containerDimensions;
  const shape = draft.containerShape;
  if (!dims || !shape) return null;
  // A dimension can be momentarily empty/0 (→ NaN) while the field is being edited.
  // Floor it to MIN_DIM_CM rather than bailing to null: returning null here swaps the
  // scene for the placeholder, unmounting the SVG, and the remount strands the interior
  // clip at whatever width it next mounts with. Staying mounted lets the clip grow back.
  const rawHeightCm = Number(dims.height);
  const rawWidthCm = Number(shape === 'cylindrical' ? dims.diameter : dims.length);
  const heightCm = rawHeightCm > 0 ? rawHeightCm : MIN_DIM_CM;
  const widthCm = rawWidthCm > 0 ? rawWidthCm : MIN_DIM_CM;
  const safeDims: Dimensions =
    shape === 'cylindrical'
      ? { diameter: widthCm, height: heightCm }
      : { length: widthCm, width: dims.width, height: heightCm };

  const profile = getContainerProfile(shape);
  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  const tallestCm = plants.reduce((m, p) => Math.max(m, p.maxHeightCm), 0);

  const substrateCm = draft.substrateDepth ?? 0;
  const drainageCm = draft.drainageDepth ?? 0;
  const charcoalCm = draft.charcoalDepth ?? 0;
  const prof = containerProfile(shape, safeDims, substrateCm, drainageCm, tallestCm, charcoalCm);

  // Bottom pad must clear the width dimension label, whose font scales with
  // textScale. Its baseline sits DIM_GAP + 2 below the floor at DIM_FONT*textScale;
  // reserve that plus a descender margin (matches PAD_BOTTOM=28 at textScale 1).
  const padBottom = DIM_GAP + DIM_FONT * textScale + 8;

  // Fit the vessel into the drawing area, preserving aspect ratio, bottom-aligned.
  const availW = Math.max(1, W - 2 * PAD_X);
  const availH = Math.max(1, H - PAD_TOP - padBottom);
  const scale = Math.min(availW / widthCm, availH / heightCm);
  const cw = widthCm * scale;
  const ch = heightCm * scale;
  const cx0 = (W - cw) / 2;
  const floorY = H - padBottom;
  const cyTop = floorY - ch;
  const geom: GeomRect = { x: cx0, y: cyTop, width: cw, height: ch };

  const yOf = (hCm: number) => floorY - hCm * scale;

  const bands: LayerBands = {
    floorY,
    drainageTopY: yOf(prof.drainageTopCm),
    charcoalTopY: yOf(prof.charcoalTopCm),
    surfaceY: yOf(prof.substrateTopCm),
    hasDrainage: drainageCm > 0,
    hasCharcoal: charcoalCm > 0,
    hasSubstrate: substrateCm > 0,
  };

  // Seam wave amplitudes (px), each a capped share of its thinner adjacent band.
  const subH = bands.charcoalTopY - bands.surfaceY;
  const charH = bands.drainageTopY - bands.charcoalTopY;
  const drainH = bands.floorY - bands.drainageTopY;
  const wave = {
    ampSurface: ampFor(subH),
    ampMid: ampFor(Math.min(subH, charH)),
    ampLower: ampFor(Math.min(charH > 0 ? charH : subH, drainH)),
  };
  // Spaced so adjacent seams don't share waveOffset's internal rand() octaves.
  const seeds = { surface: seedBase + 1, mid: seedBase + 200, lower: seedBase + 400 };

  const surfaceCm = prof.substrateTopCm;
  const margin = 0.06; // keep a plant's centre off the glass

  const plantModels: PlantModel[] = [];
  for (const p of draft.placements) {
    const xPx = cx0 + Math.min(1 - margin, Math.max(margin, clamp01(p.x))) * cw;
    const plant = bySlug.get(p.slug);
    if (!plant) continue;
    // The solid bar shows the *typical* cultivation height (what a well-kept
    // specimen actually looks like); a faint ghost extends to the genetic max.
    // typicalHeightCm falls back to 70% of max when unauthored (see plant.ts).
    const typicalCm = plant.typicalHeightCm ?? plant.maxHeightCm * 0.7;
    const typicalTopCm = surfaceCm + typicalCm;
    const maxTopCm = surfaceCm + plant.maxHeightCm;
    // Overflow stays on the *flat mean* surface so a crest/trough never flips the
    // ⚠️ badge as the plant is nudged sideways. Only the visual anchor rides the wave.
    const overflow = typicalTopCm > prof.interiorHeightCm + 0.001;
    const wv = waveOffset(xPx, wave.ampSurface, seeds.surface);
    const surfaceY = bands.surfaceY + wv;
    const capY = yOf(Math.min(typicalTopCm, prof.interiorHeightCm)) + wv;
    const ghostCapY =
      maxTopCm > typicalTopCm + 0.001
        ? yOf(Math.min(maxTopCm, prof.interiorHeightCm)) + wv
        : null;
    const rootMax = plant.rootDepthMaxCm;
    const rootBottomY =
      rootMax != null && rootMax > 0
        ? Math.min(floorY, surfaceY + rootMax * scale)
        : null;
    plantModels.push({ slug: p.slug, label: plant.commonName, emoji: PLANT_EMOJI, xPx, capY, ghostCapY, surfaceY, overflow, rootBottomY });
  }

  // Mix component ids with positive parts (for the pattern overlays).
  const mix = draft.substrateMix ?? {};
  const activeMixIds = Object.keys(mix).filter((id) => (mix[id] ?? 0) > 0);

  return {
    geom,
    profile,
    opening: draft.containerOpening,
    bands,
    plants: plantModels,
    activeMixIds,
    cmToPx: scale,
    widthCm,
    heightCm,
    containerShape: shape,
    wave,
    seeds,
  };
}

export function TerrariumCrossSection({
  draft,
  plants,
  draggableKind,
  onCommit,
  height = 260,
  textScale = 1,
}: TerrariumCrossSectionProps) {
  const { c } = useTokens();
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  function onLayout(e: LayoutChangeEvent) {
    const { width } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }

  const ready = size.w > 0;
  // Random seam contour, generated once per mount and held stable so re-renders
  // (drag, field edits) don't make the layers ripple. New each time the viewer mounts.
  const seedBase = useRef(Math.floor(Math.random() * 1e5)).current;
  // Keep the last valid scene so the viewer never blanks during mid-edit
  // invalid states (empty field, shape switch before new dims are typed).
  const lastScene = useRef<Scene | null>(null);
  const scene = useMemo(() => {
    const s = ready ? buildScene(draft, plants, size.w, height, seedBase, textScale) : null;
    if (s !== null) lastScene.current = s;
    return lastScene.current;
  }, [ready, draft, plants, size.w, height, seedBase, textScale]);

  return (
    <View style={styles.wrap}>
      <View
        onLayout={onLayout}
        style={[styles.plane, { height, backgroundColor: c.surfaceSunken, borderColor: c.border }]}>
        {ready ? (
          scene ? (
            <SceneSvg
              scene={scene}
              w={size.w}
              h={height}
              c={c}
              activeMix={draft.substrateMix}
              textScale={textScale}
            />
          ) : (
            <PlaceholderSvg w={size.w} h={height} c={c} />
          )
        ) : null}

        {/* Progressive-reveal nudge while there's no vessel yet. */}
        {ready && !scene ? (
          <View style={styles.centerHint} pointerEvents="none">
            <Text variant="caption" role="textMuted" style={styles.hintText}>
              Set the container shape and size to preview your terrarium.
            </Text>
          </View>
        ) : null}

        {/* --- RN overlays over the SVG (drag handles) --- */}
        {scene && draggableKind
          ? scene.plants.map((it) => (
                <DragHandle
                  key={`drag-${it.slug}`}
                  slug={it.slug}
                  baseX={it.xPx}
                  capY={it.capY}
                  emoji={it.emoji}
                  left={scene.geom.x}
                  right={scene.geom.x + scene.geom.width}
                  planeH={height}
                  c={c}
                  onEnd={(xPx) => {
                    const nx = clamp01((xPx - scene.geom.x) / scene.geom.width);
                    const prev = draft.placements.find((q) => q.slug === it.slug);
                    onCommit({ slug: it.slug, x: nx, y: prev?.y ?? 0.6, scale: prev?.scale ?? 1 });
                  }}
                />
              ))
          : null}

      </View>
    </View>
  );
}

// --- The SVG scene ----------------------------------------------------------

const DIM_GAP = 12; // px gap between vessel rect and dimension lines
const DIM_TICK = 4; // half-length of tick marks
const DIM_FONT = 10; // px font size for dimension labels

function DimensionLines({
  geom,
  widthCm,
  heightCm,
  containerShape,
  c,
  textScale = 1,
}: {
  geom: GeomRect;
  widthCm: number;
  heightCm: number;
  containerShape: ContainerShape;
  c: ReturnType<typeof useTokens>['c'];
  textScale?: number;
}) {
  const { units } = usePreferences();
  const u = lengthUnit(units);
  const { x, y, width, height } = geom;
  const hx = x - DIM_GAP; // x of the vertical height line
  const wy = y + height + DIM_GAP; // y of the horizontal width line
  const midY = y + height / 2;
  const midX = x + width / 2;
  const dimFont = DIM_FONT * textScale;

  return (
    <G>
      {/* Height line — vertical, left of vessel */}
      <Line x1={hx} y1={y} x2={hx} y2={y + height} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={hx - DIM_TICK} y1={y} x2={hx + DIM_TICK} y2={y} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={hx - DIM_TICK} y1={y + height} x2={hx + DIM_TICK} y2={y + height} stroke={c.textMuted} strokeWidth={1} />
      <SvgText
        x={hx - 6}
        y={midY}
        fontSize={dimFont}
        fill={c.textMuted}
        textAnchor="middle"
        transform={`rotate(-90, ${hx - 6}, ${midY})`}
      >
        {`H: ${lengthValue(heightCm, units)}${u}`}
      </SvgText>

      {/* Width line — horizontal, below vessel */}
      <Line x1={x} y1={wy} x2={x + width} y2={wy} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={x} y1={wy - DIM_TICK} x2={x} y2={wy + DIM_TICK} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={x + width} y1={wy - DIM_TICK} x2={x + width} y2={wy + DIM_TICK} stroke={c.textMuted} strokeWidth={1} />
      <SvgText x={midX} y={wy + dimFont + 2} fontSize={dimFont} fill={c.textMuted} textAnchor="middle">
        {`${containerShape === 'cylindrical' ? 'D' : 'W'}: ${lengthValue(widthCm, units)}${u}`}
      </SvgText>
    </G>
  );
}

function SceneSvg({
  scene,
  w,
  h,
  c,
  activeMix,
  textScale = 1,
}: {
  scene: Scene;
  w: number;
  h: number;
  c: ReturnType<typeof useTokens>['c'];
  activeMix: PlannerDraft['substrateMix'];
  textScale?: number;
}) {
  const { geom, profile, bands, opening } = scene;
  // Geometry-keyed clip id. react-native-svg caches a <ClipPath> by its id and does
  // not re-apply the clip region when only the child <Path d> changes on an
  // already-mounted node. After the scene briefly collapses to null (e.g. the width
  // is edited down to 0, which makes buildScene return null) it remounts at a tiny
  // width; growing the container then leaves every interior fill pinned to the stale,
  // narrow clip while the un-clipped walls stretch correctly. Encoding the vessel box
  // in the id points the reference at a fresh def on each resize, so the clip tracks it.
  // The shape is folded in too: switching rectangular↔cylindrical at the same box keeps
  // the same interior <Path d> mounted but a different silhouette, so without the shape
  // the stale clip leaves square corners poking past a rounded wall (and vice-versa).
  const clipId = `xs-interior-${scene.containerShape}-${Math.round(geom.x)}-${Math.round(geom.y)}-${Math.round(geom.width)}-${Math.round(geom.height)}`;
  const rimW = geom.width * profile.rimWidthFrac;
  const rimX0 = geom.x + (geom.width - rimW) / 2;

  // Per-plant lightness nudge off the themed sage so same-type neighbours differ.
  const tintOf = (slug: string) => tintSage(c.sage, idSeed(slug));

  const mix = activeMix ?? {};

  // Wavy material seams. Adjacent bands share a seam's point array, so they tile
  // with no gap/overlap; the floor stays flat. A seam's y-fn is reused to keep
  // scatter marks from floating as sliced discs past the organic edge.
  const { ampSurface, ampMid, ampLower } = scene.wave;
  const { surface: seedSurface, mid: seedMid, lower: seedLower } = scene.seeds;
  const surfacePts = bands.hasSubstrate ? seamPoints(geom, bands.surfaceY, ampSurface, seedSurface) : null;
  const midPts = bands.hasCharcoal ? seamPoints(geom, bands.charcoalTopY, ampMid, seedMid) : null;
  const lowerPts = bands.hasDrainage ? seamPoints(geom, bands.drainageTopY, ampLower, seedLower) : null;
  const lowerSeamY = (x: number) => bands.drainageTopY + waveOffset(x, ampLower, seedLower);
  // The substrate's bottom is whatever layer sits directly beneath it.
  const subBottomPts = midPts ?? lowerPts;
  const subBottomSeamY = midPts
    ? (x: number) => bands.charcoalTopY + waveOffset(x, ampMid, seedMid)
    : lowerPts
      ? lowerSeamY
      : undefined;
  const subBottomAmp = midPts ? ampMid : lowerPts ? ampLower : 0;
  // Texture envelope: overshoot the flat seams by each seam's amplitude so the wavy
  // crests/troughs fill with stipple+marks instead of bare base. The band clip
  // (subClipId) trims the overshoot back to the exact wavy edge — no slivers.
  const texTop = bands.surfaceY - ampSurface;
  const texBottom = bands.charcoalTopY + subBottomAmp;
  const substrateD = surfacePts ? bandPath(geom, surfacePts, subBottomPts ?? bands.floorY) : null;
  const charcoalD = midPts ? bandPath(geom, midPts, lowerPts ?? bands.floorY) : null;
  const drainageD = lowerPts ? bandPath(geom, lowerPts, bands.floorY) : null;
  // Seam-keyed ids. clipId only encodes the vessel box, so changing a *layer depth*
  // (not the vessel) leaves these band paths reshaping under a stale cached <ClipPath>
  // — react-native-svg won't re-apply a clip when only the child <Path d> changes
  // (same gotcha as clipId above). Fold the seam y's in so a moved seam = fresh id.
  const seamKey = `${Math.round(bands.surfaceY)}-${Math.round(bands.charcoalTopY)}-${Math.round(bands.drainageTopY)}`;
  const subClipId = `${clipId}-sub-${seamKey}`;
  const drainClipId = `${clipId}-drain-${seamKey}`;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={profile.interiorClipPath(geom)} />
        </ClipPath>
        {substrateD ? (
          <ClipPath id={subClipId}>
            <Path d={substrateD} />
          </ClipPath>
        ) : null}
        {drainageD ? (
          <ClipPath id={drainClipId}>
            <Path d={drainageD} />
          </ClipPath>
        ) : null}
        <SubstratePatternDefs />
      </Defs>

      {/* Layer fills, clipped to the vessel interior (rounded base clips for free). */}
      <G clipPath={`url(#${clipId})`}>
        {/* Drainage — pebble scatter on a cool grey bed. */}
        {drainageD ? (
          <>
            <Path d={drainageD} fill="#8C8F8A" />
            <G clipPath={`url(#${drainClipId})`}>{drainagePebbles(geom, bands, lowerSeamY)}</G>
          </>
        ) : null}

        {/* Charcoal — thin near-black filtration band. */}
        {charcoalD ? <Path d={charcoalD} fill="#262320" /> : null}

        {/* Substrate — brown base → soil stipple → scattered mix marks → moisture. */}
        {substrateD ? (
          <>
            <Path d={substrateD} fill={SOIL_BASE_FILL} />
            <G clipPath={`url(#${subClipId})`}>
              <Rect x={geom.x} y={texTop} width={geom.width} height={texBottom - texTop} fill={`url(#${SOIL_STIPPLE_PATTERN_ID})`} />
              {scene.activeMixIds.map((id) => {
                const marks = getComponentMarks(id);
                if (!marks) return null;
                const parts = Math.max(1, mix[id] ?? 1);
                return substrateComponentMarks(
                  id,
                  marks ?? [],
                  geom,
                  texTop,
                  texBottom,
                  getComponentStyle(id),
                  parts,
                  scene.cmToPx,
                  (x) => bands.surfaceY + waveOffset(x, ampSurface, seedSurface),
                  subBottomSeamY,
                );
              })}
              {/* Moisture grounding — soil reads damper toward the band's bottom. */}
              <Rect
                x={geom.x}
                y={texTop}
                width={geom.width}
                height={texBottom - texTop}
                fill={`url(#${MOISTURE_GRADIENT_ID})`}
              />
            </G>
          </>
        ) : null}

        {/* Surface crust — a thin damp leaf-litter line riding the substrate seam,
            so the soil reads as planted rather than poured. Reuses the surface wave. */}
        {surfacePts ? (
          <Path d={polylinePath(surfacePts)} fill="none" stroke="#3A2A1A" strokeWidth={1.5} strokeOpacity={0.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}

        {/* Ambient occlusion — light loss where every layer meets the glass walls. */}
        <Rect x={geom.x} y={geom.y} width={geom.width} height={geom.height} fill={`url(#${AO_GRADIENT_ID})`} />

        {/* Glass sheen — soft diagonal highlight across the upper glass (AO's bright twin). */}
        <Rect x={geom.x} y={geom.y} width={geom.width} height={geom.height} fill={`url(#${SPECULAR_GRADIENT_ID})`} />

        {/* Condensation — faint droplets fogging the upper glass of a closed build. */}
        {opening === 'sealed' || opening === 'lidded' ? condensation(geom, bands) : null}

        {/* Root-depth bands sit under the surface, inside the substrate/drainage. */}
        {scene.plants.map((p) =>
          p.rootBottomY != null ? (
            <Rect
              key={`root-${p.slug}`}
              x={p.xPx - rootBandW(geom) / 2}
              y={p.surfaceY}
              width={rootBandW(geom)}
              height={Math.max(0, p.rootBottomY - p.surfaceY)}
              fill={tintOf(p.slug)}
              opacity={0.22}
            />
          ) : null,
        )}
        {scene.plants.map((p) =>
          p.rootBottomY != null ? (
            <Line key={`rootedge-${p.slug}`} x1={p.xPx - rootBandW(geom) / 2} y1={p.rootBottomY} x2={p.xPx + rootBandW(geom) / 2} y2={p.rootBottomY} stroke={tintOf(p.slug)} strokeWidth={1.5} opacity={0.6} />
          ) : null,
        )}
      </G>

      {/* Plants — stem + overflow stub + upward name label beside the bar. */}
      {scene.plants.map((p) => {
        const interiorMidX = geom.x + geom.width / 2;
        const labelOnRight = p.xPx < interiorMidX;
        // For rotate(-90) with textAnchor="start": the right edge of the text
        // column lands at labelX, so offset right-side labels by fontSize to
        // keep the column clear of the bar.
        const labelFontSize = LABEL_FONT_SIZE * textScale;
        const labelX = labelOnRight
          ? p.xPx + STEM_W / 2 + labelFontSize + 2
          : p.xPx - STEM_W / 2 - 2;
        const tint = tintOf(p.slug);
        return (
          <G key={`plant-${p.slug}`}>
            {/* Ghost — faint bar to the genetic max height, with a dashed cap, behind
                the solid typical-height bar (the exposed segment = typical→max headroom). */}
            {p.ghostCapY != null ? (
              <>
                <Rect x={p.xPx - STEM_W / 2} y={p.ghostCapY} width={STEM_W} height={Math.max(0, p.surfaceY - p.ghostCapY)} rx={STEM_W / 2} fill={tint} opacity={0.3} />
                <Line x1={p.xPx - STEM_W} y1={p.ghostCapY} x2={p.xPx + STEM_W} y2={p.ghostCapY} stroke={tint} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
              </>
            ) : null}
            <Rect x={p.xPx - STEM_W / 2} y={p.capY} width={STEM_W} height={Math.max(0, p.surfaceY - p.capY)} rx={STEM_W / 2} fill={tint} />
            {p.overflow ? (
              <>
                <Line x1={p.xPx} y1={geom.y} x2={p.xPx} y2={geom.y - OVERFLOW_STUB} stroke={c.accent} strokeWidth={STEM_W} strokeDasharray="3 3" strokeLinecap="round" />
                <Circle cx={p.xPx} cy={geom.y - OVERFLOW_STUB - 6} r={5} fill={c.accent} />
                <SvgText x={p.xPx} y={geom.y - OVERFLOW_STUB - 3} fontSize={8} fill={c.surfaceSunken} textAnchor="middle" fontWeight="bold">!</SvgText>
              </>
            ) : null}
            <SvgText
              x={labelX}
              y={p.surfaceY - 2}
              fontSize={labelFontSize}
              fill={c.textMuted}
              textAnchor="start"
              transform={`rotate(-90, ${labelX}, ${p.surfaceY - 2})`}
            >
              {p.label}
            </SvgText>
          </G>
        );
      })}

      {/* Walls (open at the top) — then the opening-specific top edge. */}
      <Path d={profile.wallPath(geom)} fill="none" stroke={c.text} strokeOpacity={0.5} strokeWidth={2.5} strokeLinejoin="round" />
      {opening === 'sealed' ? (
        <Line x1={geom.x} y1={geom.y} x2={geom.x + geom.width} y2={geom.y} stroke={c.text} strokeOpacity={0.5} strokeWidth={2.5} strokeLinecap="round" />
      ) : null}
      {opening === 'lidded' ? (
        <Line x1={rimX0 - 3} y1={geom.y - LID_GAP} x2={rimX0 + rimW + 3} y2={geom.y - LID_GAP} stroke={c.text} strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
      ) : null}

      <DimensionLines geom={geom} widthCm={scene.widthCm} heightCm={scene.heightCm} containerShape={scene.containerShape} c={c} textScale={textScale} />
    </Svg>
  );
}

/** Root-band width scales gently with the vessel, clamped to a legible range. */
function rootBandW(geom: GeomRect): number {
  return Math.min(28, Math.max(10, geom.width * 0.12));
}

/** Scatter a stable set of pebble circles through the drainage band. */
function drainagePebbles(geom: GeomRect, bands: LayerBands, seamTop?: (x: number) => number) {
  const top = bands.drainageTopY;
  const bottom = bands.floorY;
  const bandH = bottom - top;
  if (bandH <= 1) return null;
  const cols = Math.max(3, Math.round(geom.width / 14));
  const rows = Math.max(1, Math.round(bandH / 12));
  const tones = ['#A7A9A3', '#B7B9B2', '#979A94', '#C2C4BD'];
  const nodes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const seed = r * 31 + col * 7 + 1;
      const jx = (rand(seed) - 0.5) * 8;
      const jy = (rand(seed + 100) - 0.5) * 6;
      const cx = geom.x + ((col + 0.5) / cols) * geom.width + jx;
      let cy = top + ((r + 0.5) / rows) * bandH + jy;
      const rad = 4.4 + rand(seed + 200) * 3.6;
      // Sink any pebble that would breach the wavy top so it reads as buried gravel.
      if (seamTop) cy = Math.max(cy, seamTop(cx) + rad * (1 - WAVE_POKE));
      nodes.push(<Circle key={`peb-${seed}`} cx={cx} cy={cy} r={rad} fill={tones[seed % tones.length]} />);
    }
  }
  return nodes;
}

/**
 * Faint condensation droplets fogging the upper glass of a closed terrarium — only
 * the air space above the substrate, biased toward the cooler top. Seeded so they
 * stay put across re-renders; clipped to the interior by the caller's `<G>`.
 */
function condensation(geom: GeomRect, bands: LayerBands): React.ReactNode {
  const top = geom.y;
  const airH = bands.surfaceY - top;
  if (airH <= 8) return null;
  const cols = Math.max(3, Math.round(geom.width / 22));
  const rows = Math.max(2, Math.round(airH / 36));
  const nodes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const seed = r * 53 + col * 17 + 7;
      const cx = geom.x + ((col + 0.5) / cols) * geom.width + (rand(seed) - 0.5) * 14;
      // Keep droplets in the upper ~70% of the air gap — glass fogs most up high.
      const cy = top + ((r + rand(seed + 3)) / rows) * airH * 0.7;
      const rad = 0.8 + rand(seed + 9) * 1.6;
      nodes.push(<Circle key={`cond-${seed}`} cx={cx} cy={cy} r={rad} fill="#FFFFFF" opacity={0.12 + rand(seed + 5) * 0.12} />);
    }
  }
  return nodes;
}

/** The empty-vessel placeholder — a soft dashed silhouette before dims exist. */
function PlaceholderSvg({ w, h, c }: { w: number; h: number; c: ReturnType<typeof useTokens>['c'] }) {
  const gw = Math.min(w - 2 * PAD_X, 160);
  const gh = h - PAD_TOP - PAD_BOTTOM;
  const geom: GeomRect = { x: (w - gw) / 2, y: PAD_TOP, width: gw, height: gh };
  return (
    <Svg width={w} height={h}>
      <Path
        d={getContainerProfile('rectangular').wallPath(geom)}
        fill="none"
        stroke={c.textMuted}
        strokeOpacity={0.4}
        strokeWidth={2}
        strokeDasharray="6 5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// --- RN overlays ------------------------------------------------------------

/**
 * Horizontal drag for one plant. A static, transparent touch column at the plant's
 * base x catches the gesture; while dragging, a **floating emoji chip** (the plant
 * "in hand") and a guide line track the finger on the UI thread. The plant's stem
 * stays put and redraws at the new x on release. SVG nodes can't take gestures,
 * hence this RN overlay.
 */
function DragHandle({
  baseX,
  capY,
  emoji,
  left,
  right,
  planeH,
  c,
  onEnd,
}: {
  slug: string;
  baseX: number;
  capY: number;
  emoji: string;
  left: number;
  right: number;
  planeH: number;
  c: ReturnType<typeof useTokens>['c'];
  onEnd: (xPx: number) => void;
}) {
  const tx = useSharedValue(baseX);
  const lifted = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      lifted.value = withSpring(1, Motion.snappy);
      tx.value = baseX;
    })
    .onChange((e) => {
      tx.value = Math.min(right, Math.max(left, baseX + e.translationX));
    })
    .onEnd(() => {
      lifted.value = withSpring(0, Motion.snappy);
      runOnJS(onEnd)(tx.value);
    });

  // Guide line + chip appear only while held (lifted 0→1); at rest the column is an
  // invisible hit target and the SVG cap is the affordance.
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: lifted.value * 0.6,
  }));
  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value - 18 }, { scale: 0.9 + lifted.value * 0.2 }],
    opacity: lifted.value,
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.dragLine, { height: planeH, backgroundColor: c.primary }, lineStyle]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.dragChip, { top: capY - 36, backgroundColor: c.surface, borderColor: c.primary }, chipStyle]}>
        <Text variant="title" style={styles.dragChipEmoji}>
          {emoji}
        </Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Slide to position"
          style={[styles.dragTouch, { left: baseX - 22, height: planeH }]}
        />
      </GestureDetector>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  plane: {
    width: '100%',
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  centerHint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  hintText: { textAlign: 'center', maxWidth: 240, lineHeight: 18 },
  dragLine: {
    position: 'absolute',
    top: 0,
    left: -1,
    width: 2,
    borderRadius: 1,
  },
  dragChip: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragChipEmoji: { lineHeight: 26 },
  dragTouch: {
    position: 'absolute',
    top: 0,
    width: 44,
    backgroundColor: 'transparent',
  },
});
