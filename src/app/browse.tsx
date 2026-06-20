/**
 * Browse — the filterable plant database. Port of v1 `pages/browse.py`, reshaped
 * from a desktop table + dropdown wall into search + tappable chip facets over the
 * seed bundle.
 *
 * Filters: **type / biome / light / difficulty** + free-text search — all run
 * through the pure, unit-tested `filterPlants`. **Toxicity is display-only:** a
 * card carries a handling-note indicator only when a note exists (icon + word, never
 * colour alone), and a blank note is NEVER rendered as "Non-toxic ✓" — absence
 * means "no note," not "safe." "Suggest a plant" opens a mailto — no in-app
 * community or backend.
 *
 * Plant detail is a shared PlantSheet (context='browse') — tapping a row opens the
 * sheet in place rather than navigating to /plant/[slug].
 *
 * Reads the seed bundle directly (no DB round-trip for the catalog).
 */
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, GlanceHeader, Screen, SectionLabel, Text } from '@/components/ui';
import { PlantSheet } from '@/components/plant-sheet';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadPlants } from '@/data';
import { type BrowseSort, filterPlants } from '@/logic/browse-filter';
import { LIGHT_LEVELS, NATIVE_BIOMES, PLANT_TYPES, type Plant } from '@/types/plant';
import { humanize } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';

const SUGGEST_EMAIL = 'pankernaught@gmail.com';
const DIFFICULTIES = [1, 2, 3, 4, 5];
const SORTS: { value: BrowseSort; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'height', label: 'Height' },
];

export default function BrowseScreen() {
  const { c } = useTokens();
  const plants = useMemo(() => loadPlants(), []);

  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [biomes, setBiomes] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<number[]>([]);
  const [sort, setSort] = useState<BrowseSort>('name');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetPlant, setSheetPlant] = useState<(typeof plants)[0] | null>(null);

  const results = useMemo(
    () => filterPlants(plants, { search, types, biomes, lights, difficulties, sort }),
    [plants, search, types, biomes, lights, difficulties, sort],
  );
  const activeFilters = types.length + biomes.length + lights.length + difficulties.length;

  function toggle<T>(list: T[], set: (v: T[]) => void, value: T) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }
  function clearAll() {
    setTypes([]);
    setBiomes([]);
    setLights([]);
    setDifficulties([]);
  }

  function suggestPlant() {
    const subject = encodeURIComponent('Terrarium Planner — plant suggestion');
    const body = encodeURIComponent('Plant (common + scientific name):\n\nWhy it belongs / source:\n');
    Linking.openURL(`mailto:${SUGGEST_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <GlanceHeader
            title="Browse"
            subtitle={`${results.length} of ${plants.length} plants`}
          />

          {/* Search */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name…"
            placeholderTextColor={c.textMuted}
            style={[styles.search, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search plants"
          />

          {/* Filters toggle + sort */}
          <View style={styles.controlRow}>
            <Pressable onPress={() => setFiltersOpen((o) => !o)} accessibilityRole="button" hitSlop={6}>
              <Chip
                label={activeFilters > 0 ? `Filters · ${activeFilters}` : 'Filters'}
                tone={activeFilters > 0 ? 'primary' : 'neutral'}
                selected={activeFilters > 0}
              />
            </Pressable>
            <View style={styles.sortGroup}>
              {SORTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  tone="sage"
                  selected={sort === s.value}
                  onPress={() => setSort(s.value)}
                />
              ))}
            </View>
          </View>

          {filtersOpen ? (
            <Card style={styles.filterCard}>
              <FacetGroup label="Type" options={PLANT_TYPES} selected={types} onToggle={(v) => toggle(types, setTypes, v)} />
              <FacetGroup label="Biome" options={NATIVE_BIOMES} selected={biomes} onToggle={(v) => toggle(biomes, setBiomes, v)} />
              <FacetGroup label="Light" options={LIGHT_LEVELS} selected={lights} onToggle={(v) => toggle(lights, setLights, v)} />
              <View style={styles.facet}>
                <SectionLabel>Difficulty</SectionLabel>
                <View style={styles.chipWrap}>
                  {DIFFICULTIES.map((d) => (
                    <Chip
                      key={d}
                      label={String(d)}
                      tone="sage"
                      selected={difficulties.includes(d)}
                      onPress={() => toggle(difficulties, setDifficulties, d)}
                    />
                  ))}
                </View>
              </View>
              {activeFilters > 0 ? (
                <Pressable onPress={clearAll} accessibilityRole="button" hitSlop={6} style={styles.clear}>
                  <Text variant="caption" role="primary">
                    Clear filters
                  </Text>
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          {/* Results */}
          {results.length === 0 ? (
            <Card style={styles.empty}>
              <Text variant="subhead">No plants match</Text>
              <Text variant="body" role="textMuted">
                Try broadening your search or clearing a filter.
              </Text>
            </Card>
          ) : (
            <View style={styles.list}>
              {results.map((p) => (
                <PlantRow key={p.slug} plant={p} onPress={() => setSheetPlant(p)} />
              ))}
            </View>
          )}

          {/* Suggest a plant — opens a mailto. */}
          <Pressable onPress={suggestPlant} accessibilityRole="button" style={styles.suggest}>
            <Text variant="caption" role="primary">
              Missing a plant? Suggest one →
            </Text>
            <Text variant="overline" role="textMuted">
              The catalog is curator-maintained
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <PlantSheet
        plant={sheetPlant}
        onClose={() => setSheetPlant(null)}
        context="browse"
      />
    </Screen>
  );
}

function FacetGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={styles.facet}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.chipWrap}>
        {options.map((o) => (
          <Chip key={o} label={humanize(o)} tone="sage" selected={selected.includes(o)} onPress={() => onToggle(o)} />
        ))}
      </View>
    </View>
  );
}

function PlantRow({ plant, onPress }: { plant: Plant; onPress: () => void }) {
  const { c } = useTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${plant.commonName}`}>
      <Card style={styles.row}>
        <View style={styles.rowHead}>
          <View style={styles.rowTitle}>
            <Text variant="subhead" numberOfLines={1}>
              {plant.commonName}
            </Text>
            <Text variant="caption" role="textMuted" numberOfLines={1} style={styles.sci}>
              {plant.scientificName}
            </Text>
          </View>
          {/* Toxicity indicator — shown ONLY when a note exists; icon + word, never
              colour alone; absence is never rendered as a "safe" claim. */}
          {plant.toxicity ? (
            <View style={[styles.toxPill, { backgroundColor: c.surfaceSunken }]}>
              <View style={[styles.toxDot, { backgroundColor: c.accent }]} />
              <Text variant="overline" role="accent">
                Handling note
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowChips}>
          <Chip label={humanize(plant.light.primary)} tone="neutral" />
          <Chip label={humanize(plant.soilMoisture.primary)} tone="neutral" />
          <Chip label={`Difficulty ${plant.difficulty}`} tone="neutral" />
        </View>
        <Text variant="caption" role="textMuted">
          {plant.humidityPctRange[0]}–{plant.humidityPctRange[1]}% RH · {plant.tempCRange[0]}–{plant.tempCRange[1]}°C · ≤{plant.maxHeightCm} cm
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.md, paddingTop: Spacing.md },
  search: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: 16 },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  sortGroup: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  filterCard: { padding: Spacing.lg, gap: Spacing.md },
  facet: { gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  clear: { alignSelf: 'flex-start', paddingTop: Spacing.xs },
  empty: { padding: Spacing.lg, gap: Spacing.sm },
  list: { gap: Spacing.md },
  row: { padding: Spacing.md, gap: Spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  rowTitle: { flexShrink: 1, gap: 2 },
  sci: { fontStyle: 'italic' },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  toxPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.pill },
  toxDot: { width: 7, height: 7, borderRadius: Radii.pill },
  suggest: { alignItems: 'center', gap: 2, paddingVertical: Spacing.lg },
});
