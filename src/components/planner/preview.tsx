/*
 * KEPT FOR v2.1 3-D VIEW — do not delete.
 *
 * This sprite-plane renderer was the original planner preview. It was superseded by
 * the 2-D cross-section viewer (`cross-section.tsx`) in Phase 6, but it is retained
 * here as the foundation for the v2.1 top-down / 3-D display: placement data
 * (`x`, `y`, `scale`) is already authored in this coordinate space, and this
 * component's drag + pinch gestures carry forward unchanged. See ADR 0004.
 */
/* eslint-disable react-hooks/immutability -- Reanimated shared values (`.value`)
   are mutable by design; the React Compiler immutability rule doesn't model them.
   The mutations here are all inside worklets / an effect, exactly as intended. */
/**
 * The persistent 2-D front-view preview — the signature surface of the planner.
 * It renders every {@link Placement} as a sprite at its normalized `(x, y, scale)`
 * and, on the active step, makes that step's category draggable.
 *
 * **Drag-to-place:** the gesture runs entirely on the UI thread (Gesture Handler +
 * Reanimated) — transform/opacity only, so it holds 60fps. The sprite is glued to
 * the finger; a drop inside the plane commits via `upsertPlacement`
 * (`impactAsync(Light)` snap), a drop outside springs back with `motion.dragReturn`.
 * Pinch scales the sprite within the 0.4–1.4 band. Placements stay pure
 * `(x,y,scale)` data, so the v2.1 3-D display reflects them unchanged.
 */
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, Image } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MaskedView from '@react-native-masked-view/masked-view';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics, Text } from '@/components/ui';
import { Motion, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { clampScale, isInsidePlane, type Placement } from '@/logic/placement';
import type { Plant } from '@/types';

/** Base sprite footprint in px (before per-placement scale). */
const SPRITE = 52;

export type DraggableKind = 'plant' | null;

export interface PlannerPreviewProps {
  placements: readonly Placement[];
  /** Resolved plant records, for sprite labels (passed in, no DB round-trip). */
  plants: readonly Plant[];
  /** Which sprite category the active step may drag; `null` = read-only overview. */
  draggableKind: DraggableKind;
  /** Commit a moved/scaled placement back to the draft (parent does upsertPlacement). */
  onCommit: (next: Placement) => void;
  height?: number;
}

interface SpriteModel {
  placement: Placement;
  label: string;
  emoji: string;
  kind: 'plant';
}

/** Resolve each placement into a renderable sprite (label + emoji). */
function toSprites(placements: readonly Placement[], plants: readonly Plant[]): SpriteModel[] {
  const bySlug = new Map(plants.map((p) => [p.slug, p]));
  return placements.map((placement) => {
    const plant = bySlug.get(placement.slug);
    return { placement, label: plant?.commonName ?? placement.slug, emoji: '🌿', kind: 'plant' };
  });
}

export function PlannerPreview({
  placements,
  plants,
  draggableKind,
  onCommit,
  height = 220,
}: PlannerPreviewProps) {
  const { c } = useTokens();
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height: h } = e.nativeEvent.layout;
    setSize((prev) => (prev.w === width && prev.h === h ? prev : { w: width, h }));
  }

  const sprites = toSprites(placements, plants);
  const ready = size.w > 0 && size.h > 0;

  return (
    <View style={styles.wrap}>
      <View
        onLayout={onLayout}
        style={[styles.plane, { height, backgroundColor: c.surfaceSunken, borderColor: c.border }]}>
        {/* A soft ground line grounds the scene (front-view floor). */}
        <View style={[styles.ground, { backgroundColor: c.border }]} />

        {ready
          ? sprites.map((s) => (
              <DraggableSprite
                key={s.placement.slug}
                sprite={s}
                w={size.w}
                h={size.h}
                draggable={draggableKind === s.kind}
                onCommit={onCommit}
              />
            ))
          : null}

        {sprites.length === 0 ? (
          <View style={styles.emptyHint} pointerEvents="none">
            <Text variant="caption" role="textMuted" style={styles.emptyText}>
              {draggableKind === 'plant'
                ? 'Add plants below — each drops in here to drag into place.'
                : 'Your terrarium’s front view.'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// --- The draggable sprite (the gesture, on the UI thread) -------------------

interface DraggableSpriteProps {
  sprite: SpriteModel;
  w: number;
  h: number;
  draggable: boolean;
  onCommit: (next: Placement) => void;
}

function DraggableSprite({ sprite, w, h, draggable, onCommit }: DraggableSpriteProps) {
  const { c } = useTokens();
  const { placement } = sprite;

  // Normalized position + live scale as shared values — the gesture mutates these
  // on the UI thread; React state (the draft) is the source of truth that re-seeds
  // them when a placement changes externally (an add, a Back/Next, a fresh load).
  const px = useSharedValue(placement.x);
  const py = useSharedValue(placement.y);
  const liveScale = useSharedValue(placement.scale);
  const grab = useSharedValue(0); // 0→1 lift while held (a small pop + shadow)

  const startX = useSharedValue(placement.x);
  const startY = useSharedValue(placement.y);
  const startScale = useSharedValue(placement.scale);

  // w and h as shared values so the UI-thread worklets (useAnimatedStyle,
  // gesture .onChange) can read them without relying on JS-closure serialisation,
  // which the React Compiler can memoize away and leave stale.
  const sharedW = useSharedValue(w);
  const sharedH = useSharedValue(h);

  useEffect(() => {
    px.value = placement.x;
    py.value = placement.y;
    liveScale.value = placement.scale;
    // Shared-value refs are stable and mutated in worklets; not effect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement.x, placement.y, placement.scale]);

  useEffect(() => {
    sharedW.value = w;
    sharedH.value = h;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  function commit(next: Placement) {
    haptics.snap();
    onCommit(next);
  }

  const pan = Gesture.Pan()
    .enabled(draggable)
    .onStart(() => {
      grab.value = withSpring(1, Motion.snappy);
      startX.value = px.value;
      startY.value = py.value;
    })
    .onChange((e) => {
      // Glued to the finger — follow freely (no clamp), so a drop outside the
      // plane can spring back. translation is px; /w,/h normalizes to [0,1].
      px.value = startX.value + e.translationX / sharedW.value;
      py.value = startY.value + e.translationY / sharedH.value;
    })
    .onEnd(() => {
      grab.value = withSpring(0, Motion.snappy);
      const candidate: Placement = {
        slug: placement.slug,
        x: px.value,
        y: py.value,
        scale: liveScale.value,
      };
      if (isInsidePlane(candidate)) {
        runOnJS(commit)(candidate); // parent clamps via upsertPlacement
      } else {
        // Invalid drop — spring back to where the drag began (motion.dragReturn).
        px.value = withSpring(startX.value, Motion.dragReturn);
        py.value = withSpring(startY.value, Motion.dragReturn);
      }
    });

  const pinch = Gesture.Pinch()
    .enabled(draggable)
    .onStart(() => {
      startScale.value = liveScale.value;
    })
    .onChange((e) => {
      liveScale.value = clampScale(startScale.value * e.scale);
    })
    .onEnd(() => {
      runOnJS(onCommit)({
        slug: placement.slug,
        x: px.value,
        y: py.value,
        scale: liveScale.value,
      });
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: px.value * sharedW.value - SPRITE / 2 },
      { translateY: py.value * sharedH.value - SPRITE / 2 },
      { scale: liveScale.value * (1 + grab.value * 0.12) },
    ],
    // Lift opacity/shadow a touch while held.
    shadowOpacity: 0.1 + grab.value * 0.18,
    zIndex: grab.value > 0 ? 10 : 1,
  }));

  // One transformed Animated.View *is* both the visible sprite and (when
  // draggable) the gesture target — so the touch area tracks the sprite's
  // transformed position, not a fixed anchor.
  const badge = (
    <Animated.View
      accessibilityRole={draggable ? 'adjustable' : 'image'}
      accessibilityLabel={draggable ? `${sprite.label} — drag to place` : sprite.label}
      style={[
        styles.sprite,
        {
          backgroundColor: sprite.kind === 'plant' ? c.surface : c.background,
          borderColor: draggable ? c.primary : c.border,
        },
        animStyle,
      ]}>
      <Text variant="title" style={styles.spriteEmoji}>
        {sprite.emoji}
      </Text>
      <Text variant="overline" role="textMuted" numberOfLines={1} style={styles.spriteLabel}>
        {sprite.label}
      </Text>
    </Animated.View>
  );

  if (!draggable) return badge;
  return <GestureDetector gesture={gesture}>{badge}</GestureDetector>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  plane: {
    width: '100%',
    borderRadius: Radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '14%',
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  emptyHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyText: { textAlign: 'center', maxWidth: 260, lineHeight: 18 },
  sprite: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SPRITE,
    height: SPRITE,
    borderRadius: SPRITE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  spriteEmoji: { lineHeight: 26 },
  spriteLabel: { maxWidth: SPRITE - 6, fontSize: 8, marginTop: -2 },
});
