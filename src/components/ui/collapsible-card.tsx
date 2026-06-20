/**
 * A card whose body collapses to its header. The body animates between 0 and its
 * measured natural height, so the whole transition maps 1:1 to visible motion —
 * no dead zone.
 *
 * The body's content view is absolutely positioned, so its text always lays out at
 * its natural height no matter what the outer clip window is doing. Only the outer
 * `overflow: hidden` window animates its height. This matters on the New
 * Architecture (Fabric): text inside a view that is *itself* clipped to zero height
 * gets dropped and never restored — which blanked the chip labels (Shape, Opening)
 * after a collapse/expand cycle, since every open animation begins at height 0.
 * Pinning the content absolute keeps it out of that zero-height layout entirely.
 *
 * The only exception is the first frame of an initially-open card: until it has been
 * measured once, it renders in normal flow at natural height so there's no flash.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

import { Card } from './card';
import { haptics } from './haptics';
import { Text } from './text';

// Decelerating curve: full speed the instant the press registers, easing into
// rest. Both directions read as "responsive, then settling" rather than snapping.
const ANIM_MS = 300;
const EASE = Easing.out(Easing.cubic);

export interface CollapsibleCardProps {
  title: string;
  /** Short summary shown in the header row when collapsed. */
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  style?: ViewStyle;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  summary,
  isOpen,
  onToggle,
  style,
  children,
}: CollapsibleCardProps) {
  useTokens(); // ensure theme is available for Card

  // 0 → collapsed, 1 → open. One value drives both height and the chevron so they
  // stay in lockstep. Mutated only inside the effect below.
  const progress = useSharedValue(isOpen ? 1 : 0);
  // Natural body height, captured on layout (mutated only in onContentLayout) and
  // read only on the UI thread.
  const contentHeight = useSharedValue(0);

  // Flips true once the body first reports a height. Before that, an initially-open
  // card renders in normal flow at natural height (no first-frame flash); after it,
  // the body is always absolute and the outer window's height is animation-driven.
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, { duration: ANIM_MS, easing: EASE });
    // progress is a stable shared-value ref — mutated here, never a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Once measured, the outer window's height is driven entirely by the animation.
  const bodyStyle = useAnimatedStyle(() => ({
    height: progress.value * contentHeight.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));

  function onContentLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0) contentHeight.value = h;
    if (!measured) setMeasured(true);
  }

  // Before the first measurement: a closed card stays hidden (height 0, body
  // absolute), an open one shows at natural height (auto height, body in flow).
  const preMeasureStyle = isOpen ? styles.autoHeight : styles.collapsed;

  return (
    <Card style={style}>
      <Pressable
        onPress={() => { haptics.select(); onToggle(); }}
        accessibilityRole="button"
        accessibilityLabel={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
        accessibilityState={{ expanded: isOpen }}
        style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="overline" role="textMuted">{title}</Text>
          {!isOpen && summary ? (
            <Text variant="caption" role="textMuted" numberOfLines={1}>{summary}</Text>
          ) : null}
        </View>
        <Animated.View style={chevronStyle}>
          <Text variant="body" role="textMuted" style={styles.chevron}>›</Text>
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.overflow, measured ? bodyStyle : preMeasureStyle]}>
        <View
          onLayout={onContentLayout}
          style={[styles.body, measured || !isOpen ? styles.bodyAbsolute : null]}>
          {children}
        </View>
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  chevron: { fontSize: 18 },
  overflow: { overflow: 'hidden' },
  collapsed: { height: 0 },
  autoHeight: {},
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  // Absolutely positioned so the content (and its text) always lays out at its
  // natural height, never clipped to zero by the animating outer window.
  bodyAbsolute: { position: 'absolute', left: 0, right: 0, top: 0 },
});
