/**
 * Conservatory backdrop — bottom-anchored layered foliage (PNG file-drop) that
 * scroll-parallaxes behind screen content, with ambient critters tucked between the
 * layers. The flagship's "you're looking into a living jungle" effect (ADR 0007,
 * decisions 4 + A8).
 *
 * Behavior is code, art is files: foliage + critters are PNGs in
 * `VibeArt.conservatory` (swap in place, no code change). Parallax reuses the
 * planner's UI-thread `interpolate(scrollY)` pattern — far layer drifts slow, near
 * layer fast, critters between. A screen without scroll omits `scrollY` → at rest.
 *
 * Critters sit at a few **fixed, hand-placed spots** (no scatter engine) in the
 * foliage band / side gutters, between the foliage layers so the near foliage can
 * occlude them. They never land behind text — content sits above the band / inside
 * the centered column (A8). Ship one critter; more are a PNG drop + a `CRITTER_SPOTS`
 * line.
 *
 * T1 (scroll parallax) ships here; T2 (continuous sway) is a documented future loop
 * added inside this component behind the same reduce-motion gate — no change to
 * `Screen`, the bundle, or any screen.
 */
import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle } from 'react-native';
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
const DRIFT_CRITTER = -64;
const DRIFT_FRONT = -110;

// A few fixed, hand-placed critter spots (ADR 0007 A8) — no procedural scatter. Each
// names a critter from `VibeArt.conservatory.critters` and a position in the foliage
// band / side gutter. Adding a critter is a PNG drop + a line here.
const CRITTER_SPOTS: { name: string; size: number; pos: ImageStyle }[] = [
  { name: 'snail', size: 64, pos: { left: 14, bottom: '9%' } },
  { name: 'snail', size: 50, pos: { right: 20, bottom: '24%' } },
];

export function ConservatoryBackground({ scrollY }: { scrollY?: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  // A screen without scroll passes no shared value; this keeps the worklets reading
  // a real (resting) value instead of branching on undefined.
  const atRest = useSharedValue(0);
  const sv = scrollY ?? atRest;
  const art = VibeArt.conservatory;

  // One interpolation per depth — different travel = depth. Identical shape, so the
  // worklet body is the only thing that varies (the `to` constant).
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_BACK], Extrapolation.CLAMP) },
    ],
  }));
  const critterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_CRITTER], Extrapolation.CLAMP) },
    ],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduceMotion ? 0 : interpolate(sv.value, [0, PARALLAX_RANGE], [0, DRIFT_FRONT], Extrapolation.CLAMP) },
    ],
  }));

  if (!art?.foliageBack || !art.foliageFront) return null;
  const critters = art.critters ?? {};

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.layer, styles.backLayer, backStyle]}>
        <Image source={art.foliageBack} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Animated.View>
      {/* Critters drift between the foliage layers, so the near layer occludes them. */}
      <Animated.View style={[StyleSheet.absoluteFill, critterStyle]}>
        {CRITTER_SPOTS.map((spot, i) => {
          const src = critters[spot.name];
          return src == null ? null : (
            <Image
              key={i}
              source={src}
              style={[styles.critter, { width: spot.size, height: spot.size }, spot.pos]}
              contentFit="contain"
            />
          );
        })}
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
  critter: { position: 'absolute' },
});
