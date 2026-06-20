/**
 * A surface card at resting elevation (e0): one soft shadow + the forest-tinted
 * hairline border that keeps Android from looking flat. The base container for
 * build cards, plant cards, and the verdict band.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { elevation, Radii } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export interface CardProps {
  children: ReactNode;
  level?: 'e0' | 'e1';
  style?: ViewStyle;
}

export function Card({ children, level = 'e0', style }: CardProps) {
  const { c } = useTokens();
  return (
    <View style={[styles.base, { backgroundColor: c.surface }, elevation(level, c) as object, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radii.lg },
});
