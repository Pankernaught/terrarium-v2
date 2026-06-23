/**
 * Vibe registry — the switchable atmospheres (ADR 0007). Color lives in
 * `Colors[vibe]` (resolved by `useTokens`); backdrops + art live here.
 */
import { type VibeId } from '@/constants/theme';

export { ScreenBackground } from './screen-background';

/** The vibes offered in Settings, in display order. */
export const VIBES: { label: string; value: VibeId }[] = [
  { label: 'Glasshouse', value: 'glasshouse' },
  { label: 'Conservatory', value: 'conservatory' },
];
