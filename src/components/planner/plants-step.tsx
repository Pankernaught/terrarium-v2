/**
 * Plants step — the signature interaction. Visual data hierarchy
 * redesign: catalog is now a sorted list of rows (name + type icon + fit signal +
 * ⓘ), the "Suggested companions" card is retired (fit sort surfaces best matches
 * at the top), and plant detail lives in a shared PlantSheet rather than
 * navigating away.
 *
 * Sorting: compatibility score desc → alpha by default when fit context exists
 * (container or selected plants set). User can override to name/difficulty/height.
 * Filter panel mirrors Browse (type / biome / light / difficulty + search).
 *
 * Drag-to-place itself lives in the persistent {@link PlannerPreview}; this body
 * owns selection + live compatibility read-outs.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Image } from 'expo-image';

import { Card, Chip, haptics, RangeSlider, SectionLabel, Text } from '@/components/ui';
import { PlantSheet } from '@/components/plant-sheet';
import { EcoVerdictCard, type EcoRosterRow } from './eco-verdict-card';
import { PLANT_IMAGES } from '@/data/plant-images';
import { Radii, Spacing } from '@/constants/theme';
import { loadPlants } from '@/data';
import { useTokens } from '@/hooks/use-tokens';
import { resolveBuildContainer } from '@/logic/containers';
import { ecoColor } from '@/logic/eco';
import { defaultPlacement, removePlacement, upsertPlacement } from '@/logic/placement';
import { plantFitScore } from '@/logic/recommend';
import { scoreBuild } from '@/logic/score-build';
import { filterPlants, type BrowseCriteria, type BrowseSort } from '@/logic/browse-filter';
import { deriveConsensus, scorePlantVsConsensus } from '@/logic/compatibility';
import { humanize } from '@/lib/labels';
import { usePreferences } from '@/hooks/use-preferences';
import { fmtLength, fmtTemp } from '@/logic/units';
import { LIGHT_LEVELS, NATIVE_BIOMES, PLANT_TYPES, type Plant } from '@/types/plant';
import type { Conflict, Container } from '@/types';

import type { StepProps } from './step';

type CatalogSort = 'fit' | BrowseSort;

const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'fit', label: 'Best fit' },
  { value: 'name', label: 'Name' },
  { value: 'difficulty', label: 'Care level' },
  { value: 'height', label: 'Height' },
];
const DIFFICULTIES = [1, 2, 3, 4, 5];
// ponytail: cap rendered rows so the un-virtualized list (201 plants) can't jank
// the planner's single page ScrollView. Fit-sort + selected-first put the best
// matches on top; the tail is reachable via search/filter or the Browse tab.
// Lift this if users complain they can't scroll the full catalog here.
const CATALOG_CAP = 50;
const TEMP_MIN = 5, TEMP_MAX = 35;
const HUMID_MIN = 10, HUMID_MAX = 100;
const HEIGHT_MIN = 0, HEIGHT_MAX = 100;

/** A plant's conflicts against the build consensus (ADR 0017). A selected plant is
 * scored against the consensus that includes it (matching the roster); an unselected
 * candidate against the consensus of the current selection. Worst-first (scorer-sorted). */
function getConflicts(candidate: Plant, selected: Plant[], container: Container | null): Conflict[] {
  if (selected.length === 0 && !container) return [];
  return scorePlantVsConsensus(candidate, deriveConsensus(selected), container ?? undefined).conflicts;
}
let placementCounter = 0;
export function PlantsStep({ draft, plants, update }: StepProps) {
  const { c, scheme } = useTokens();
  const { units } = usePreferences();

  // Refs keep the stable togglePlant callback from capturing stale closures.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const updateRef = useRef(update);
  updateRef.current = update;

  const catalog = useMemo(() => loadPlants(), []);
  const container = useMemo(() => resolveBuildContainer(draft), [draft]);
  const headroomCm = useMemo(() => {
    const dims = draft.containerDimensions;
    if (!dims?.height) return null;
    const layers = (draft.substrateDepth ?? 0) + (draft.drainageDepth ?? 0) + (draft.charcoalDepth ?? 0);
    return Math.max(0, dims.height - layers);
  }, [draft]);

  // --- Filter / sort state (mirrors Browse) ---
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [biomes, setBiomes] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<number[]>([]);
  const [tempRange, setTempRange] = useState<[number, number]>([TEMP_MIN, TEMP_MAX]);
  const [humidRange, setHumidRange] = useState<[number, number]>([HUMID_MIN, HUMID_MAX]);
  const [heightRange, setHeightRange] = useState<[number, number]>([HEIGHT_MIN, HEIGHT_MAX]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const hasFitContext = container != null || plants.length > 0;
  const [sort, setSort] = useState<CatalogSort>(hasFitContext ? 'fit' : 'name');
  const tempActive = tempRange[0] > TEMP_MIN || tempRange[1] < TEMP_MAX;
  const humidActive = humidRange[0] > HUMID_MIN || humidRange[1] < HUMID_MAX;
  const heightActive = heightRange[0] > HEIGHT_MIN || heightRange[1] < HEIGHT_MAX;
  const activeFilters = types.length + biomes.length + lights.length + difficulties.length + (tempActive ? 1 : 0) + (humidActive ? 1 : 0) + (heightActive ? 1 : 0);

  // Switch default to 'fit' when fit context first becomes available.
  useEffect(() => {
    if (hasFitContext && sort === 'name') setSort('fit');
    // Only run when hasFitContext flips to true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFitContext]);

  function toggleFilter<T>(list: T[], set: (v: T[]) => void, value: T) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }
  function clearFilters() {
    setTypes([]); setBiomes([]); setLights([]); setDifficulties([]);
    setTempRange([TEMP_MIN, TEMP_MAX]);
    setHumidRange([HUMID_MIN, HUMID_MAX]);
    setHeightRange([HEIGHT_MIN, HEIGHT_MAX]);
  }

  // --- Plant sheet state ---
  const [sheetPlant, setSheetPlant] = useState<Plant | null>(null);

  // Defer the ~100-row catalog until after the step transition settles. The step
  // mounts fresh on every tap into Plants; rendering every row synchronously on
  // mount janks the transition. Eco bar + search + filters paint instantly; rows
  // pop in the next interaction frame.
  const [rowsReady, setRowsReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setRowsReady(true));
    return () => task.cancel();
  }, []);

  // --- Fit scores for every catalog plant ---
  const fitScores = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of catalog) {
      map.set(p.slug, plantFitScore(p, plants, container));
    }
    return map;
  }, [catalog, plants, container]);

  // --- Filtered + sorted catalog ---
  const browseCriteria: BrowseCriteria = {
    search: query,
    types: types.length ? types : undefined,
    biomes: biomes.length ? biomes : undefined,
    lights: lights.length ? lights : undefined,
    difficulties: difficulties.length ? difficulties : undefined,
    tempRange: tempActive ? tempRange : undefined,
    humidRange: humidActive ? humidRange : undefined,
    heightRange: heightActive ? heightRange : undefined,
    matchMode,
    sort: sort === 'fit' ? 'name' : sort,
  };
  const filtered = useMemo(() => {
    const base = filterPlants(catalog, browseCriteria);
    const byFit = sort === 'fit'
      ? [...base].sort((a, b) => {
          const fa = fitScores.get(a.slug) ?? -1;
          const fb = fitScores.get(b.slug) ?? -1;
          return fb !== fa ? fb - fa : a.commonName.localeCompare(b.commonName);
        })
      : base;
    // Selected plants always appear first; secondary order within each group is preserved.
    const selected = new Set(draft.plantSlugs);
    return [...byFit].sort((a, b) => +!selected.has(a.slug) - +!selected.has(b.slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, query, types, biomes, lights, difficulties, matchMode, tempRange, humidRange, heightRange, sort, fitScores, draft.plantSlugs]);

  const selectedSlugs = new Set(draft.plantSlugs);

  // --- Live eco-balance ---
  const scored = useMemo(() => scoreBuild(draft, catalog), [draft, catalog]);
  // Critical band ⇒ a plant will die here (a survival-clamped plant, a survival
  // split, or overcrowding) — the haptic nudge the amber roster rows back up.
  const survivalCritical = scored.band === 'critical';

  // Survival-critical builds get a haptic nudge (the visual cue is the amber roster rows).
  useEffect(() => {
    if (survivalCritical) haptics.warn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survivalCritical]);

  // Roster rows for the verdict card: each selected plant + its fit + its conflicts
  // vs the build consensus. Read straight from the scored report so the roster and
  // the build score can never disagree.
  const rosterRows: EcoRosterRow[] = useMemo(() => {
    const conflictsBySlug = new Map((scored.report?.plantScores ?? []).map((ps) => [ps.slug, ps.conflicts]));
    return plants.map((p) => ({ plant: p, fit: fitScores.get(p.slug) ?? null, conflicts: conflictsBySlug.get(p.slug) ?? [] }));
  }, [plants, fitScores, scored.report]);

  // --- Add / remove ---
  // ponytail: stable via refs — memo on PlantCatalogRow skips re-renders when
  // eco score / filters / sheet state change (only selected/fitScore props trigger).
  const togglePlant = useCallback((slug: string) => {
    const d = draftRef.current;
    const upd = updateRef.current;
    haptics.select();
    if (d.plantSlugs.includes(slug)) {
      upd({ plantSlugs: d.plantSlugs.filter((s) => s !== slug), placements: removePlacement(d.placements, slug) });
    } else {
      placementCounter++;
      upd({ plantSlugs: [...d.plantSlugs, slug], placements: upsertPlacement(d.placements, defaultPlacement(slug, placementCounter)) });
    }
  }, []);

  return (
    <View style={styles.root}>
      {/* Live Eco-balance verdict card (ADR 0016): score ring + band/loop status over
          a per-plant roster. Grows with the build — the catalog reflows below it. */}
      <EcoVerdictCard
        scored={scored}
        rows={rosterRows}
        opening={draft.containerOpening}
        consensus={scored.report?.consensus}
        onPlantInfo={setSheetPlant}
        onPlantRemove={(p) => togglePlant(p.slug)}
      />

      {/* Catalog — search + filter + sorted rows */}
      <Card style={styles.card}>
        <SectionLabel>Add plants</SectionLabel>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plants…"
          placeholderTextColor={c.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search plants"
          style={[styles.search, { backgroundColor: c.surfaceSunken, borderColor: c.border, color: c.text }]}
        />

        {/* Filter toggle + sort chips */}
        <View style={styles.controlRow}>
          <Pressable onPress={() => setFiltersOpen((o) => !o)} accessibilityRole="button" hitSlop={6}>
            <Chip
              label={activeFilters > 0 ? `Filters · ${activeFilters}` : 'Filters'}
              tone={activeFilters > 0 ? 'primary' : 'neutral'}
              selected={activeFilters > 0}
            />
          </Pressable>
          <View style={styles.sortGroup}>
            {CATALOG_SORTS.filter((s) => s.value !== 'fit' || hasFitContext).map((s) => {
              const directable = s.value === 'name' || s.value === 'difficulty';
              const isActive = sort === s.value || sort === `${s.value}-desc`;
              const isDesc = sort === `${s.value}-desc`;
              return (
                <Chip
                  key={s.value}
                  label={directable && isActive ? `${s.label} ${isDesc ? '↓' : '↑'}` : s.label}
                  tone="sage"
                  selected={isActive}
                  onPress={() => {
                    if (directable && isActive && !isDesc) setSort(`${s.value}-desc` as CatalogSort);
                    else setSort(s.value);
                  }}
                />
              );
            })}
          </View>
        </View>

        {filtersOpen ? (
          <View style={styles.filterPanel}>
            <FacetGroup label="Type" options={PLANT_TYPES} selected={types} onToggle={(v) => toggleFilter(types, setTypes, v)} />
            <FacetGroup label="Biome" options={NATIVE_BIOMES} selected={biomes} onToggle={(v) => toggleFilter(biomes, setBiomes, v)} />
            <FacetGroup label="Light" options={LIGHT_LEVELS} selected={lights} onToggle={(v) => toggleFilter(lights, setLights, v)} />
            <View style={styles.facet}>
              <SectionLabel>Care level</SectionLabel>
              <View style={styles.chipWrap}>
                {DIFFICULTIES.map((d) => (
                  <Chip
                    key={d}
                    label={String(d)}
                    tone="sage"
                    selected={difficulties.includes(d)}
                    onPress={() => toggleFilter(difficulties, setDifficulties, d)}
                  />
                ))}
              </View>
            </View>
            <RangeSlider
              label="Temperature"
              min={TEMP_MIN}
              max={TEMP_MAX}
              values={tempRange}
              onChange={setTempRange}
              format={(v) => fmtTemp(v, units)}
            />
            <RangeSlider
              label="Humidity"
              min={HUMID_MIN}
              max={HUMID_MAX}
              values={humidRange}
              onChange={setHumidRange}
              format={(v) => `${v}%`}
            />
            <RangeSlider
              label="Size"
              min={HEIGHT_MIN}
              max={HEIGHT_MAX}
              values={heightRange}
              onChange={setHeightRange}
              format={(v) => fmtLength(v, units)}
            />
            <View style={styles.facet}>
              <SectionLabel>Match</SectionLabel>
              <View style={styles.chipWrap}>
                <Chip label="All filters" tone="sage" selected={matchMode === 'all'} onPress={() => setMatchMode('all')} />
                <Chip label="Any filter" tone="sage" selected={matchMode === 'any'} onPress={() => setMatchMode('any')} />
              </View>
            </View>
            {activeFilters > 0 ? (
              <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={6} style={styles.clearFilters}>
                <Text variant="caption" role="primary">Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Catalog rows — deferred one frame past mount (see rowsReady). */}
        <View style={styles.catalogList}>
          {!rowsReady ? (
            <ActivityIndicator color={c.textMuted} style={styles.catalogLoading} />
          ) : filtered.length === 0 ? (
            <Text variant="caption" role="textMuted">
              No plants match{query.trim() ? ` "${query.trim()}"` : ' these filters'}.
            </Text>
          ) : (
            <>
              {filtered.slice(0, CATALOG_CAP).map((p) => (
                <PlantCatalogRow
                  key={p.slug}
                  plant={p}
                  selected={selectedSlugs.has(p.slug)}
                  fitScore={fitScores.get(p.slug) ?? null}
                  tooTall={headroomCm != null && p.maxHeightCm > headroomCm}
                  scheme={scheme}
                  onToggle={togglePlant}
                  onInfo={setSheetPlant}
                />
              ))}
              {filtered.length > CATALOG_CAP ? (
                <Text variant="caption" role="textMuted" style={styles.catalogMore}>
                  Showing {CATALOG_CAP} of {filtered.length} — search or filter to narrow, or browse the full library in Plants.
                </Text>
              ) : null}
            </>
          )}
        </View>
      </Card>

      {/* Plant detail sheet */}
      <PlantSheet
        plant={sheetPlant}
        onClose={() => setSheetPlant(null)}
        context="planner"
        isSelected={sheetPlant ? selectedSlugs.has(sheetPlant.slug) : false}
        onToggle={() => {
          if (sheetPlant) togglePlant(sheetPlant.slug);
        }}
        conflicts={sheetPlant ? getConflicts(sheetPlant, plants, container) : []}
      />
    </View>
  );
}

// --- Sub-components ---------------------------------------------------------

const PLANT_TYPE_EMOJI: Record<string, string> = {
  fern: '🌿',
  'fern-ally': '🌾',
  moss: '🌱',
  succulent: '🪴',
  carnivorous: '🪤',
  aroid: '🍃',
  begonia: '🌺',
  orchid: '🌸',
  vine: '🌿',
  'ground-cover': '🌱',
  foliage: '🍃',
};

const PlantCatalogRow = memo(function PlantCatalogRow({
  plant,
  selected,
  fitScore,
  tooTall,
  scheme,
  onToggle,
  onInfo,
}: {
  plant: Plant;
  selected: boolean;
  fitScore: number | null;
  tooTall: boolean;
  scheme: 'light' | 'dark';
  onToggle: (slug: string) => void;
  onInfo: (plant: Plant) => void;
}) {
  const { c } = useTokens();
  const emoji = plant.plantType ? (PLANT_TYPE_EMOJI[plant.plantType] ?? '🌱') : '🌱';
  const photo = PLANT_IMAGES[plant.slug];
  const fitColor = fitScore != null ? ecoColor(fitScore, scheme) : null;

  return (
    <Pressable
      onPress={() => onToggle(plant.slug)}
      accessibilityRole="button"
      accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${plant.commonName}`}>
      <View
        style={[
          styles.catalogRow,
          {
            backgroundColor: selected ? c.surfaceSunken : c.surface,
            borderColor: selected ? c.sage : c.border,
          },
        ]}>
        {photo != null ? (
          <Image source={photo} style={styles.rowThumb} contentFit="cover" />
        ) : (
          <Text style={styles.rowEmoji}>{emoji}</Text>
        )}
        <View style={styles.rowNames}>
          <Text variant="body" numberOfLines={1}>{plant.commonName}</Text>
          <Text variant="overline" role="textMuted" numberOfLines={1} style={styles.sciSmall}>
            {plant.scientificName}
          </Text>
        </View>
        {fitScore != null && fitColor ? (
          <View style={styles.fitCol}>
            <View style={[styles.fitDot, { backgroundColor: fitColor }]} />
            <Text variant="caption" style={{ color: fitColor }}>{fitScore}%</Text>
          </View>
        ) : null}
        {tooTall ? (
          <Text variant="caption" style={{ color: c.accent }} accessibilityLabel="May exceed container height">↑</Text>
        ) : null}
        <Pressable
          onPress={() => onInfo(plant)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Info for ${plant.commonName}`}>
          <Text variant="body" role="primary" style={styles.infoBtn}>ⓘ</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

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

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },

  // Filter panel
  search: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    fontSize: 16,
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  sortGroup: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  filterPanel: { gap: Spacing.md, paddingTop: Spacing.xs },
  facet: { gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  clearFilters: { alignSelf: 'flex-start' },

  // Catalog rows
  catalogList: { gap: Spacing.xs },
  catalogLoading: { paddingVertical: Spacing.xl },
  catalogMore: { paddingTop: Spacing.xs },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  rowEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  rowThumb: { width: 36, height: 36, borderRadius: Radii.sm, flexShrink: 0 },
  rowNames: { flex: 1, gap: 1 },
  sciSmall: { fontStyle: 'italic' },
  fitCol: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  fitDot: { width: 8, height: 8, borderRadius: Radii.pill },
  infoBtn: { fontSize: 18, paddingHorizontal: Spacing.xs },
});
