/**
 * The safe-area screen frame. Every screen wraps in this — forgetting safe-area
 * insets is the instant "web-wrapper" tell. Applies the themed background, the
 * top/side insets, and the screen-level breathing room; the bottom inset is left
 * to the tab bar / scroll content so lists can run under it.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/vibes';
import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Apply the bottom inset too (screens without a scroll list under the tab bar). */
  edges?: { bottom?: boolean };
  style?: ViewStyle;
  /** Pad the horizontal edges with the screen gutter (default true). */
  gutter?: boolean;
  /**
   * The screen's scroll offset, if it owns one. When the active vibe has a backdrop,
   * this drives its parallax (same shared value can also drive a collapsing header —
   * one ref, two consumers). Omit it and the backdrop renders at rest.
   */
  scrollY?: SharedValue<number>;
}

export function Screen({ children, edges, style, gutter = true, scrollY }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { c, vibe } = useTokens();
  return (
    // Outer frame paints the base color + holds the full-bleed vibe backdrop; the
    // inner View carries the safe-area/gutter padding so the backdrop runs edge to edge.
    <View style={[styles.fill, { backgroundColor: c.background }]}>
      <ScreenBackground vibe={vibe} scrollY={scrollY} />
      <View
        style={[
          styles.fill,
          {
            paddingTop: insets.top,
            paddingBottom: edges?.bottom ? insets.bottom : 0,
            paddingLeft: insets.left + (gutter ? Spacing.md : 0),
            paddingRight: insets.right + (gutter ? Spacing.md : 0),
          },
          style,
        ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
