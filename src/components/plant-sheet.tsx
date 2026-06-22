/**
 * Shared plant detail sheet — the single surface for all three tiers of plant
 * information (doc §Information cleanliness). Replaces /plant/[slug] navigation:
 * the sheet is used from the planner catalog, the "In this build" selection, the
 * Browse screen, and the build detail page.
 *
 * Context:
 *   'planner' — shows a compatibility callout (if conflicts exist) + Add/Remove
 *               button in a sticky footer.
 *   'browse'  — purely informational; no footer.
 *
 * Tier 2 is always visible. Tier 3 expands behind a toggle ("Full profile").
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { BottomSheet, haptics, SectionLabel, StatStrip, type Stat, Text } from '@/components/ui';
import { GlossaryText } from '@/components/glossary-text';
import { TermSheet } from '@/components/term-sheet';
import { Radii, Spacing } from '@/constants/theme';
import { humanize, lightLabel, moistureLabel, suitabilityLabel } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';
import { vocabSlug } from '@/types';
import type { Plant, PlantSource } from '@/types/plant';

/** Human-readable label for a source link — its `label`, else the bare host. */
function sourceLabel(source: PlantSource): string {
  if (source.label) return source.label;
  try {
    return new URL(source.url).host.replace(/^www\./, '');
  } catch {
    return source.url;
  }
}

/** A pre-resolved conflict against another plant in the current build. */
export interface PlantConflict {
  withPlantName: string;
  message: string;
  severity: 'caution' | 'incompatible';
}

export interface PlantSheetProps {
  plant: Plant | null;
  onClose: () => void;
  context: 'planner' | 'browse';
  /** Whether the plant is currently in the active build (planner context only). */
  isSelected?: boolean;
  /** Toggle add/remove in the build (planner context only). */
  onToggle?: () => void;
  /** Pre-computed pairwise conflicts against the current build (planner context only). */
  conflicts?: PlantConflict[];
}

const PLANT_TYPE_EMOJI: Record<string, string> = {
  fern: '🌿',
  'fern-ally': '🌾',
  moss: '🌱',
  succulent: '🪴',
  carnivorous: '🪤',
  aroid: '🍃',
  begonia: '🌺',
  bromeliad: '🍍',
  orchid: '🌸',
  vine: '🌿',
  'ground-cover': '🌱',
  foliage: '🍃',
};

export function PlantSheet({ plant, onClose, context, isSelected, onToggle, conflicts = [] }: PlantSheetProps) {
  const [tier3Open, setTier3Open] = useState(false);
  const { height } = useWindowDimensions();
  const { c } = useTokens();

  // Glossary term sheet opened from inline chip / stat / prose links — stacks over
  // this sheet and shares the single TermSheet component (ADR 0006).
  const [termSlug, setTermSlug] = useState<string | null>(null);

  // Reset Tier 3 + any open term when a different plant opens.
  const [lastSlug, setLastSlug] = useState<string | null>(null);
  if (plant && plant.slug !== lastSlug) {
    setLastSlug(plant.slug);
    setTier3Open(false);
    setTermSlug(null);
  }

  function handleToggle() {
    haptics.select();
    onToggle?.();
    onClose();
  }

  return (
    <>
    <BottomSheet visible={plant != null} onClose={onClose} title={plant?.commonName}>
      {plant ? (
        <>
          <ScrollView
            style={{ maxHeight: height * 0.62 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">

            {/* Header — scientific name + classifier chips */}
            <Text variant="caption" role="textMuted" style={styles.sci}>
              {plant.scientificName}
            </Text>
            <View style={styles.headerChips}>
              {plant.plantType ? (
                <Pressable
                  onPress={() => { haptics.select(); setTermSlug(vocabSlug('plantType', plant.plantType!)); }}
                  accessibilityRole="link"
                  accessibilityLabel={`Define ${humanize(plant.plantType)}`}>
                  <View style={[styles.typeChip, { backgroundColor: c.surfaceSunken }]}>
                    <Text variant="overline">{PLANT_TYPE_EMOJI[plant.plantType] ?? '🌱'}</Text>
                    <Text variant="overline" style={styles.linkUnderline}>{humanize(plant.plantType)}</Text>
                  </View>
                </Pressable>
              ) : null}
              {plant.nativeBiome ? (
                <Pressable
                  onPress={() => { haptics.select(); setTermSlug(vocabSlug('biome', plant.nativeBiome!)); }}
                  accessibilityRole="link"
                  accessibilityLabel={`Define ${humanize(plant.nativeBiome)}`}>
                  <View style={[styles.typeChip, { backgroundColor: c.surfaceSunken }]}>
                    <Text variant="overline" style={styles.linkUnderline}>{humanize(plant.nativeBiome)}</Text>
                  </View>
                </Pressable>
              ) : null}
              <View style={[styles.typeChip, { backgroundColor: c.surfaceSunken }]}>
                <Text variant="overline">Difficulty {plant.difficulty}/5</Text>
              </View>
            </View>

            {/* Compatibility callout — planner only, shown when conflicts exist */}
            {context === 'planner' && conflicts.length > 0 ? (
              <View style={[styles.conflictBox, { borderColor: c.accent, backgroundColor: c.surfaceSunken }]}>
                <Text variant="caption" role="accent" style={styles.conflictTitle}>
                  Compatibility concerns
                </Text>
                {conflicts.map((cf, i) => (
                  <View key={i} style={styles.conflictRow}>
                    <View style={[styles.dot, { backgroundColor: cf.severity === 'incompatible' ? c.accent : c.sage }]} />
                    <Text variant="caption" role="textMuted" style={styles.conflictMsg}>
                      <Text variant="caption">{cf.withPlantName}</Text> — {cf.message}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Tier 2 — care requirements (always visible) */}
            <SectionLabel>Care requirements</SectionLabel>
            <StatStrip items={tier2Stats(plant)} onPressTerm={setTermSlug} />

            {/* Tier 3 toggle */}
            <Pressable
              onPress={() => { haptics.select(); setTier3Open((o) => !o); }}
              accessibilityRole="button"
              style={styles.tier3Toggle}>
              <Text variant="caption" role="primary">
                {tier3Open ? 'Hide full profile ▲' : 'Full profile ▼'}
              </Text>
            </Pressable>

            {/* Tier 3 — expanded detail */}
            {tier3Open ? (
              <View style={styles.tier3}>
                {tier3Stats(plant).length > 0 ? (
                  <>
                    <SectionLabel>Full profile</SectionLabel>
                    <StatStrip items={tier3Stats(plant)} onPressTerm={setTermSlug} />
                  </>
                ) : null}

                {plant.nativeContext ? (
                  <>
                    <SectionLabel>Origin</SectionLabel>
                    <GlossaryText
                      text={plant.nativeContext}
                      onPressTerm={setTermSlug}
                      style={styles.bodyBlock}
                    />
                  </>
                ) : null}

                {plant.notes ? (
                  <>
                    <SectionLabel>Notes</SectionLabel>
                    <GlossaryText text={plant.notes} onPressTerm={setTermSlug} style={styles.bodyBlock} />
                  </>
                ) : null}

                {plant.toxicity ? (
                  <View style={[styles.toxBox, { borderColor: c.accent }]}>
                    <View style={styles.toxHead}>
                      <View style={[styles.toxDot, { backgroundColor: c.accent }]} />
                      <Text variant="caption" role="accent">Handling note</Text>
                    </View>
                    <Text variant="body">{plant.toxicity}</Text>
                  </View>
                ) : null}

                {plant.sources && plant.sources.length > 0 ? (
                  <>
                    <SectionLabel>Sources</SectionLabel>
                    <View style={styles.sources}>
                      {plant.sources.map((source, i) => (
                        <Pressable
                          key={i}
                          onPress={() => {
                            haptics.select();
                            WebBrowser.openBrowserAsync(source.url).catch(() => {});
                          }}
                          accessibilityRole="link"
                          accessibilityLabel={`Open source: ${sourceLabel(source)}`}
                          style={styles.sourceRow}>
                          <View style={[styles.sourceDot, { backgroundColor: c.primary }]} />
                          <Text variant="caption" role="primary" style={styles.sourceLink}>
                            {sourceLabel(source)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky footer — planner context only */}
          {context === 'planner' ? (
            <Pressable
              onPress={handleToggle}
              accessibilityRole="button"
              style={[
                styles.addBtn,
                { backgroundColor: isSelected ? c.accent : c.primary },
              ]}>
              <Text variant="caption" style={{ color: c.onPrimary }}>
                {isSelected ? 'Remove from build' : 'Add to build'}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </BottomSheet>
    <TermSheet slug={termSlug} onClose={() => setTermSlug(null)} />
    </>
  );
}

function tier2Stats(plant: Plant): Stat[] {
  return [
    { label: 'Light', value: lightLabel(plant.light), slug: vocabSlug('light', plant.light.primary) },
    { label: 'Soil', value: moistureLabel(plant.soilMoisture), slug: vocabSlug('moisture', plant.soilMoisture.primary) },
    { label: 'Humidity', value: `${plant.humidityPctRange[0]}–${plant.humidityPctRange[1]}%` },
    { label: 'Temperature', value: `${plant.tempCRange[0]}–${plant.tempCRange[1]}°C` },
    { label: 'Max height', value: `${plant.maxHeightCm} cm` },
    { label: 'Growth rate', value: humanize(plant.growthRate), slug: vocabSlug('growthRate', plant.growthRate) },
    { label: 'Suitability', value: suitabilityLabel(plant.closedTerrariumOk, plant.openTerrariumOk) },
  ];
}

function tier3Stats(plant: Plant): Stat[] {
  const stats: Stat[] = [];
  if (plant.phPreference) {
    const range =
      plant.soilPhMin != null && plant.soilPhMax != null
        ? ` (${plant.soilPhMin}–${plant.soilPhMax})`
        : '';
    stats.push({ label: 'pH', value: `${humanize(plant.phPreference)}${range}`, slug: vocabSlug('ph', plant.phPreference) });
  }
  if (plant.rootDepthMinCm != null && plant.rootDepthMaxCm != null) {
    stats.push({ label: 'Root depth', value: `${plant.rootDepthMinCm}–${plant.rootDepthMaxCm} cm` });
  }
  if (plant.growthHabit) {
    stats.push({ label: 'Habit', value: humanize(plant.growthHabit), slug: vocabSlug('growthHabit', plant.growthHabit) });
  }
  if (plant.rarity) stats.push({ label: 'Rarity', value: humanize(plant.rarity) });
  if (plant.spreadMinCm != null || plant.spreadMaxCm != null) {
    const min = plant.spreadMinCm ?? '?';
    const max = plant.spreadMaxCm ?? '?';
    stats.push({ label: 'Spread', value: `${min}–${max} cm` });
  }
  return stats;
}

const styles = StyleSheet.create({
  scrollContent: { gap: Spacing.md, paddingBottom: Spacing.sm },
  sci: { fontStyle: 'italic', marginTop: -Spacing.xs },
  headerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  linkUnderline: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radii.pill,
  },
  conflictBox: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  conflictTitle: { marginBottom: Spacing.xs },
  conflictRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: Radii.pill, marginTop: 4, flexShrink: 0 },
  conflictMsg: { flex: 1, lineHeight: 18 },
  tier3Toggle: { alignSelf: 'flex-start' },
  tier3: { gap: Spacing.md },
  bodyBlock: { lineHeight: 22 },
  toxBox: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.md, gap: Spacing.sm },
  sources: { gap: Spacing.sm },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sourceDot: { width: 5, height: 5, borderRadius: Radii.pill, flexShrink: 0 },
  sourceLink: { flex: 1, textDecorationLine: 'underline' },
  toxHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toxDot: { width: 9, height: 9, borderRadius: Radii.pill },
  addBtn: {
    borderRadius: Radii.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
});
