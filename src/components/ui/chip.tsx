/**
 * Chip / pill. A small rounded label, optionally with a leading dot/icon and a
 * press handler (filter chips, tags, the Eco chip). `tone` tints it; a `selected`
 * chip fills with its tone. Never encodes meaning in colour alone — callers pair
 * any semantic tone with text or an icon (never-color-alone, §2 / decision 8).
 */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

import { Text } from './text';

export type ChipTone = 'neutral' | 'primary' | 'sage' | 'accent';

export interface ChipProps {
  label: string;
  tone?: ChipTone;
  selected?: boolean;
  /** A leading element (icon, coloured dot) — keeps colour from being the only signal. */
  leading?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, tone = 'neutral', selected = false, leading, onPress, style }: ChipProps) {
  const { c } = useTokens();
  const toneColor = tone === 'neutral' ? c.textMuted : c[tone];
  const bg = selected ? toneColor : c.surfaceSunken;
  const fg = selected ? c.onPrimary : tone === 'neutral' ? c.text : toneColor;

  const body = (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      {leading}
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={6}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
});
