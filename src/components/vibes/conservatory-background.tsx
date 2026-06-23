/**
 * Conservatory backdrop — bottom-anchored layered foliage (PNG file-drop) that
 * scroll-parallaxes behind screen content. The flagship's "you're looking into a
 * jungle" effect (ADR 0007, decision 4).
 *
 * Behavior is code, art is files: the three layers are PNGs in `VibeArt.conservatory`
 * (swap in place, no code change). Parallax reuses the planner's UI-thread
 * `interpolate(scrollY)` pattern — far layer drifts slow, near layer fast, mascot
 * between. A screen without scroll omits `scrollY` → layers render at rest.
 *
 * T1 (scroll parallax) ships here; T2 (continuous sway) is a documented future loop
 * added inside this component behind the same reduce-motion gate — no change to
 * `Screen`, the bundle, or any screen.
 */
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { VibeArt } from './art';

// Scroll distance over which the parallax fully plays out, and each layer's travel.
// Far drifts least, near most — the depth cue. Tune against real art.
const PARALLAX_RANGE = 600;
const DRIFT_BACK = -32;
const DRIFT_MASCOT = -64;
const DRIFT_FRONT = -110;

export function ConservatoryBackground({ scrollY }: { scrollY?: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  // A screen without scroll passes no shared value; this keeps the worklets reading
  // a real (resting) value instead of branching on undefined.
  const atRest = useSharedValue(0);
  const sv = scrollY ?? atRest;
  const art = VibeArt.conservatory;

  // One interpolation per layer — different travel = depth. Identical shape, so the
  // worklet body is the only thing that varies (the `to` constant).
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_BACK], Extrapolation.CLAMP) },
    ],
  }));
  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_MASCOT], Extrapolation.CLAMP) },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_FRONT], Extrapolation.CLAMP) },
    ],
  }));

  if (!art) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.layer, styles.backLayer, backStyle]}>
        <Image source={art.foliageBack} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      <Animated.View style={[styles.mascotLayer, mascotStyle]}>
        <Image source={art.mascot} style={styles.mascotImg} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.layer, styles.frontLayer, frontStyle]}>
        <Image source={art.foliageFront} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  backLayer: { height: '48%' },
  frontLayer: { height: '34%' },
  mascotLayer: { position: 'absolute', right: 12, bottom: '8%', width: 120, height: 120 },
  mascotImg: { width: '100%', height: '100%' },
});
