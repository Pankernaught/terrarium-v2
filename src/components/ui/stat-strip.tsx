/**
 * A stat strip: a row of compact stats, each an overline label over a bold caption
 * value (bold the value, never the label). Negative space, not dividers, separates
 * them. Wraps gracefully on a narrow screen.
 *
 * A stat may carry a glossary `slug`: when set *and* an `onPressTerm` handler is
 * passed, its value becomes a tappable link (subtle dotted underline) that opens the
 * `TermSheet`. Both are optional, so existing callers are unaffected.
 *
 * A stat may instead carry `parts` — a segmented value where each piece has its own
 * optional slug, so one stat can hold several independently-tappable terms (e.g. a
 * build's "Bright Indirect / Medium" light union).
 */
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './text';

export interface Stat {
  label: string;
  value: string;
  /** Glossary slug for this stat's value — makes it a tappable definition link. */
  slug?: string;
  /**
   * Segmented value: render these in order instead of `value`, each part with its
   * own optional glossary `slug`. Lets one stat carry several independently-tappable
   * terms (e.g. a build's "Bright Indirect / Medium" light union). When absent, the
   * plain `value`/`slug` path is used, so existing callers are unaffected.
   */
  parts?: { text: string; slug?: string }[];
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
          {s.parts ? (
            // Segmented value — each part its own optional link, joined by " / ".
            <Text variant="caption">
              {s.parts.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 ? <Text role="textMuted"> / </Text> : null}
                  {part.slug && onPressTerm ? (
                    <Text
                      role="primary"
                      style={styles.link}
                      onPress={() => onPressTerm(part.slug!)}
                      accessibilityRole="link"
                      accessibilityLabel={`Define ${part.text}`}>
                      {part.text}
                    </Text>
                  ) : (
                    part.text
                  )}
                </Fragment>
              ))}
            </Text>
          ) : s.slug && onPressTerm ? (
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
