import { useCallback } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

import { SectionLabel } from './section-label';
import { Text } from './text';

const THUMB = 24;

export function RangeSlider({
  label,
  min,
  max,
  values,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  values: [number, number];
  onChange: (v: [number, number]) => void;
  format?: (v: number) => string;
}) {
  const { c } = useTokens();
  const fmt = format ?? String;
  const range = max - min;

  const tw = useSharedValue(0);
  const lo = useSharedValue((values[0] - min) / range);
  const hi = useSharedValue((values[1] - min) / range);
  // Capture thumb positions at gesture start so translationX is added to a stable base.
  const loStart = useSharedValue(0);
  const hiStart = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      tw.value = e.nativeEvent.layout.width - THUMB;
    },
    [tw],
  );

  // Runs on JS thread via runOnJS — can access closure values freely.
  const emit = (loV: number, hiV: number) => {
    onChange([Math.round(loV * range) + min, Math.round(hiV * range) + min]);
  };

  const loGesture = Gesture.Pan()
    .minDistance(0)
    .onStart(() => { loStart.value = lo.value; })
    .onUpdate((e) => {
      lo.value = Math.max(0, Math.min(loStart.value + e.translationX / tw.value, hi.value - 1 / range));
      runOnJS(emit)(lo.value, hi.value);
    });

  const hiGesture = Gesture.Pan()
    .minDistance(0)
    .onStart(() => { hiStart.value = hi.value; })
    .onUpdate((e) => {
      hi.value = Math.max(lo.value + 1 / range, Math.min(1, hiStart.value + e.translationX / tw.value));
      runOnJS(emit)(lo.value, hi.value);
    });

  const loStyle = useAnimatedStyle(() => ({ left: lo.value * tw.value }));
  const hiStyle = useAnimatedStyle(() => ({ left: hi.value * tw.value }));
  const fillStyle = useAnimatedStyle(() => ({
    left: lo.value * tw.value + THUMB / 2,
    right: (1 - hi.value) * tw.value + THUMB / 2,
  }));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SectionLabel>{label}</SectionLabel>
        <Text variant="caption" role="textMuted">
          {fmt(values[0])} – {fmt(values[1])}
        </Text>
      </View>
      <View style={styles.track} onLayout={onLayout}>
        <View style={[styles.rail, { backgroundColor: c.surfaceSunken }]} />
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: c.primary }]} />
        <GestureDetector gesture={loGesture}>
          <Animated.View style={[styles.thumb, loStyle, { backgroundColor: c.surface, borderColor: c.primary }]} />
        </GestureDetector>
        <GestureDetector gesture={hiGesture}>
          <Animated.View style={[styles.thumb, hiStyle, { backgroundColor: c.surface, borderColor: c.primary }]} />
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: THUMB, justifyContent: 'center' },
  rail: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 4,
    borderRadius: Radii.pill,
  },
  fill: { position: 'absolute', height: 4 },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
  },
});
