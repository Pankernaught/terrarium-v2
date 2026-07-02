/**
 * The Eco-balance score ring: a circular track with a progress arc that sweeps
 * (animated) to `score / 100`, the big number centred over it. Replaces the
 * linear `EcoMeter` on the planner's live verdict card — the colour carries the
 * green→amber→red signal (via `ecoColor`) so the ring doubles as the meter.
 *
 * The arc animates; the colour snaps per render. ponytail: a crossfading stroke
 * would need an RGB lerp that diverges from the OKLab `ecoColor` sweep — not
 * worth the divergence for a colour that only changes when you add a plant.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from './text';
import { clamp01 } from '@/logic/placement';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface EcoRingProps {
  /** 0–100. */
  score: number;
  /** Stroke + number tint — pass `ecoColor(score, scheme)`. */
  color: string;
  trackColor: string;
  size?: number;
  stroke?: number;
}

export function EcoRing({ score, color, trackColor, size = 96, stroke = 8 }: EcoRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = clamp01(score / 100);

  const progress = useSharedValue(fraction);
  useEffect(() => {
    progress.value = withTiming(fraction, { duration: 320, easing: Easing.out(Easing.cubic) });
  }, [fraction, progress]);

  // Offset C → empty, 0 → full ring. Animated on the UI thread.
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - progress.value) }));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(score) }}>
      {/* Rotated so the arc starts at 12 o'clock instead of 3 o'clock. */}
      <Svg width={size} height={size} style={styles.rotate}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text variant="title" style={{ color }}>{Math.round(score)}</Text>
        <Text variant="overline" role="textMuted">/100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rotate: { transform: [{ rotate: '-90deg' }] },
  center: { alignItems: 'center', justifyContent: 'center', gap: 0 },
});
