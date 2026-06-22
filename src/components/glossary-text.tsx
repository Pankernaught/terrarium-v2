/**
 * Renders prose containing author-controlled `[[slug]]` / `[[slug|display]]`
 * glossary links (ADR 0006). Plain runs render normally; linked runs get a subtle
 * dotted underline and open the `TermSheet` via `onPressTerm`.
 *
 * Used for plant `notes` / `nativeContext`. It is harmless on un-tagged prose — a
 * string with no `[[ ]]` markup parses to a single text run and renders exactly as a
 * plain `<Text>` would — so it can be wired in ahead of the Phase E tagging pass.
 *
 * Inline tappable spans use nested `<Text onPress>` (the RN idiom — a `Pressable`
 * can't sit in the text flow). A seed-time + test integrity check guarantees every
 * `slug` here resolves, so there are no dead links to render.
 */
import { Fragment } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import type { TextRole } from '@/components/ui/text';
import type { TypeVariant } from '@/constants/theme';
import { parseGlossaryMarkup } from '@/logic/glossary-markup';

export interface GlossaryTextProps {
  text: string;
  onPressTerm: (slug: string) => void;
  variant?: TypeVariant;
  role?: TextRole;
  style?: StyleProp<TextStyle>;
}

export function GlossaryText({
  text,
  onPressTerm,
  variant = 'body',
  role = 'textMuted',
  style,
}: GlossaryTextProps) {
  const spans = parseGlossaryMarkup(text);
  return (
    <Text variant={variant} role={role} style={style}>
      {spans.map((s, i) =>
        s.kind === 'text' ? (
          <Fragment key={i}>{s.text}</Fragment>
        ) : (
          <Text
            key={i}
            variant={variant}
            role="primary"
            style={styles.link}
            onPress={() => onPressTerm(s.slug)}
            accessibilityRole="link"
            accessibilityLabel={`Define ${s.text}`}>
            {s.text}
          </Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
});
