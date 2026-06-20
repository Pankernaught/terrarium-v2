/**
 * A reusable horizontal meter (a filled bar over a sunken track). Pure layout —
 * the animated, OKLCH-filling Eco variant builds on this. `value` is 0–1.
 *
 * Animates width via a Reanimated worklet only when `animated` is set; the fill
 * uses transform-free width because the bar is static on read-mostly screens.
 * The planner's live preview uses a transform-based fill to stay on the UI thread.
 */
import { StyleSheet, View } from 'react-native';

import { useTokens } from '@/hooks/use-tokens';

export interface MeterProps {
  /** Fill fraction, 0–1 (clamped). */
  value: number;
  color: string;
  height?: number;
  trackColor?: string;
}

export function Meter({ value, color, height = 8, trackColor }: MeterProps) {
  const { c } = useTokens();
  const pct = `${Math.max(0, Math.min(1, value)) * 100}%` as const;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor ?? c.surfaceSunken }]}>
      <View style={[styles.fill, { width: pct, backgroundColor: color, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
