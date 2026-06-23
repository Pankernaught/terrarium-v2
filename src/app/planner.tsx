/* eslint-disable react-hooks/immutability -- Reanimated shared values (`.value`)
   are mutable by design; the React Compiler immutability rule doesn't model them.
   The `scrollY.value = 0` resets here are deliberate (focus reset, step change). */
/**
 * Planner — the 4-step build flow. A shared {@link PlannerDraft} threads through
 * Container · Substrate · Plants · Final, each step a `(draft) → patch` body, with
 * a persistent 2-D cross-section reading the single draft.
 *
 * `?build=<id>` hydrates the draft from that build (edit); no param starts empty
 * (new). Editing waits on the store; a new build needs no DB until the Final save.
 *
 * ## Scroll model
 *
 * One full-height {@link Animated.ScrollView} is the *only* scroll surface. A
 * floating header is laid absolutely over it and shrinks **purely as a function of
 * `scrollY`** on the UI thread — no JS state, no thresholds, no hysteresis, so it
 * can never snap or oscillate. Over the first `range` px of scroll the chrome
 * (title + step dots) collapses and the cross-section shrinks from a hero to a
 * docked glance, their heights summing to a 1:1 shrink so the content stays glued
 * to the header's bottom edge the whole way. The viewer is `pointerEvents="none"`,
 * so a drag is the same scroll wherever the finger lands.
 *
 * Arranging plants is pulled out of the scroll entirely: once the build has
 * plants, an **Arrange** button opens a full-screen {@link ArrangeOverlay} where
 * dragging happens with nothing scrolling underneath.
 */
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ContainerStep } from '@/components/planner/container-step';
import {
  type PlannerDraft,
  draftFromBuild,
  draftToSaveInput,
  draftToUpdatePatch,
  emptyDraft,
} from '@/components/planner/draft';
import { FinalStep } from '@/components/planner/final-step';
import { PlantsStep } from '@/components/planner/plants-step';
import { ArrangeOverlay, DockedPreview } from '@/components/planner/preview-pane';
import type { StepProps } from '@/components/planner/step';
import { SubstrateStep } from '@/components/planner/substrate-step';
import { Card, haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadPlants } from '@/data';
import { useDbState } from '@/db/provider';
import { useTokens } from '@/hooks/use-tokens';
import { upsertPlacement, type Placement } from '@/logic/placement';

interface Step {
  key: string;
  label: string;
  blurb: string;
}

const STEPS: Step[] = [
  { key: 'container', label: 'Container', blurb: 'Pick a shape, size, and opening — sealed, lidded, or open.' },
  { key: 'substrate', label: 'Substrate', blurb: 'Layer drainage and substrate depths for the volume.' },
  { key: 'plants', label: 'Plants', blurb: 'Add plants and watch the Eco-balance settle, live.' },
  { key: 'final', label: 'Final', blurb: 'Name it, review the verdict, and save.' },
];

// --- Header geometry --------------------------------------------------------
// All scroll-driven sizing derives from these. The hero viewer is a fraction of
// the screen so the first slice of step content still peeks below it; the chrome
// and viewer shrink over the same `range`, summing to a 1:1 collapse.
const VIEWER_FULL_FRAC = 0.42;
const VIEWER_FULL_MIN = 220;
const VIEWER_FULL_MAX = 380;
const VIEWER_DOCKED = 200;
const CHROME_FULL_H = 96; // title + step dots
const CHROME_DOCKED_H = 24; // slim "Step X of N · Label" line
// Fixed header parts — kept in step with the styles so the content spacer matches
// the header's resting height. A few px of drift is invisible (the header's
// background covers content either way; no divider shows at rest).
const CANCEL_BLOCK = 32;
const CHROME_VIEWER_GAP = Spacing.md;
const ARRANGE_BLOCK = 36; // arrange button row (only when the build has plants)
const HEADER_PAD_BOTTOM = Spacing.md;

export default function PlannerScreen() {
  const { build } = useLocalSearchParams<{ build?: string }>();
  const router = useRouter();
  const { c } = useTokens();
  const db = useDbState();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const isEdit = typeof build === 'string' && build.length > 0;
  const [active, setActive] = useState(0);
  // The full-screen arrange takeover (drag plants); separate from the scroll.
  const [arranging, setArranging] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // The single source of truth for the collapsing header — page scroll offset,
  // read on the UI thread. Nothing else drives the chrome.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // The draft is null until hydrated (immediately for a new build; after the
  // store loads the row for an edit).
  const [draft, setDraft] = useState<PlannerDraft | null>(isEdit ? null : emptyDraft());
  const [loadError, setLoadError] = useState<string | null>(null);
  const hydrated = useRef(!isEdit);

  // Reset to a blank slate every time the new-build planner gains focus so a
  // cached navigation instance never shows a stale half-finished draft.
  useFocusEffect(
    useCallback(() => {
      if (isEdit) return;
      setActive(0);
      setArranging(false);
      scrollY.value = 0;
      setDraft(emptyDraft());
      // scrollY is a stable shared-value ref — mutated here, never a dependency.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit]),
  );

  // Edit path: hydrate the draft from the saved build once the store is ready.
  useEffect(() => {
    if (hydrated.current || db.status !== 'ready' || !isEdit) return;
    hydrated.current = true;
    let cancelled = false;
    (async () => {
      try {
        const row = await db.repos.builds.load(build as string);
        if (!cancelled) setDraft(draftFromBuild(row));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isEdit, build]);

  // Selected plants, resolved from the seed bundle (no DB round-trip).
  const plants = useMemo(() => {
    if (!draft || draft.plantSlugs.length === 0) return [];
    const bySlug = new Map(loadPlants().map((p) => [p.slug, p]));
    return draft.plantSlugs.map((s) => bySlug.get(s)).filter((p): p is NonNullable<typeof p> => !!p);
  }, [draft]);

  // --- Scroll-driven header sizing (UI-thread interpolations over `scrollY`) ---
  const availH = winH - insets.top - insets.bottom;
  const viewerFull = Math.round(Math.min(VIEWER_FULL_MAX, Math.max(VIEWER_FULL_MIN, availH * VIEWER_FULL_FRAC)));
  const hasPlants = plants.length > 0;
  // Total scroll over which everything collapses; the chrome and viewer deltas
  // sum to this, making the header shrink exactly 1:1 with scroll.
  const range = CHROME_FULL_H - CHROME_DOCKED_H + (viewerFull - VIEWER_DOCKED);
  const headerFullH =
    CANCEL_BLOCK + CHROME_FULL_H + CHROME_VIEWER_GAP + viewerFull + (hasPlants ? ARRANGE_BLOCK : 0) + HEADER_PAD_BOTTOM;

  const chromeStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, range], [CHROME_FULL_H, CHROME_DOCKED_H], Extrapolation.CLAMP),
  }));
  const heroChromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range * 0.5], [1, 0], Extrapolation.CLAMP),
  }));
  const glanceChromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [range * 0.5, range], [0, 1], Extrapolation.CLAMP),
  }));
  // No seam at rest; a hairline + soft shadow fade in as content tucks behind.
  const dividerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range], [0, 1], Extrapolation.CLAMP),
  }));
  // Explicit height (not auto) so the header's background and seam track the
  // shrink exactly — the chrome + viewer deltas sum to this, so children fit with
  // no gap or overflow. shadow/elevation fade in over the same range.
  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, range], [headerFullH, headerFullH - range], Extrapolation.CLAMP),
    shadowOpacity: interpolate(scrollY.value, [0, range], [0, 0.16], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.value, [0, range], [0, 8], Extrapolation.CLAMP),
  }));

  function go(next: number) {
    haptics.select();
    setActive(Math.max(0, Math.min(STEPS.length - 1, next)));
    // Start the new step fresh at the top with the header restored.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    scrollY.value = 0;
  }

  function update(patch: Partial<PlannerDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  // Commit a dragged placement from the arrange overlay back into the draft.
  function commitPlacement(next: Placement) {
    setDraft((d) => (d ? { ...d, placements: upsertPlacement(d.placements, next) } : d));
  }

  const [saving, setSaving] = useState(false);

  // Final-step save: new → save, edit → update, then land on the build detail.
  async function handleSave() {
    if (!draft || saving) return;
    if (db.status !== 'ready') {
      Alert.alert('Not ready', 'Your library is still loading — try again in a moment.');
      return;
    }
    setSaving(true);
    try {
      const id = draft.id
        ? (await db.repos.builds.update(draft.id, draftToUpdatePatch(draft))).id
        : (await db.repos.builds.save(draftToSaveInput(draft))).id;
      haptics.success();
      router.replace(`/build/${id}` as Href);
    } catch (err) {
      Alert.alert("Couldn’t save", err instanceof Error ? err.message : String(err));
    } finally {
      // Always reset — no-op if the component already unmounted after navigation.
      setSaving(false);
    }
  }

  const step = STEPS[active];
  const isFinal = active === STEPS.length - 1;
  const stepLabel = `Step ${active + 1} of ${STEPS.length} · ${step.label}`;

  // Edit-load gates.
  if (loadError) {
    return (
      <Screen edges={{ bottom: true }}>
        <View style={[styles.inner, styles.centerFill]}>
          <Text variant="title">Couldn’t open this build</Text>
          <Text variant="body" role="textMuted" style={styles.centerText}>
            {loadError}
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Text variant="caption" role="primary">
              ‹ Go back
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }
  if (!draft) {
    return (
      <Screen edges={{ bottom: true }}>
        <View style={[styles.inner, styles.centerFill]}>
          <ActivityIndicator color={c.primary} />
          <Text variant="caption" role="textMuted">
            Loading this build…
          </Text>
        </View>
      </Screen>
    );
  }

  const stepProps: StepProps = { draft, plants, update };

  return (
    <Screen edges={{ bottom: true }}>
      {/* KeyboardAvoidingView so the Back/Next/Save bar (and a focused input) are
          never hidden behind the iOS keyboard; it carries the stage's flex + relative
          positioning so no extra nesting is introduced. */}
      <KeyboardAvoidingView
        style={styles.stage}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* The single scroll surface — full height, behind the header. Bounce is
            off so the viewer can never shrink-then-spring on a short step. */}
        <Animated.ScrollView
          ref={scrollRef}
          style={styles.scrollFill}
          contentContainerStyle={[styles.scroll, { paddingTop: headerFullH }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            <View style={styles.section}>
              <SectionLabel>{step.label}</SectionLabel>
              <StepBody stepKey={step.key} blurb={step.blurb} {...stepProps} />
            </View>
          </View>
        </Animated.ScrollView>

        {/* Floating header — laid over the scroll, shrinks with `scrollY`. Its
            background covers content as it tucks under; only Cancel, the dots, and
            Arrange are touch targets, so scrolling is uniform everywhere else. */}
        <Animated.View
          pointerEvents="box-none"
          style={[styles.header, { backgroundColor: c.background }, headerStyle]}>
          <View style={styles.inner}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.cancel}>
              <Text variant="caption" role="primary">
                ‹ Cancel
              </Text>
            </Pressable>

            {/* Chrome — full (title + dots) crossfades to a slim step line. */}
            <Animated.View pointerEvents="box-none" style={[styles.chrome, chromeStyle]}>
              <Animated.View pointerEvents="box-none" style={[styles.chromeLayer, heroChromeStyle]}>
                <Text variant="headline">{isEdit ? 'Edit terrarium' : 'New terrarium'}</Text>
                <View style={styles.steps}>
                  {STEPS.map((s, i) => {
                    const state = i === active ? 'active' : i < active ? 'done' : 'todo';
                    const dot = state === 'active' ? c.primary : state === 'done' ? c.sage : c.surfaceSunken;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => go(i)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: i === active }}
                        style={styles.stepItem}>
                        <View style={[styles.stepDot, { backgroundColor: dot, borderColor: c.border }]}>
                          <Text variant="caption" style={{ color: state === 'todo' ? c.textMuted : c.onPrimary }}>
                            {i + 1}
                          </Text>
                        </View>
                        <Text variant="overline" role={i === active ? 'primary' : 'textMuted'}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
              <Animated.View pointerEvents="none" style={[styles.chromeLayer, glanceChromeStyle]}>
                <Text variant="caption" role="textMuted">
                  {stepLabel}
                </Text>
              </Animated.View>
            </Animated.View>

            {/* View-only cross-section — shrinks with scroll, never grabs a touch. */}
            <View pointerEvents="none" style={styles.viewer}>
              <DockedPreview
                draft={draft}
                plants={plants}
                scrollY={scrollY}
                fullHeight={viewerFull}
                dockedHeight={VIEWER_DOCKED}
                range={range}
              />
            </View>

            {/* Arrange — appears once there are plants to position. */}
            {hasPlants ? (
              <View pointerEvents="box-none" style={styles.arrangeRow}>
                <Pressable
                  onPress={() => {
                    haptics.select();
                    setArranging(true);
                  }}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.arrangeBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <Text variant="caption" role="primary">
                    ⤢ Arrange plants
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Hairline seam — invisible at rest, fades in as content tucks under. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.divider, { backgroundColor: c.border }, dividerStyle]}
          />
        </Animated.View>

        {/* Back / Next chrome. The final step's primary action saves the build. */}
        <View style={[styles.nav, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <NavButton label="Back" disabled={active === 0 || saving} onPress={() => go(active - 1)} />
          <NavButton
            label={isFinal ? (saving ? 'Saving…' : 'Save') : 'Next'}
            primary
            disabled={saving}
            onPress={() => (isFinal ? handleSave() : go(active + 1))}
          />
        </View>
      </KeyboardAvoidingView>

      {arranging ? (
        <ArrangeOverlay
          draft={draft}
          plants={plants}
          onCommit={commitPlacement}
          onClose={() => setArranging(false)}
        />
      ) : null}
    </Screen>
  );
}

/** Route the active step to its body. */
function StepBody({ stepKey, blurb, ...props }: StepProps & { stepKey: string; blurb: string }) {
  switch (stepKey) {
    case 'container':
      return <ContainerStep {...props} />;
    case 'substrate':
      return <SubstrateStep {...props} />;
    case 'plants':
      return <PlantsStep {...props} />;
    case 'final':
      return <FinalStep {...props} />;
    default:
      return (
        <Card style={styles.stepCard}>
          <Text variant="body">{blurb}</Text>
        </Card>
      );
  }
}

function NavButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.navBtn,
        primary
          ? { backgroundColor: c.primary }
          : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
        disabled && styles.navBtnDisabled,
      ]}>
      <Text variant="body" style={{ color: primary ? c.onPrimary : c.text, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The scroll and the floating header share this stage's top origin, so the 1:1
  // shrink keeps content glued to the header's bottom edge.
  stage: { flex: 1, position: 'relative' },
  scrollFill: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: HEADER_PAD_BOTTOM,
    shadowColor: '#000',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cancel: { alignSelf: 'flex-start', height: 24, justifyContent: 'center', marginBottom: Spacing.sm },
  chrome: { overflow: 'hidden' },
  // The two chrome states stack at the top of the clip so the height shrink keeps
  // them top-aligned through the crossfade.
  chromeLayer: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.sm },
  viewer: { marginTop: CHROME_VIEWER_GAP },
  arrangeRow: { marginTop: Spacing.sm, alignItems: 'flex-end' },
  arrangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  divider: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },

  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', gap: Spacing.xs, flex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  centerText: { textAlign: 'center' },
  section: { gap: Spacing.sm },
  stepCard: { padding: Spacing.lg, gap: Spacing.sm },
  nav: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.md },
  navBtnDisabled: { opacity: 0.4 },
});
