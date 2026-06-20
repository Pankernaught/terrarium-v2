/**
 * One hook for everything a component needs off the token system: the resolved
 * palette, the scheme name (for `ecoColor` / `elevation`), and the `isDark` flag.
 * Components read this instead of reaching for `useColorScheme` + `Colors`
 * separately, so the earth-modern palette is applied consistently everywhere.
 *
 * Scheme resolution order: user preference → OS setting. 'system' defers to the OS.
 */
import { useColorScheme } from 'react-native';

import { Colors, type Palette } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';

export interface Tokens {
  c: Palette;
  scheme: 'light' | 'dark';
  isDark: boolean;
}

export function useTokens(): Tokens {
  const { colorScheme: pref } = usePreferences();
  const os = useColorScheme();
  const scheme: 'light' | 'dark' = pref === 'system' ? (os === 'dark' ? 'dark' : 'light') : pref;
  return { c: Colors[scheme], scheme, isDark: scheme === 'dark' };
}
