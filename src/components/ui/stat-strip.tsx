/**
 * A stat strip: a row of compact stats, each an overline label over a bold
 * caption value (§3.3 — bold the value, never the label). Negative space, not
 * dividers, separates them. Wraps gracefully on a narrow screen.
 */
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './text';

export interface Stat {
  label: string;
  value: string;
}

export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <View style={styles.row}>
      {items.map((s) => (
        <View key={s.label} style={styles.item}>
          <Text variant="overline" role="textMuted">
            {s.label}
          </Text>
          <Text variant="caption">{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.sm, columnGap: Spacing.lg },
  item: { gap: 2 },
});
