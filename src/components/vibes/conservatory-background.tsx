/**
 * Conservatory backdrop — a dense bottom **canopy** of overlapping hand-drawn plant
 * sprites that scroll-parallaxes behind screen content, with ambient critters tucked
 * between the depth rows. The flagship's "you're looking into a mature planted tank"
 * effect (ADR 0007, revised: slot-filled canopy replaces the old foliage band).
 *
 * Behavior is code, art is files: the canopy fills from `VibeArt.conservatory
 * .bottomSprites` (+ optional `focalSprites`) — drop a PNG, add a `require()` line, no
 * code change. Layout is computed **once at module load** (`buildCanopy`) so the
 * arrangement is random per cold launch but stable across navigation. Pixels come
 * from the screen size × each sprite's intrinsic aspect (`resolveAssetSource`), so a
 * width-scaled sprite anchored at the bottom keeps its proportions and taller art
 * rises higher on its own.
 *
 * Two depth rows parallax at different speeds (far drifts slow, near fast); critters
 * drift between them so the front row can occlude them. A screen without scroll omits
 * `scrollY` → at rest. Reduce-motion freezes the parallax but keeps the canopy.
 */
import { Image } from 'expo-image';
import { Image as RNImage, StyleSheet, View, useWindowDimensions, type ImageStyle } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { VibeArt } from './art';
import { buildCanopy, type Focal, type Slot } from './canopy';

// Scroll distance over which the parallax fully plays out, and each layer's travel.
// Far drifts least, near most — the depth cue. Tune against real art.
const PARALLAX_RANGE = 600;
const DRIFT_BACK = -32;
const DRIFT_CRITTER = -64;
const DRIFT_FRONT = -110;

const art = VibeArt.conservatory;
// Computed once per cold launch (module scope) — every Screen reads the same canopy.
const CANOPY = buildCanopy({
  bottom: art?.bottomSprites?.length ?? 0,
  focal: art?.focalSprites?.length ?? 0,
});

// A few fixed, hand-placed critter spots (ADR 0007 A8) — no procedural scatter. Each
// names a critter from `VibeArt.conservatory.critters` and a position in the canopy
// band. Adding a critter is a PNG drop + a line here.
const CRITTER_SPOTS: { name: string; size: number; pos: ImageStyle }[] = [
  { name: 'snail', size: 64, pos: { left: 14, bottom: '9%' } },
  { name: 'snail', size: 50, pos: { right: 20, bottom: '24%' } },
];

/** One placed sprite → pixels. Width from screen × scale, height from intrinsic aspect. */
function Sprite({ src, slot, W, H }: { src: number; slot: Slot | Focal; W: number; H: number }) {
  const { width: iw, height: ih } = RNImage.resolveAssetSource(src);
  const w = slot.scale * W;
  const h = iw ? w * (ih / iw) : w;
  const yOffset = 'yOffset' in slot ? slot.yOffset : 0;
  const z = 'z' in slot ? slot.z : 100; // focal sits above the front row
  return (
    <Image
      source={src}
      style={{
        position: 'absolute',
        width: w,
        height: h,
        left: (slot.cx - slot.scale / 2) * W,
        bottom: yOffset * H,
        zIndex: z,
        transform: [{ scaleX: slot.flip ? -1 : 1 }],
      }}
      contentFit="contain"
    />
  );
}

export function ConservatoryBackground({ scrollY }: { scrollY?: SharedValue<number> }) {
  const reduceMotion = useReducedMotion();
  const { width: W, height: H } = useWindowDimensions();
  // A screen without scroll passes no shared value; this keeps the worklets reading
  // a real (resting) value instead of branching on undefined.
  const atRest = useSharedValue(0);
  const sv = scrollY ?? atRest;

  // One interpolation per depth — different travel = depth. Identical shape, so the
  // `to` constant is the only thing that varies.
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

  // Nothing to show until the artist drops canopy PNGs (pools empty → no slots).
  if (!CANOPY.back.length && !CANOPY.front.length && !CANOPY.focal) return null;
  const pool = art?.bottomSprites ?? [];
  const focalPool = art?.focalSprites ?? [];
  const critters = art?.critters ?? {};

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        {CANOPY.back.map((slot, i) => (
          <Sprite key={i} src={pool[slot.poolIndex]} slot={slot} W={W} H={H} />
        ))}
      </Animated.View>
      {/* Critters drift between the depth rows, so the front row occludes them. */}
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
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        {CANOPY.front.map((slot, i) => (
          <Sprite key={i} src={pool[slot.poolIndex]} slot={slot} W={W} H={H} />
        ))}
        {CANOPY.focal && (
          <Sprite src={focalPool[CANOPY.focal.poolIndex]} slot={CANOPY.focal} W={W} H={H} />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  critter: { position: 'absolute' },
});
