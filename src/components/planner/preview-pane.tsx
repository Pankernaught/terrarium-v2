/**
 * The planner's **sticky preview pane** — the cross-section docked in the fixed
 * header so a change made deep in a long step (substrate, plants) is visible the
 * instant it's selected, with no scroll-back-up.
 *
 * Two heights: a {@link COLLAPSED_H} glance (read-only, no drag) and an
 * {@link EXPANDED_H} working view (drag enabled on the steps that allow it). A
 * chevron toggles between them — up = tap to expand, down = tap to collapse, in
 * lockstep with the height via a single `progress` shared value, the
 * {@link CollapsibleCard} idiom.
 *
 * **Height model.** The inner {@link TerrariumCrossSection} is rendered at the
 * *target* discrete height the instant the toggle flips, so its SVG scene
 * recomputes once (never per frame). The outer `overflow:hidden` window then
 * tweens its visible height over that already-resized plane, top-anchored: expand
 * reveals the substrate growing downward; collapse shrinks cleanly up to the
 * smaller, complete plane.
 *
 * **Tap surfaces.** When collapsed (or expanded with nothing draggable) a
 * full-area overlay toggles the pane. When expanded *and* a category is
 * draggable, that overlay is dropped so it can't swallow the cross-section's drag
 * gestures — the chevron remains the collapse control, alongside auto-collapse on
 * a committed placement.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { type DraggableKind, TerrariumCrossSection } from '@/components/planner/cross-section';
import type { PlannerDraft } from '@/components/planner/draft';
import { haptics, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import type { Placement } from '@/logic/placement';
import type { Plant } from '@/types';

/** Glance height — the whole terrarium, scaled to fit; read-only. */
const COLLAPSED_H = 180;
/** Working height — the original planner preview size; drag enabled. */
const EXPANDED_H = 260;
const ANIM_MS = 280;
const EASE = Easing.out(Easing.cubic);

export interface PlannerPreviewPaneProps {
  draft: PlannerDraft;
  plants: readonly Plant[];
  /** The category this step *would* let you drag — applied only when expanded. */
  draggableKind: DraggableKind;
  onCommit: (next: Placement) => void;
}

export function PlannerPreviewPane({ draft, plants, draggableKind, onCommit }: PlannerPreviewPaneProps) {
  const { c } = useTokens();
  const [expanded, setExpanded] = useState(false);

  // 0 → collapsed, 1 → expanded. One value drives both the window height and the
  // chevron so they stay in lockstep. Mutated only in the effect below.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, { duration: ANIM_MS, easing: EASE });
    // progress is a stable shared-value ref — mutated here, never a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const windowStyle = useAnimatedStyle(() => ({
    height: COLLAPSED_H + progress.value * (EXPANDED_H - COLLAPSED_H),
  }));
  // '›' points right at rest: -90° → up (expand), +90° → down (collapse).
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + progress.value * 180}deg` }],
  }));

  function toggle() {
    haptics.select();
    setExpanded((e) => !e);
  }

  // Drag lives on the expanded view only; collapsed is a read-only glance.
  const liveKind = expanded ? draggableKind : null;
  // Auto-collapse once a placement is committed so the full step body returns.
  function handleCommit(next: Placement) {
    onCommit(next);
    setExpanded(false);
  }

  // A full-area tap target is safe unless live drag handles are present — then it
  // would swallow the cross-section's gestures, so the chevron drives collapse.
  const showOverlayToggle = !(expanded && liveKind);

  return (
    <Animated.View style={[styles.window, windowStyle]}>
      <TerrariumCrossSection
        draft={draft}
        plants={plants}
        draggableKind={liveKind}
        onCommit={handleCommit}
        height={expanded ? EXPANDED_H : COLLAPSED_H}
      />

      {showOverlayToggle ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse preview' : 'Expand preview to arrange'}
          accessibilityState={{ expanded }}
        />
      ) : null}

      <Pressable
        style={[styles.chevron, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={toggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse preview' : 'Expand preview to arrange'}
        accessibilityState={{ expanded }}>
        <Animated.View style={chevronStyle}>
          <Text variant="body" role="textMuted" style={styles.chevronGlyph}>
            ›
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Transparent clip window — the inner plane carries the background, border and
  // radius; top-anchored so the height tween reveals/hides from the bottom.
  window: { width: '100%', overflow: 'hidden', justifyContent: 'flex-start' },
  chevron: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronGlyph: { fontSize: 18, lineHeight: 18 },
});
