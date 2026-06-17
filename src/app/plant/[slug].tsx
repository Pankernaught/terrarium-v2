/**
 * Plant view (Premium §4.5 content, rendered as a page here — the bottom-sheet
 * presentation is a Phase-9 polish). Port of v1 `pages/plant_profile.py`, with the
 * Phase-3 data model:
 *
 *   - light / soilMoisture render their primary + the tolerable secondary (d.15);
 *   - **toxicity is display-only (decision 8): shown only when a note exists, never
 *     colour-alone, and a blank note is NEVER rendered as "Non-toxic ✓"** — absence
 *     means "no note authored," not "safe";
 *   - v1's `plant_photos` section is gone (struck in Phase 4 — curator imagery is the
 *     static seed `image`, not a per-install table).
 *
 * Reads the seed bundle directly (zero DB round-trip, decision 11) for the plant;
 * "used in these builds" is the one DB read, via the injected build repo.
 */
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, Chip, GlanceHeader, Screen, SectionLabel, StatStrip, type Stat, Text } from '@/components/ui';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadPlants } from '@/data';
import { useDbState } from '@/db/provider';
import type { Build } from '@/db/schema';
import type { Plant } from '@/types/plant';
import { humanize, lightLabel, moistureLabel, suitabilityLabel } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';

export default function PlantRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const plant = useMemo(() => loadPlants().find((p) => p.slug === slug), [slug]);

  if (!plant) return <NotFound />;
  return <PlantView plant={plant} />;
}

function PlantView({ plant }: { plant: Plant }) {
  const router = useRouter();
  const { c } = useTokens();
  const state = useDbState();

  // "Used in these builds" — the one DB read; safe to skip until the store is ready.
  const [usedIn, setUsedIn] = useState<Build[] | null>(null);
  useEffect(() => {
    if (state.status !== 'ready') return;
    let active = true;
    state.repos.builds.containingPlant(plant.slug).then((builds) => {
      if (active) setUsedIn(builds);
    });
    return () => {
      active = false;
    };
  }, [state, plant.slug]);

  const difficultyDots = '●'.repeat(plant.difficulty) + '○'.repeat(5 - plant.difficulty);

  return (
    <Screen edges={{ bottom: true }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
            <Text variant="caption" role="primary">
              ‹ Back
            </Text>
          </Pressable>

          {/* Plant catalog imagery is a static seed `image` path (e.g. "plants/<slug>.png"),
              but the accuracy-first CC/PD photo set is the Phase-3 owner long-pole and is
              not bundled yet — so the hero renders the leaf fallback for now. When real
              photos + a require map land, this is the single place to wire them in. */}
          <View style={[styles.hero, styles.heroFallback, { backgroundColor: c.surfaceSunken }]}>
            <Text variant="display" role="textMuted">
              🌿
            </Text>
          </View>

          <View style={styles.header}>
            <GlanceHeader title={plant.commonName} />
            <Text variant="body" role="textMuted" style={styles.sci}>
              {plant.scientificName}
            </Text>
            <View style={styles.headChips}>
              <Chip label={`Difficulty ${difficultyDots}`} tone="neutral" />
              {plant.plantType ? <Chip label={humanize(plant.plantType)} tone="sage" /> : null}
              {plant.nativeBiome ? <Chip label={humanize(plant.nativeBiome)} tone="sage" /> : null}
            </View>
          </View>

          {/* Care requirements */}
          <View style={styles.section}>
            <SectionLabel>Care requirements</SectionLabel>
            <Card style={styles.card}>
              <StatStrip items={careStats(plant)} />
            </Card>
          </View>

          {/* Plant profile */}
          <View style={styles.section}>
            <SectionLabel>Plant profile</SectionLabel>
            <Card style={styles.card}>
              <StatStrip items={profileStats(plant)} />
            </Card>
          </View>

          {/* Toxicity — display-only (decision 8). Rendered ONLY when a note exists.
              A blank note is never shown as a safety claim. */}
          {plant.toxicity ? (
            <View style={styles.section}>
              <SectionLabel>Safety note</SectionLabel>
              <Card style={StyleSheet.flatten([styles.card, styles.toxCard, { borderColor: c.accent }])}>
                <View style={styles.toxHead}>
                  <View style={[styles.toxDot, { backgroundColor: c.accent }]} />
                  <Text variant="caption" role="accent">
                    Handling note
                  </Text>
                </View>
                <Text variant="body">{plant.toxicity}</Text>
              </Card>
            </View>
          ) : null}

          {/* Native context — optional Tier-3 origin copy. */}
          {plant.nativeContext ? (
            <View style={styles.section}>
              <SectionLabel>Origin</SectionLabel>
              <Text variant="body" role="textMuted" style={styles.bodyBlock}>
                {plant.nativeContext}
              </Text>
            </View>
          ) : null}

          {/* Notes */}
          {plant.notes ? (
            <View style={styles.section}>
              <SectionLabel>Notes</SectionLabel>
              <Text variant="body" role="textMuted" style={styles.bodyBlock}>
                {plant.notes}
              </Text>
            </View>
          ) : null}

          {/* Used in these builds */}
          <View style={styles.section}>
            <SectionLabel>Used in these builds</SectionLabel>
            {usedIn === null ? (
              <Text variant="body" role="textMuted">
                …
              </Text>
            ) : usedIn.length === 0 ? (
              <Text variant="body" role="textMuted">
                Not in any of your terrariums yet.
              </Text>
            ) : (
              <View style={styles.chips}>
                {usedIn.map((b) => (
                  <Chip key={b.id} label={b.name} tone="primary" onPress={() => router.push(`/build/${b.id}` as Href)} />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function careStats(plant: Plant): Stat[] {
  return [
    { label: 'Light', value: lightLabel(plant.light) },
    { label: 'Soil moisture', value: moistureLabel(plant.soilMoisture) },
    { label: 'Humidity', value: `${plant.humidityPctRange[0]}–${plant.humidityPctRange[1]}%` },
    { label: 'Temperature', value: `${plant.tempCRange[0]}–${plant.tempCRange[1]}°C` },
  ];
}

function profileStats(plant: Plant): Stat[] {
  const stats: Stat[] = [
    { label: 'Growth rate', value: humanize(plant.growthRate) },
    { label: 'Max height', value: `${plant.maxHeightCm} cm` },
    { label: 'Suitability', value: suitabilityLabel(plant.closedTerrariumOk, plant.openTerrariumOk) },
  ];
  if (plant.growthHabit) stats.push({ label: 'Habit', value: humanize(plant.growthHabit) });
  return stats;
}

function NotFound() {
  const router = useRouter();
  return (
    <Screen edges={{ bottom: true }}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8} style={styles.back}>
          <Text variant="caption" role="primary">
            ‹ Back
          </Text>
        </Pressable>
        <Text variant="headline">Plant not found</Text>
        <Text variant="body" role="textMuted">
          That plant isn’t in the catalog.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg, paddingTop: Spacing.sm },
  back: { alignSelf: 'flex-start' },
  hero: { width: '100%', height: 220, borderRadius: Radii.lg },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  header: { gap: Spacing.sm },
  sci: { fontStyle: 'italic', marginTop: -Spacing.xs },
  headChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  section: { gap: Spacing.sm },
  card: { padding: Spacing.lg },
  toxCard: { borderWidth: 1, gap: Spacing.sm },
  toxHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toxDot: { width: 9, height: 9, borderRadius: Radii.pill },
  bodyBlock: { lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
