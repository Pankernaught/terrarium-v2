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
 * Horizontal drag (active step only) slides a plant/hardscape along its `x`; a guide
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
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { haptics, Text } from '@/components/ui';
import { Motion, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import {
  containerProfile,
  type Dimensions,
} from '@/logic/containers';
import {
  clamp01,
  hardscapeAssetId,
  isHardscapeSlug,
  type Placement,
} from '@/logic/placement';
import type { ContainerOpening, Plant } from '@/types';

import {
  getContainerProfile,
  type ContainerShapeProfile,
  type Rect as GeomRect,
} from './container-profiles';
import {
  SOIL_BASE_FILL,
  SOIL_STIPPLE_PATTERN_ID,
  SubstratePatternDefs,
  getComponentMarks,
  type Mark,
} from './cross-section-patterns';
import type { PlannerDraft } from './draft';
import { hardscapeAsset } from './hardscape-assets';

export type DraggableKind = 'plant' | 'hardscape' | null;

export interface TerrariumCrossSectionProps {
  draft: PlannerDraft;
  /** Resolved plant records for the selected slugs (labels + heights + roots). */
  plants: readonly Plant[];
  /** Which item category the active step lets you slide left/right (`null` = view-only). */
  draggableKind: DraggableKind;
  /** Commit a moved placement (parent runs `upsertPlacement`). */
  onCommit: (next: Placement) => void;
  height?: number;
}

// --- Canvas padding (px) ----------------------------------------------------
const PAD_X = 20; // side breathing room
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

/** Deterministic 0–1 hash so scatter is stable across renders. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

/** Stable integer seed derived from a component id string. */
function idSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = h * 31 + id.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Scatter individual marks for one substrate component across the substrate band.
 * Density scales with band area; opacity is already controlled by the caller
 * (proportional to mix share). The mark shapes/colours are the same visual
 * conventions as before — white specks = perlite, dark circles = peat, etc.
 */
function substrateComponentMarks(
  id: string,
  marks: readonly Mark[],
  geom: GeomRect,
  surfaceY: number,
  bottomY: number,
  opacity: number,
): React.ReactNode[] {
  const bandH = bottomY - surfaceY;
  if (bandH <= 2 || marks.length === 0) return [];
  const count = Math.min(60, Math.max(4, Math.round((geom.width * bandH) / 80)));
  const base = idSeed(id);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const mark = marks[i % marks.length];
    const s = base + i * 37;
    const mx = geom.x + rand(s) * geom.width;
    const my = surfaceY + rand(s + 11) * bandH;
    const eff = (mark.opacity ?? 1) * opacity;
    if (mark.kind === 'circle') {
      nodes.push(<Circle key={`${id}-${i}`} cx={mx} cy={my} r={mark.r} fill={mark.fill} opacity={eff} />);
    } else if (mark.kind === 'rect') {
      nodes.push(<Rect key={`${id}-${i}`} x={mx - mark.w / 2} y={my - mark.h / 2} width={mark.w} height={mark.h} fill={mark.fill} rx={mark.rx} opacity={eff} />);
    } else {
      const dx = mark.x2 - mark.x1;
      const dy = mark.y2 - mark.y1;
      nodes.push(<Line key={`${id}-${i}`} x1={mx} y1={my} x2={mx + dx} y2={my + dy} stroke={mark.stroke} strokeWidth={mark.width} strokeLinecap="round" opacity={eff} />);
    }
  }
  return nodes;
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
  capY: number; // y of the bar top (clamped to rim)
  surfaceY: number;
  overflow: boolean;
  rootBottomY: number | null; // null = no root data
}

interface HardscapeModel {
  slug: string;
  emoji: string;
  xPx: number;
  surfaceY: number;
  /** Where the drag chip floats — hardscape has no stem, so this is the surface. */
  capY: number;
}

interface Scene {
  geom: GeomRect;
  profile: ContainerShapeProfile;
  opening: ContainerOpening | null;
  bands: LayerBands;
  plants: PlantModel[];
  hardscape: HardscapeModel[];
  activeMixIds: string[];
  cmToPx: number;
  widthCm: number;
  heightCm: number;
}

const PLANT_EMOJI = '🌿';

/** Resolve the full draggable-aware scene, or `null` until a container size exists. */
function buildScene(
  draft: PlannerDraft,
  plants: readonly Plant[],
  W: number,
  H: number,
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

  // Fit the vessel into the drawing area, preserving aspect ratio, bottom-aligned.
  const availW = Math.max(1, W - 2 * PAD_X);
  const availH = Math.max(1, H - PAD_TOP - PAD_BOTTOM);
  const scale = Math.min(availW / widthCm, availH / heightCm);
  const cw = widthCm * scale;
  const ch = heightCm * scale;
  const cx0 = (W - cw) / 2;
  const floorY = H - PAD_BOTTOM;
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

  const surfaceCm = prof.substrateTopCm;
  const margin = 0.06; // keep a plant's centre off the glass

  const plantModels: PlantModel[] = [];
  const hardscapeModels: HardscapeModel[] = [];
  for (const p of draft.placements) {
    const xPx = cx0 + Math.min(1 - margin, Math.max(margin, clamp01(p.x))) * cw;
    if (isHardscapeSlug(p.slug)) {
      const asset = hardscapeAsset(hardscapeAssetId(p.slug));
      hardscapeModels.push({ slug: p.slug, emoji: asset?.emoji ?? '🪨', xPx, surfaceY: bands.surfaceY, capY: bands.surfaceY });
      continue;
    }
    const plant = bySlug.get(p.slug);
    if (!plant) continue;
    const topCm = surfaceCm + plant.maxHeightCm;
    const overflow = topCm > prof.interiorHeightCm + 0.001;
    const capY = yOf(Math.min(topCm, prof.interiorHeightCm));
    const rootMax = plant.rootDepthMaxCm;
    const rootBottomY =
      rootMax != null && rootMax > 0
        ? Math.min(floorY, bands.surfaceY + rootMax * scale)
        : null;
    plantModels.push({ slug: p.slug, label: plant.commonName, emoji: PLANT_EMOJI, xPx, capY, surfaceY: bands.surfaceY, overflow, rootBottomY });
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
    hardscape: hardscapeModels,
    activeMixIds,
    cmToPx: scale,
    widthCm,
    heightCm,
  };
}

export function TerrariumCrossSection({
  draft,
  plants,
  draggableKind,
  onCommit,
  height = 260,
}: TerrariumCrossSectionProps) {
  const { c } = useTokens();
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
  const [tooltipSlug, setTooltipSlug] = useState<string | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  }

  const ready = size.w > 0;
  // Keep the last valid scene so the viewer never blanks during mid-edit
  // invalid states (empty field, shape switch before new dims are typed).
  const lastScene = useRef<Scene | null>(null);
  const scene = useMemo(() => {
    const s = ready ? buildScene(draft, plants, size.w, height) : null;
    if (s !== null) lastScene.current = s;
    return lastScene.current;
  }, [ready, draft, plants, size.w, height]);

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
              draggingSlug={draggingSlug}
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

        {/* --- RN overlays over the SVG (drag handles, overflow badges) --- */}
        {scene
          ? scene.plants.map((p) =>
              p.overflow ? (
                <OverflowBadge
                  key={`warn-${p.slug}`}
                  x={p.xPx}
                  y={p.capY}
                  active={tooltipSlug === p.slug}
                  onPress={() => {
                    haptics.select();
                    setTooltipSlug((s) => (s === p.slug ? null : p.slug));
                  }}
                />
              ) : null,
            )
          : null}

        {scene && draggableKind
          ? [...scene.plants, ...scene.hardscape]
              .filter((it) => (draggableKind === 'hardscape' ? isHardscapeSlug(it.slug) : !isHardscapeSlug(it.slug)))
              .map((it) => (
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
                  onStart={() => setDraggingSlug(it.slug)}
                  onEnd={(xPx) => {
                    setDraggingSlug(null);
                    const nx = clamp01((xPx - scene.geom.x) / scene.geom.width);
                    const prev = draft.placements.find((q) => q.slug === it.slug);
                    onCommit({ slug: it.slug, x: nx, y: prev?.y ?? 0.6, scale: prev?.scale ?? 1 });
                  }}
                />
              ))
          : null}

        {/* Overflow tooltip — one at a time, dismiss by tapping the badge again. */}
        {tooltipSlug ? (
          <View style={[styles.tooltip, { backgroundColor: c.text }]} pointerEvents="none">
            <Text variant="caption" style={{ color: c.background }}>
              This plant’s max height may exceed the height of your container.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// --- The SVG scene ----------------------------------------------------------

const DIM_GAP = 12; // px gap between vessel rect and dimension lines
const DIM_TICK = 4; // half-length of tick marks
const DIM_FONT = 10; // px font size for dimension labels

function formatDim(cm: number): string {
  return cm === Math.round(cm) ? `${cm}` : cm.toFixed(1);
}

function DimensionLines({
  geom,
  widthCm,
  heightCm,
  c,
}: {
  geom: GeomRect;
  widthCm: number;
  heightCm: number;
  c: ReturnType<typeof useTokens>['c'];
}) {
  const { x, y, width, height } = geom;
  const hx = x - DIM_GAP; // x of the vertical height line
  const wy = y + height + DIM_GAP; // y of the horizontal width line
  const midY = y + height / 2;
  const midX = x + width / 2;

  return (
    <G>
      {/* Height line — vertical, left of vessel */}
      <Line x1={hx} y1={y} x2={hx} y2={y + height} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={hx - DIM_TICK} y1={y} x2={hx + DIM_TICK} y2={y} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={hx - DIM_TICK} y1={y + height} x2={hx + DIM_TICK} y2={y + height} stroke={c.textMuted} strokeWidth={1} />
      <SvgText
        x={hx}
        y={midY}
        fontSize={DIM_FONT}
        fill={c.textMuted}
        textAnchor="middle"
        transform={`rotate(-90, ${hx}, ${midY})`}
      >
        {`H: ${formatDim(heightCm)}cm`}
      </SvgText>

      {/* Width line — horizontal, below vessel */}
      <Line x1={x} y1={wy} x2={x + width} y2={wy} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={x} y1={wy - DIM_TICK} x2={x} y2={wy + DIM_TICK} stroke={c.textMuted} strokeWidth={1} />
      <Line x1={x + width} y1={wy - DIM_TICK} x2={x + width} y2={wy + DIM_TICK} stroke={c.textMuted} strokeWidth={1} />
      <SvgText x={midX} y={wy + DIM_FONT + 2} fontSize={DIM_FONT} fill={c.textMuted} textAnchor="middle">
        {`W: ${formatDim(widthCm)}cm`}
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
  draggingSlug,
}: {
  scene: Scene;
  w: number;
  h: number;
  c: ReturnType<typeof useTokens>['c'];
  activeMix: PlannerDraft['substrateMix'];
  draggingSlug: string | null;
}) {
  const { geom, profile, bands, opening } = scene;
  // Geometry-keyed clip id. react-native-svg caches a <ClipPath> by its id and does
  // not re-apply the clip region when only the child <Path d> changes on an
  // already-mounted node. After the scene briefly collapses to null (e.g. the width
  // is edited down to 0, which makes buildScene return null) it remounts at a tiny
  // width; growing the container then leaves every interior fill pinned to the stale,
  // narrow clip while the un-clipped walls stretch correctly. Encoding the vessel box
  // in the id points the reference at a fresh def on each resize, so the clip tracks it.
  const clipId = `xs-interior-${Math.round(geom.x)}-${Math.round(geom.y)}-${Math.round(geom.width)}-${Math.round(geom.height)}`;
  const rimW = geom.width * profile.rimWidthFrac;
  const rimX0 = geom.x + (geom.width - rimW) / 2;

  // Substrate mix → overlay opacity by share of total parts.
  const mix = activeMix ?? {};
  const totalParts = scene.activeMixIds.reduce((s, id) => s + (mix[id] ?? 0), 0) || 1;

  // The actively-dragged item's cap is carried by the floating RN drag chip, so the
  // SVG hides only that one cap (everything else, draggable or not, draws normally).
  const capInSvg = (slug: string) => draggingSlug !== slug;

  return (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={profile.interiorClipPath(geom)} />
        </ClipPath>
        <SubstratePatternDefs />
      </Defs>

      {/* Layer fills, clipped to the vessel interior (rounded base clips for free). */}
      <G clipPath={`url(#${clipId})`}>
        {/* Drainage — pebble scatter on a cool grey bed. */}
        {bands.hasDrainage ? (
          <>
            <Rect x={geom.x} y={bands.drainageTopY} width={geom.width} height={bands.floorY - bands.drainageTopY} fill="#8C8F8A" />
            {drainagePebbles(geom, bands)}
          </>
        ) : null}

        {/* Charcoal — thin near-black filtration band. */}
        {bands.hasCharcoal ? (
          <Rect x={geom.x} y={bands.charcoalTopY} width={geom.width} height={bands.drainageTopY - bands.charcoalTopY} fill="#262320" />
        ) : null}

        {/* Substrate — brown base → soil stipple → scattered mix marks. */}
        {bands.hasSubstrate ? (
          <>
            <Rect x={geom.x} y={bands.surfaceY} width={geom.width} height={bands.charcoalTopY - bands.surfaceY} fill={SOIL_BASE_FILL} />
            <Rect x={geom.x} y={bands.surfaceY} width={geom.width} height={bands.charcoalTopY - bands.surfaceY} fill={`url(#${SOIL_STIPPLE_PATTERN_ID})`} />
            {scene.activeMixIds.flatMap((id) => {
              const marks = getComponentMarks(id);
              if (!marks) return [];
              const opacity = Math.min(0.9, Math.max(0.25, (mix[id] ?? 0) / totalParts));
              return substrateComponentMarks(id, marks, geom, bands.surfaceY, bands.charcoalTopY, opacity);
            })}
          </>
        ) : null}

        {/* Root-depth bands sit under the surface, inside the substrate/drainage. */}
        {scene.plants.map((p) =>
          p.rootBottomY != null ? (
            <Rect
              key={`root-${p.slug}`}
              x={p.xPx - rootBandW(geom) / 2}
              y={p.surfaceY}
              width={rootBandW(geom)}
              height={Math.max(0, p.rootBottomY - p.surfaceY)}
              fill={c.sage}
              opacity={0.22}
            />
          ) : null,
        )}
        {scene.plants.map((p) =>
          p.rootBottomY != null ? (
            <Line key={`rootedge-${p.slug}`} x1={p.xPx - rootBandW(geom) / 2} y1={p.rootBottomY} x2={p.xPx + rootBandW(geom) / 2} y2={p.rootBottomY} stroke={c.sage} strokeWidth={1.5} opacity={0.6} />
          ) : null,
        )}
      </G>

      {/* Hardscape — an embedded mound + emoji on the surface. */}
      {scene.hardscape.map((hsItem) => (
        <G key={`hs-${hsItem.slug}`}>
          <Ellipse cx={hsItem.xPx} cy={hsItem.surfaceY} rx={16} ry={7} fill={SOIL_BASE_FILL} opacity={0.85} />
          {capInSvg(hsItem.slug) ? (
            <SvgText x={hsItem.xPx} y={hsItem.surfaceY - 4} fontSize={22} textAnchor="middle">
              {hsItem.emoji}
            </SvgText>
          ) : null}
        </G>
      ))}

      {/* Plants — stem + overflow stub + upward name label beside the bar. */}
      {scene.plants.map((p) => {
        const interiorMidX = geom.x + geom.width / 2;
        const labelOnRight = p.xPx < interiorMidX;
        // For rotate(-90) with textAnchor="start": the right edge of the text
        // column lands at labelX, so offset right-side labels by fontSize to
        // keep the column clear of the bar.
        const labelX = labelOnRight
          ? p.xPx + STEM_W / 2 + LABEL_FONT_SIZE + 2
          : p.xPx - STEM_W / 2 - 2;
        return (
          <G key={`plant-${p.slug}`}>
            <Rect x={p.xPx - STEM_W / 2} y={p.capY} width={STEM_W} height={Math.max(0, p.surfaceY - p.capY)} rx={STEM_W / 2} fill={c.sage} />
            {p.overflow ? (
              <Line x1={p.xPx} y1={geom.y} x2={p.xPx} y2={geom.y - OVERFLOW_STUB} stroke={c.sage} strokeWidth={STEM_W} strokeDasharray="3 3" strokeLinecap="round" />
            ) : null}
            <SvgText
              x={labelX}
              y={p.surfaceY - 2}
              fontSize={LABEL_FONT_SIZE}
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

      <DimensionLines geom={geom} widthCm={scene.widthCm} heightCm={scene.heightCm} c={c} />
    </Svg>
  );
}

/** Root-band width scales gently with the vessel, clamped to a legible range. */
function rootBandW(geom: GeomRect): number {
  return Math.min(28, Math.max(10, geom.width * 0.12));
}

/** Scatter a stable set of pebble circles through the drainage band. */
function drainagePebbles(geom: GeomRect, bands: LayerBands) {
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
      const cy = top + ((r + 0.5) / rows) * bandH + jy;
      const rad = 2.2 + rand(seed + 200) * 1.8;
      nodes.push(<Circle key={`peb-${seed}`} cx={cx} cy={cy} r={rad} fill={tones[seed % tones.length]} />);
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

/** A tappable ⚠️ badge floating at an overflowing plant's clipped cap. */
function OverflowBadge({ x, y, active, onPress }: { x: number; y: number; active: boolean; onPress: () => void }) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Plant may be too tall for the container"
      hitSlop={10}
      style={[
        styles.badge,
        { left: x + 6, top: y - 26, backgroundColor: c.surface, borderColor: active ? c.accent : c.border },
      ]}>
      <Text variant="caption">⚠️</Text>
    </Pressable>
  );
}

/**
 * Horizontal drag for one item. A static, transparent touch column at the item's
 * base x catches the gesture; while dragging, a **floating emoji chip** (the item
 * "in hand") and a guide line track the finger on the UI thread. The SVG hides that
 * item's cap meanwhile (so there's no double emoji) and redraws it at the new x on
 * release. SVG nodes can't take gestures, hence this RN overlay.
 */
function DragHandle({
  baseX,
  capY,
  emoji,
  left,
  right,
  planeH,
  c,
  onStart,
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
  onStart: () => void;
  onEnd: (xPx: number) => void;
}) {
  const tx = useSharedValue(baseX);
  const lifted = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      lifted.value = withSpring(1, Motion.snappy);
      tx.value = baseX;
      runOnJS(onStart)();
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
  badge: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tooltip: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.md,
    right: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radii.md,
  },
});
