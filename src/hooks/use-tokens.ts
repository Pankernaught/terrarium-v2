/**
 * One hook for everything a component needs off the token system: the resolved
 * palette, the scheme name (for `ecoColor` / `elevation`), and the `isDark` flag.
 * Components read this instead of reaching for `useColorScheme` + `Colors`
 * separately, so the earth-modern palette is applied consistently everywhere.
 */
import { Colors, type Palette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface Tokens {
  c: Palette;
  scheme: 'light' | 'dark';
  isDark: boolean;
}

export function useTokens(): Tokens {
  const raw = useColorScheme();
  const scheme: 'light' | 'dark' = raw === 'dark' ? 'dark' : 'light';
  return { c: Colors[scheme], scheme, isDark: scheme === 'dark' };
}
