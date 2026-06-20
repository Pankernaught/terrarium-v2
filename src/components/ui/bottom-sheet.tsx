/* eslint-disable react-hooks/immutability -- Reanimated shared values (`.value`)
   are mutable by design; the React Compiler immutability rule doesn't model them.
   The mutations here are all inside worklets / the effect, exactly as intended. */
/**
 * A velocity-aware bottom sheet: slides up with motion.settle, tracks the finger,
 * and dismisses on a swipe-down — a flick dismisses even if it didn't travel far.
 * Reduce-motion collapses the spring to a 120ms fade.
 *
 * `ActionSheet` is the thin convenience over it for a ⋮ overflow menu (the
 * dashboard's Duplicate / Export / Delete). Gestures run on the UI thread via
 * Gesture Handler + Reanimated.
 */
import { type ReactNode, useEffect } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MICRO_FADE_MS, Motion, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

import { Text } from './text';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible title announced when the sheet opens. */
  title?: string;
}

export function BottomSheet({ visible, onClose, children, title }: BottomSheetProps) {
  const { c } = useTokens();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: MICRO_FADE_MS });
      translateY.value = reduceMotion ? withTiming(0, { duration: MICRO_FADE_MS }) : withSpring(0, Motion.settle);
      if (title) AccessibilityInfo.announceForAccessibility?.(title);
    } else {
      backdrop.value = withTiming(0, { duration: MICRO_FADE_MS });
      translateY.value = withTiming(height, { duration: MICRO_FADE_MS });
    }
    // `translateY` / `backdrop` are stable Reanimated shared-value refs — they are
    // mutated here and in the gesture, so they must not be effect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion, height, title]);

  function close() {
    'worklet';
    backdrop.value = withTiming(0, { duration: MICRO_FADE_MS });
    translateY.value = withTiming(height, { duration: MICRO_FADE_MS }, () => {
      runOnJS(onClose)();
    });
  }

  const pan = Gesture.Pan()
    .onChange((e) => {
      translateY.value = Math.max(0, translateY.value + e.changeY);
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        close();
      } else {
        translateY.value = withSpring(0, Motion.settle);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: c.surface, paddingBottom: insets.bottom + Spacing.md },
              sheetStyle,
            ]}>
            <View style={[styles.grabber, { backgroundColor: c.border }]} />
            {title ? (
              <Text variant="subhead" style={styles.title}>
                {title}
              </Text>
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

// --- ActionSheet ----------------------------------------------------------

export interface SheetAction {
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}

/** A ⋮-overflow menu rendered as a bottom sheet of tappable rows. */
export function ActionSheet({ visible, onClose, title, actions }: ActionSheetProps) {
  const { c } = useTokens();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={() => {
              // Close first, then run — keeps the sheet from lingering over a nav push.
              onClose();
              a.onPress();
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSunken }]}>
            {a.icon}
            <Text variant="body" style={{ color: a.destructive ? c.accent : c.text }}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  title: { marginBottom: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radii.md },
});
