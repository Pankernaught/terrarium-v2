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
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Card, Chip, GlanceHeader, Screen, SectionLabel, Text } from '@/components/ui';
import { PlantSheet } from '@/components/plant-sheet';
import { TermSheet } from '@/components/term-sheet';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { loadGlossary, loadPlants } from '@/data';
import { type BrowseSort, filterPlants } from '@/logic/browse-filter';
import { filterGlossary } from '@/logic/glossary-filter';
import { LIGHT_LEVELS, NATIVE_BIOMES, PLANT_TYPES, type Plant } from '@/types/plant';
import { GLOSSARY_CATEGORIES, GLOSSARY_CATEGORY_LABELS, type GlossaryEntry } from '@/types';
import { humanize } from '@/lib/labels';
import { useTokens } from '@/hooks/use-tokens';

type BrowseMode = 'plants' | 'terms';

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
  const glossary = useMemo(() => loadGlossary(), []);

  const [mode, setMode] = useState<BrowseMode>('plants');

  const [search, setSearch] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [biomes, setBiomes] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<number[]>([]);
  const [sort, setSort] = useState<BrowseSort>('name');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheetPlant, setSheetPlant] = useState<(typeof plants)[0] | null>(null);

  // Terms mode: search + category chips → TermSheet (by slug).
  const [termSearch, setTermSearch] = useState('');
  const [termCats, setTermCats] = useState<string[]>([]);
  const [termSlug, setTermSlug] = useState<string | null>(null);

  const results = useMemo(
    () => filterPlants(plants, { search, types, biomes, lights, difficulties, sort }),
    [plants, search, types, biomes, lights, difficulties, sort],
  );
  const activeFilters = types.length + biomes.length + lights.length + difficulties.length;

  const termResults = useMemo(
    () => filterGlossary(glossary, { search: termSearch, categories: termCats }),
    [glossary, termSearch, termCats],
  );

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

  // Stable renderers — the row components are memoized, so renderItem must not be
  // re-created on every keystroke (it would defeat the memo). Pressed plant/slug is
  // delivered via the stable state setters, not a fresh closure per row.
  const renderPlant = useCallback(
    ({ item }: { item: Plant }) => <PlantRow plant={item} onPress={setSheetPlant} />,
    [],
  );
  const renderTerm = useCallback(
    ({ item }: { item: GlossaryEntry }) => <TermRow entry={item} onPress={setTermSlug} />,
    [],
  );

  // Shared top chrome (header + mode toggle). Lives inside each list's header so it
  // scrolls with the content, as before. Built as a plain element tree of stable
  // component types so the search TextInput below it never remounts (focus loss).
  const topChrome = (
    <>
      <GlanceHeader
        title="Browse"
        subtitle={
          mode === 'plants'
            ? `${results.length} of ${plants.length} plants`
            : `${termResults.length} of ${glossary.length} terms`
        }
      />
      {/* Plants | Terms mode toggle — a glossary does not earn its own nav tab. */}
      <View style={styles.modeToggle}>
        <Chip label="Plants" tone="primary" selected={mode === 'plants'} onPress={() => setMode('plants')} />
        <Chip label="Terms" tone="primary" selected={mode === 'terms'} onPress={() => setMode('terms')} />
      </View>
    </>
  );

  return (
    <Screen>
      {mode === 'terms' ? (
        <FlatList
          data={termResults}
          keyExtractor={(t) => t.slug}
          renderItem={renderTerm}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {topChrome}
              <TextInput
                value={termSearch}
                onChangeText={setTermSearch}
                placeholder="Search terms…"
                placeholderTextColor={c.textMuted}
                style={[styles.search, { backgroundColor: c.surface, borderColor: c.border, color: c.text }]}
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search glossary terms"
              />
              <View style={styles.chipWrap}>
                {GLOSSARY_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    label={GLOSSARY_CATEGORY_LABELS[cat]}
                    tone="sage"
                    selected={termCats.includes(cat)}
                    onPress={() => toggle(termCats, setTermCats, cat)}
                  />
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.empty}>
              <Text variant="subhead">No terms match</Text>
              <Text variant="body" role="textMuted">
                Try a different search or clear a category.
              </Text>
            </Card>
          }
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.slug}
          renderItem={renderPlant}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          windowSize={7}
          removeClippedSubviews
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {topChrome}
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
            </View>
          }
          ListEmptyComponent={
            <Card style={styles.empty}>
              <Text variant="subhead">No plants match</Text>
              <Text variant="body" role="textMuted">
                Try broadening your search or clearing a filter.
              </Text>
            </Card>
          }
          ListFooterComponent={
            /* Suggest a plant — opens a mailto. */
            <Pressable onPress={suggestPlant} accessibilityRole="button" style={styles.suggest}>
              <Text variant="caption" role="primary">
                Missing a plant? Suggest one →
              </Text>
              <Text variant="overline" role="textMuted">
                The catalog is curator-maintained
              </Text>
            </Pressable>
          }
        />
      )}

      <PlantSheet
        plant={sheetPlant}
        onClose={() => setSheetPlant(null)}
        context="browse"
      />
      <TermSheet slug={termSlug} onClose={() => setTermSlug(null)} />
    </Screen>
  );
}

/** Item separator carrying the inter-row gap FlatList can't express via `gap`. */
function Separator() {
  return <View style={styles.separator} />;
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

const PlantRow = memo(function PlantRow({
  plant,
  onPress,
}: {
  plant: Plant;
  onPress: (plant: Plant) => void;
}) {
  const { c } = useTokens();
  return (
    <Pressable onPress={() => onPress(plant)} accessibilityRole="button" accessibilityLabel={`Open ${plant.commonName}`}>
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
});

const TermRow = memo(function TermRow({
  entry,
  onPress,
}: {
  entry: GlossaryEntry;
  onPress: (slug: string) => void;
}) {
  return (
    <Pressable onPress={() => onPress(entry.slug)} accessibilityRole="button" accessibilityLabel={`Define ${entry.term}`}>
      <Card style={styles.row}>
        <View style={styles.rowHead}>
          <Text variant="subhead" numberOfLines={1} style={styles.termRowTitle}>
            {entry.term}
          </Text>
          <Chip label={GLOSSARY_CATEGORY_LABELS[entry.category]} tone="neutral" />
        </View>
        <Text variant="caption" role="textMuted" numberOfLines={2}>
          {entry.definition}
        </Text>
      </Card>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  // FlatList content container — carries the centering + max-width the old `inner`
  // wrapper did, plus the screen's top/bottom breathing room.
  listContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  // The list header (chrome above the rows) keeps its own vertical rhythm via gap,
  // and a bottom margin to stand off the first row (separators only sit between rows).
  headerBlock: { gap: Spacing.md, marginBottom: Spacing.md },
  separator: { height: Spacing.md },
  search: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: 16 },
  modeToggle: { flexDirection: 'row', gap: Spacing.sm },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  termRowTitle: { flexShrink: 1 },
  sortGroup: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  filterCard: { padding: Spacing.lg, gap: Spacing.md },
  facet: { gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  clear: { alignSelf: 'flex-start', paddingTop: Spacing.xs },
  empty: { padding: Spacing.lg, gap: Spacing.sm },
  row: { padding: Spacing.md, gap: Spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  rowTitle: { flexShrink: 1, gap: 2 },
  sci: { fontStyle: 'italic' },
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  toxPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radii.pill },
  toxDot: { width: 7, height: 7, borderRadius: Radii.pill },
  suggest: { alignItems: 'center', gap: 2, paddingVertical: Spacing.lg },
});
