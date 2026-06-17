/**
 * Planner — **shell only** this phase (Premium §4.4). The 5-step stepper scaffold
 * (Container · Substrate · Hardscape · Plants · Final) + the persistent 2-D preview
 * pane that every step keeps in view. **No build interactions yet** — drag-to-place,
 * live recommendations, and the preview sprites are Phase 6; this lands the chrome
 * (step indicator, Back/Next, the preview frame) so "New" and "Edit" have a
 * destination and the layout is fixed before the signature interaction goes in.
 *
 * Read-only of the route params: `?build=<id>` means "edit an existing build"
 * (shown in the title); no param means "new". Nothing is loaded or saved here.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, GlanceHeader, haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

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

export default function PlannerScreen() {
  const { build } = useLocalSearchParams<{ build?: string }>();
  const router = useRouter();
  const { c } = useTokens();
  const [active, setActive] = useState(0);

  const isEdit = typeof build === 'string' && build.length > 0;
  const step = STEPS[active];

  function go(next: number) {
    haptics.select();
    setActive(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  return (
    <Screen edges={{ bottom: true }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
            <Text variant="caption" role="primary">
              ‹ Cancel
            </Text>
          </Pressable>

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

          {/* Persistent 2-D preview pane — docked, framed, empty until Phase 6. */}
          <View style={styles.section}>
            <SectionLabel>Preview</SectionLabel>
            <View style={[styles.preview, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}>
              <Text variant="display" role="textMuted">
                🪴
              </Text>
              <Text variant="caption" role="textMuted" style={styles.previewCaption}>
                2-D front view — the live preview and drag-to-place arrive in the next phase.
              </Text>
            </View>
          </View>

          {/* Current step body — placeholder copy (no interactions this phase). */}
          <View style={styles.section}>
            <SectionLabel>{step.label}</SectionLabel>
            <Card style={styles.stepCard}>
              <Text variant="body">{step.blurb}</Text>
              <Text variant="caption" role="textMuted">
                This step becomes interactive in Phase 6.
              </Text>
            </Card>
          </View>
        </View>
      </ScrollView>

      {/* Back / Next chrome. */}
      <View style={[styles.nav, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <NavButton label="Back" disabled={active === 0} onPress={() => go(active - 1)} />
        <NavButton
          label={active === STEPS.length - 1 ? 'Done' : 'Next'}
          primary
          onPress={() => (active === STEPS.length - 1 ? router.back() : go(active + 1))}
        />
      </View>
    </Screen>
  );
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
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.sm },
  back: { alignSelf: 'flex-start' },
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
  preview: {
    height: 200,
    borderRadius: Radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  previewCaption: { textAlign: 'center', maxWidth: 320, lineHeight: 18 },
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
