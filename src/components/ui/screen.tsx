/**
 * The safe-area screen frame. Every screen wraps in this — forgetting safe-area
 * insets is the instant "web-wrapper" tell. Applies the themed background, the
 * top/side insets, and the screen-level breathing room; the bottom inset is left
 * to the tab bar / scroll content so lists can run under it.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Apply the bottom inset too (screens without a scroll list under the tab bar). */
  edges?: { bottom?: boolean };
  style?: ViewStyle;
  /** Pad the horizontal edges with the screen gutter (default true). */
  gutter?: boolean;
}

export function Screen({ children, edges, style, gutter = true }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { c } = useTokens();
  return (
    <View
      style={[
        styles.fill,
        {
          backgroundColor: c.background,
          paddingTop: insets.top,
          paddingBottom: edges?.bottom ? insets.bottom : 0,
          paddingLeft: insets.left + (gutter ? Spacing.md : 0),
          paddingRight: insets.right + (gutter ? Spacing.md : 0),
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
