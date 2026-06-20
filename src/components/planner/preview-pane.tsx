/**
 * The planner's preview pieces — rebuilt for the scroll-driven header.
 *
 * {@link DockedPreview} is the **view-only** cross-section that lives in the
 * planner's floating header. It is purely a glance: a Reanimated `scrollY` value
 * shrinks it from a full hero height down to a small docked strip in lockstep
 * with the page scroll, and it is `pointerEvents="none"` so a vertical drag is the
 * same scroll whether the finger is over it or over the step body. It never owns a
 * drag gesture — arranging is a separate surface entirely.
 *
 * {@link ArrangeOverlay} is that separate surface: a full-screen takeover, opened
 * by the header's "Arrange" button, where plants are dragged into position. It
 * covers the whole planner (nothing scrolls underneath) so there is zero gesture
 * conflict, and a "Done" button drops back to the scroll. Placements commit live
 * and the overlay stays open until Done — you arrange every plant in one sitting.
 *
 * The shrink is a **crossfade between two pre-rendered cross-sections** (one at
 * the full height, one at the docked height), bottom-anchored so the vessel base
 * stays put while the scene shrinks toward it. Rendering only two discrete sizes
 * keeps the heavy SVG scene off the per-frame path — only height + opacity animate
 * on the UI thread, never a re-layout of the scene itself.
 */
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TerrariumCrossSection } from '@/components/planner/cross-section';
import type { PlannerDraft } from '@/components/planner/draft';
import { haptics, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import type { Placement } from '@/logic/placement';
import type { Plant } from '@/types';

/** Where the full hero ends and the docked glance begins (opacity crossfade points). */
const FADE_OUT_END = 0.55; // fraction of `range` over which the hero fades out
const FADE_IN_START = 0.45; // fraction of `range` at which the glance starts in

export interface DockedPreviewProps {
  draft: PlannerDraft;
  plants: readonly Plant[];
  /** Page scroll offset (px). Drives the shrink on the UI thread. */
  scrollY: SharedValue<number>;
  /** Hero height at rest (scrollY 0). */
  fullHeight: number;
  /** Locked height once scrolled past the collapse range. */
  dockedHeight: number;
  /** Scroll distance over which the shrink happens. */
  range: number;
}

/** No-op commit — the docked preview is view-only; dragging lives in the overlay. */
function noop() {}

export function DockedPreview({
  draft,
  plants,
  scrollY,
  fullHeight,
  dockedHeight,
  range,
}: DockedPreviewProps) {
  // The clip window shrinks 1:1 with scroll; the two scenes inside crossfade.
  const windowStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, range], [fullHeight, dockedHeight], Extrapolation.CLAMP),
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range * FADE_OUT_END], [1, 0], Extrapolation.CLAMP),
  }));
  const glanceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [range * FADE_IN_START, range], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.window, windowStyle]}>
      {/* Full hero — fades out as the window shrinks past it. */}
      <Animated.View style={[styles.layer, heroStyle]}>
        <TerrariumCrossSection
          draft={draft}
          plants={plants}
          draggableKind={null}
          onCommit={noop}
          height={fullHeight}
        />
      </Animated.View>
      {/* Docked glance — a complete small vessel, fades in as it locks. */}
      <Animated.View style={[styles.layer, glanceStyle]}>
        <TerrariumCrossSection
          draft={draft}
          plants={plants}
          draggableKind={null}
          onCommit={noop}
          height={dockedHeight}
        />
      </Animated.View>
    </Animated.View>
  );
}

export interface ArrangeOverlayProps {
  draft: PlannerDraft;
  plants: readonly Plant[];
  /** Commit a moved placement (parent runs `upsertPlacement`). Stays open after. */
  onCommit: (next: Placement) => void;
  /** Tap Done — return to the scroll. */
  onClose: () => void;
}

/** Estimated chrome above the arrange stage (title bar + hint) — sizes the canvas. */
const ARRANGE_CHROME_H = 96;

export function ArrangeOverlay({ draft, plants, onCommit, onClose }: ArrangeOverlayProps) {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  // The canvas fills what's left after the safe insets and the overlay's own chrome.
  const stageH = Math.max(280, winH - insets.top - insets.bottom - ARRANGE_CHROME_H);

  function done() {
    haptics.select();
    onClose();
  }

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.background }]}>
      <View style={styles.overlayInner}>
        <View style={styles.arrangeBar}>
          <Text variant="subhead">Arrange plants</Text>
          <Pressable
            onPress={done}
            accessibilityRole="button"
            hitSlop={8}
            style={[styles.doneBtn, { backgroundColor: c.primary }]}>
            <Text variant="body" style={{ color: c.onPrimary, fontWeight: '600' }}>
              Done
            </Text>
          </Pressable>
        </View>
        <Text variant="caption" role="textMuted" style={styles.arrangeHint}>
          Drag a plant left or right to position it. Tap Done when you’re happy.
        </Text>
        <View style={styles.arrangeStage}>
          <TerrariumCrossSection
            draft={draft}
            plants={plants}
            draggableKind="plant"
            onCommit={onCommit}
            height={stageH}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Transparent clip window — the inner planes carry the card frame; bottom-anchored
  // so the height shrink reveals/hides from the top, keeping the vessel base put.
  window: { width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  overlay: { zIndex: 50, elevation: 50 },
  overlayInner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  arrangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  doneBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radii.pill },
  arrangeHint: { paddingBottom: Spacing.md },
  arrangeStage: { flex: 1, justifyContent: 'center' },
});
