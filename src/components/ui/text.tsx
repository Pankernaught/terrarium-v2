/**
 * Typed text on the §3.3 type scale. Screens pass a semantic `variant`
 * (display / headline / title / subhead / body / caption / overline) and an
 * optional colour `role`, never a raw fontSize — that is how the scale stays
 * consistent. `overline` is uppercased here by convention (stat labels).
 */
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { type ThemeColor, Typography, type TypeVariant } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

export type TextRole = Extract<ThemeColor, 'text' | 'textMuted' | 'primary' | 'sage' | 'accent' | 'onPrimary'>;

// `role` shadows RN's ARIA `role` on TextProps; we omit it so our colour-role
// prop keeps the clean name (this text never needs an ARIA landmark role).
export interface AppTextProps extends Omit<TextProps, 'role'> {
  variant?: TypeVariant;
  role?: TextRole;
}

export function Text({ variant = 'body', role = 'text', style, children, ...rest }: AppTextProps) {
  const { c } = useTokens();
  return (
    <RNText
      style={[Typography[variant] as object, { color: c[role] }, variant === 'overline' && styles.overline, style]}
      {...rest}>
      {variant === 'overline' && typeof children === 'string' ? children.toUpperCase() : children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  overline: { textTransform: 'uppercase' },
});
