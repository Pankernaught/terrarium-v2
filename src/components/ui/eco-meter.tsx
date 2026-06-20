/**
 * The Eco-balance meter: a `Meter` whose fill colour comes from the OKLCH sweep
 * (`ecoColor`) so the bar reads green → amber → red without a muddy midpoint.
 * Display-only here; the planner's live preview uses an animated overshoot fill.
 */
import { View } from 'react-native';

import { ecoColor } from '@/logic/eco';
import { useTokens } from '@/hooks/use-tokens';

import { Meter } from './meter';

export interface EcoMeterProps {
  /** 0–100 score. */
  score: number;
  height?: number;
}

export function EcoMeter({ score, height = 10 }: EcoMeterProps) {
  const { scheme } = useTokens();
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(score) }}>
      <Meter value={score / 100} color={ecoColor(score, scheme)} height={height} />
    </View>
  );
}
