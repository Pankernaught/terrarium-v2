/**
 * A stat strip: a row of compact stats, each an overline label over a bold caption
 * value (bold the value, never the label). Negative space, not dividers, separates
 * them. Wraps gracefully on a narrow screen.
 *
 * A stat may carry a glossary `slug`: when set *and* an `onPressTerm` handler is
 * passed, its value becomes a tappable link (subtle dotted underline) that opens the
 * `TermSheet`. Both are optional, so existing callers are unaffected.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './text';

export interface Stat {
  label: string;
  value: string;
  /** Glossary slug for this stat's value — makes it a tappable definition link. */
  slug?: string;
}

export function StatStrip({
  items,
  onPressTerm,
}: {
  items: Stat[];
  onPressTerm?: (slug: string) => void;
}) {
  return (
    <View style={styles.row}>
      {items.map((s) => (
        <View key={s.label} style={styles.item}>
          <Text variant="overline" role="textMuted">
            {s.label}
          </Text>
          {s.slug && onPressTerm ? (
            <Pressable
              onPress={() => onPressTerm(s.slug!)}
              accessibilityRole="link"
              accessibilityLabel={`Define ${s.value}`}
              hitSlop={6}>
              <Text variant="caption" role="primary" style={styles.link}>
                {s.value}
              </Text>
            </Pressable>
          ) : (
            <Text variant="caption">{s.value}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.sm, columnGap: Spacing.lg },
  item: { gap: 2 },
  link: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
