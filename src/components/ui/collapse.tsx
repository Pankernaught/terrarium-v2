/**
 * A header-less vertical collapse: animates `children` between their measured
 * natural height and zero, fading in lockstep. The sibling below slides up to
 * fill the freed space.
 *
 * Same New-Architecture (Fabric) caveat as {@link CollapsibleCard}: text inside a
 * view clipped to zero height gets dropped and never restored. So the content is
 * absolutely positioned once measured — it always lays out at its natural height,
 * and only the outer `overflow:hidden` window's height animates.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const ANIM_MS = 280;
const EASE = Easing.out(Easing.cubic);

export interface CollapseProps {
  /** Open → natural height, closed → zero. */
  open: boolean;
  style?: ViewStyle;
  children: ReactNode;
}

export function Collapse({ open, style, children }: CollapseProps) {
  // 0 → collapsed, 1 → open. Drives height and opacity together. Mutated only in
  // the effect below.
  const progress = useSharedValue(open ? 1 : 0);
  // Natural content height, captured on layout; read only on the UI thread.
  const contentHeight = useSharedValue(0);
  // Flips true once the content first reports a height. Before that, an initially
  // open instance renders in normal flow at natural height (no first-frame flash).
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: ANIM_MS, easing: EASE });
    // progress is a stable shared-value ref — mutated here, never a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const windowStyle = useAnimatedStyle(() => ({
    height: progress.value * contentHeight.value,
    opacity: progress.value,
  }));

  function onContentLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0) contentHeight.value = h;
    if (!measured) setMeasured(true);
  }

  const preMeasureStyle = open ? styles.autoHeight : styles.collapsed;

  return (
    <Animated.View style={[styles.overflow, measured ? windowStyle : preMeasureStyle, style]}>
      <View onLayout={onContentLayout} style={measured || !open ? styles.absolute : null}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overflow: { overflow: 'hidden' },
  collapsed: { height: 0 },
  autoHeight: {},
  // Absolute once measured so content always lays out at natural height, never
  // clipped to zero by the animating window (the Fabric text-drop fix).
  absolute: { position: 'absolute', left: 0, right: 0, top: 0 },
});
