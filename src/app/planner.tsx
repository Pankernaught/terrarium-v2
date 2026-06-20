/**
 * Planner — the 5-step build flow. A shared {@link PlannerDraft} threads through
 * Container · Substrate · Hardscape · Plants · Final, each step a
 * `(draft) → patch` body, with the persistent 2-D preview pane reading the single
 * draft.
 *
 * `?build=<id>` hydrates the draft from that build (edit); no param starts empty
 * (new). Editing waits on the store; a new build needs no DB until the Final save.
 */
import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ContainerStep } from '@/components/planner/container-step';
import {
  type PlannerDraft,
  draftFromBuild,
  draftToSaveInput,
  draftToUpdatePatch,
  emptyDraft,
} from '@/components/planner/draft';
import type { DraggableKind } from '@/components/planner/cross-section';
import { FinalStep } from '@/components/planner/final-step';
import { HardscapeStep } from '@/components/planner/hardscape-step';
import { PlantsStep } from '@/components/planner/plants-step';
import { PlannerPreviewPane } from '@/components/planner/preview-pane';
import type { StepProps } from '@/components/planner/step';
import { SubstrateStep } from '@/components/planner/substrate-step';
import { Card, Collapse, GlanceHeader, haptics, Screen, SectionLabel, Text } from '@/components/ui';
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
  { key: 'hardscape', label: 'Hardscape', blurb: 'Place wood and rock to frame the scene.' },
  { key: 'plants', label: 'Plants', blurb: 'Add plants and watch the Eco-balance settle, live.' },
  { key: 'final', label: 'Final', blurb: 'Name it, review the verdict, and save.' },
];

/** Which item category the persistent cross-section lets you slide on each step. */
const DRAG_KIND: Record<string, DraggableKind> = { hardscape: 'hardscape', plants: 'plant' };

export default function PlannerScreen() {
  const { build } = useLocalSearchParams<{ build?: string }>();
  const router = useRouter();
  const { c } = useTokens();
  const db = useDbState();

  const isEdit = typeof build === 'string' && build.length > 0;
  const [active, setActive] = useState(0);
  // When the preview is expanded, the header chrome (title, step counter, dots)
  // collapses so the preview slides up to the top.
  const [previewExpanded, setPreviewExpanded] = useState(false);
  // The chrome also collapses once the step body scrolls down, keeping just the
  // preview pinned. Hysteresis (collapse past 36px, restore under 8px) avoids
  // flicker around the threshold.
  const [scrolledDown, setScrolledDown] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
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
      setPreviewExpanded(false);
      setScrolledDown(false);
      setDraft(emptyDraft());
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

  function go(next: number) {
    haptics.select();
    setActive(Math.max(0, Math.min(STEPS.length - 1, next)));
    // Start the new step fresh at the top with the chrome restored.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setScrolledDown(false);
  }

  function onBodyScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const y = e.nativeEvent.contentOffset.y;
    setScrolledDown((prev) => (prev ? y > 8 : y > 36));
  }

  function update(patch: Partial<PlannerDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  // Commit a dragged/scaled placement from the preview back into the draft.
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
      {/* Fixed header — Cancel and the live preview stay docked so a change made
          deep in a long step is visible the instant it's made; only the step body
          below scrolls, tucking behind the header's bottom divider. Expanding the
          preview collapses the title/step chrome so it slides up to the top. */}
      <View style={[styles.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
            <Text variant="caption" role="primary">
              ‹ Cancel
            </Text>
          </Pressable>

          {/* Title, step counter and step dots — collapse away when the preview is
              expanded so it can take the top. */}
          <Collapse open={!previewExpanded && !scrolledDown}>
            <View style={styles.chrome}>
              <GlanceHeader
                title={isEdit ? 'Edit terrarium' : 'New terrarium'}
                subtitle={`Step ${active + 1} of ${STEPS.length} · ${step.label}`}
              />

              {/* Step indicator — tappable dots (navigation chrome, not a build action). */}
              <View style={styles.steps}>
                {STEPS.map((s, i) => {
                  const state = i === active ? 'active' : i < active ? 'done' : 'todo';
                  const dot =
                    state === 'active' ? c.primary : state === 'done' ? c.sage : c.surfaceSunken;
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
            </View>
          </Collapse>

          {/* Persistent cross-section viewer — docked, framed, live. Tap to expand
              to the working size; the active step decides which items can be slid
              horizontally (hardscape vs plants) once expanded. */}
          <PlannerPreviewPane
            draft={draft}
            plants={plants}
            draggableKind={DRAG_KIND[step.key] ?? null}
            onCommit={commitPlacement}
            expanded={previewExpanded}
            onExpandedChange={setPreviewExpanded}
          />
        </View>
      </View>

      {/* Current step body — the only scrolling region. */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollFill}
        contentContainerStyle={styles.scroll}
        onScroll={onBodyScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.section}>
            <SectionLabel>{step.label}</SectionLabel>
            <StepBody stepKey={step.key} blurb={step.blurb} {...stepProps} />
          </View>
        </View>
      </ScrollView>

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
    </Screen>
  );
}

/** Route the active step to its body; chat-2 steps render the placeholder card. */
function StepBody({ stepKey, blurb, ...props }: StepProps & { stepKey: string; blurb: string }) {
  switch (stepKey) {
    case 'container':
      return <ContainerStep {...props} />;
    case 'substrate':
      return <SubstrateStep {...props} />;
    case 'hardscape':
      return <HardscapeStep {...props} />;
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
  // The fixed header floats above the scroll: a hairline divider plus a soft
  // downward shadow so the step body visibly disappears behind it as it scrolls.
  header: {
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  scrollFill: { flex: 1 },
  scroll: { alignItems: 'center', paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingTop: Spacing.sm },
  // Collapsing chrome content — its own spacing so it animates away cleanly with
  // the collapse (no residual gap left behind in the header).
  chrome: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  centerText: { textAlign: 'center' },
  back: { alignSelf: 'flex-start', marginBottom: Spacing.md },
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
