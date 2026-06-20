/**
 * A section label — overline style (uppercase, letter-spaced, muted). Used as the
 * quiet heading above a group; macro-whitespace (not a rule or box) is the real
 * visual boundary.
 */
import { type StyleProp, type TextStyle } from 'react-native';

import { Text } from './text';

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text variant="overline" role="textMuted" style={style}>
      {children}
    </Text>
  );
}
