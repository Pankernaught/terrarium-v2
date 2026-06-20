/**
 * The glance header — the top "at a glance" block of a screen: a big title, an
 * optional subtitle, and an optional trailing slot (e.g. an Eco chip or a ⋮
 * overflow). The hero photo, where there is one, is rendered by the screen above
 * this so it can own the shared-element transition.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './text';

export interface GlanceHeaderProps {
  title: string;
  subtitle?: string;
  /** Trailing element, vertically centered with the title row. */
  trailing?: ReactNode;
}

export function GlanceHeader({ title, subtitle, trailing }: GlanceHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text variant="headline" style={styles.title}>
          {title}
        </Text>
        {trailing}
      </View>
      {subtitle ? (
        <Text variant="body" role="textMuted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  title: { flexShrink: 1 },
});
