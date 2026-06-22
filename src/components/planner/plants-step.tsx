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
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Card, Chip, EcoMeter, haptics, SectionLabel, Text } from '@/components/ui';
import { PlantSheet, type PlantConflict } from '@/components/plant-sheet';
import { Radii, Spacing } from '@/constants/theme';
import { loadContainers, loadPlants } from '@/data';
import { useTokens } from '@/hooks/use-tokens';
import { resolveBuildContainer } from '@/logic/containers';
import { ecoBandLabel, ecoColor } from '@/logic/eco';
import { defaultPlacement, removePlacement, upsertPlacement } from '@/logic/placement';
import { plantFitScore } from '@/logic/recommend';
import { scoreBuild } from '@/logic/score-build';
import { filterPlants, type BrowseCriteria, type BrowseSort } from '@/logic/browse-filter';
import { checkPair } from '@/logic/compatibility';
import { humanize } from '@/lib/labels';
import { LIGHT_LEVELS, NATIVE_BIOMES, PLANT_TYPES, type Plant } from '@/types/plant';
import type { GroupReport } from '@/types/results';

import type { StepProps } from './step';

type CatalogSort = 'fit' | BrowseSort;

const CATALOG_SORTS: { value: CatalogSort; label: string }[] = [
  { value: 'fit', label: 'Best fit' },
  { value: 'name', label: 'Name' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'height', label: 'Height' },
];
const DIFFICULTIES = [1, 2, 3, 4, 5];

/** Any incompatible (survival-critical) conflict anywhere in the report. */
function hasSurvivalCritical(report: GroupReport): boolean {
  if (report.containerFitIssues.some((c) => c.severity === 'incompatible')) return true;
  const slugs = Object.keys(report.pairMatrix);
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const cell = report.pairMatrix[slugs[i]]?.[slugs[j]];
      if (cell?.survivalCritical) return true;
    }
  }
  return false;
}

/** Pairwise conflicts between `candidate` and each of `selected`. */
function getConflicts(candidate: Plant, selected: Plant[]): PlantConflict[] {
  return selected
    .filter((sp) => sp.slug !== candidate.slug)
    .flatMap((sp) =>
      checkPair(candidate, sp).conflicts.map((c) => ({
        withPlantName: sp.commonName,
        message: c.message,
        severity: c.severity,
      })),
    );
}
let placementCounter = 0;
export function PlantsStep({ draft, plants, update }: StepProps) {
  const { c, scheme } = useTokens();

  const catalog = useMemo(() => loadPlants(), []);
  const containers = useMemo(() => loadContainers(), []);
  const container = useMemo(() => resolveBuildContainer(draft, containers), [draft, containers]);

  // --- Filter / sort state (mirrors Browse) ---
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [biomes, setBiomes] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const [difficulties, setDifficulties] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const hasFitContext = container != null || plants.length > 0;
  const [sort, setSort] = useState<CatalogSort>(hasFitContext ? 'fit' : 'name');
  const activeFilters = types.length + biomes.length + lights.length + difficulties.length;

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
  }

  // --- Plant sheet state ---
  const [sheetPlant, setSheetPlant] = useState<Plant | null>(null);

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
  }, [catalog, query, types, biomes, lights, difficulties, sort, fitScores, draft.plantSlugs]);

  const selectedSlugs = new Set(draft.plantSlugs);

  // --- Live eco-balance ---
  const scored = useMemo(
    () => scoreBuild(draft, catalog, containers),
    [draft, catalog, containers],
  );
  const survivalCritical = scored.report ? hasSurvivalCritical(scored.report) : false;

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!survivalCritical) return;
    haptics.warn();
    pulse.value = withSequence(withTiming(1, { duration: 160 }), withTiming(0, { duration: 460 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survivalCritical]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const [matrixOpen, setMatrixOpen] = useState(false);

  // Inline collapsible animation for pair checks inside the eco-balance card
  const pairProgress = useSharedValue(0);
  const pairContentHeight = useSharedValue(0);
  const [pairMeasured, setPairMeasured] = useState(false);
  useEffect(() => {
    pairProgress.value = withTiming(matrixOpen ? 1 : 0, { duration: 300, easing: Easing.out(Easing.cubic) });
    // pairProgress is a stable shared-value ref — mutated here, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixOpen]);
  const pairBodyStyle = useAnimatedStyle(() => ({ height: pairProgress.value * pairContentHeight.value }));
  const pairChevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${pairProgress.value * 90}deg` }] }));
  function onPairLayout(e: LayoutChangeEvent) {
    const h = e.nativeEvent.layout.height;
    if (h > 0) pairContentHeight.value = h;
    if (!pairMeasured) setPairMeasured(true);
  }

  // --- Add / remove ---
  function addPlant(slug: string) {
    if (selectedSlugs.has(slug)) return;
    haptics.select();
    const nextSlugs = [...draft.plantSlugs, slug];
    // Increment our unique counter so no two plants ever share an index
    placementCounter++;
    const placement = defaultPlacement(slug, placementCounter);
    update({ plantSlugs: nextSlugs, placements: upsertPlacement(draft.placements, placement) });
  }

  function removePlant(slug: string) {
    haptics.select();
    update({
      plantSlugs: draft.plantSlugs.filter((s) => s !== slug),
      placements: removePlacement(draft.placements, slug),
    });
  }

  function togglePlant(slug: string) {
    if (selectedSlugs.has(slug)) removePlant(slug);
    else addPlant(slug);
  }

  // The one-line readout under the meter — honest for every state: a prompt when
  // empty, the scoring diagnostic when it can't be scored yet (e.g. no container),
  // and the verdict sentence once it scores.
  const ecoMessage =
    draft.plantSlugs.length === 0
      ? 'Add plants to see how they balance.'
      : scored.score != null
        ? scored.verdict?.sentence ?? ''
        : scored.diagnostic ?? 'Can’t score this build yet.';

  return (
    <View style={styles.root}>
      {/* Live Eco-balance — a fixed-height bar pinned above the catalog. It updates
          in place as plants are added (meter and verdict swap content without
          changing the bar's height), so the catalog never shifts under your finger. */}
      <Card style={styles.ecoBar}>
        <View style={styles.ecoHead}>
          <SectionLabel>Eco-balance</SectionLabel>
          {scored.score != null && draft.plantSlugs.length > 0 ? (
            <Text
              variant="caption"
              style={{ color: ecoColor(scored.score, scheme), fontWeight: '600' }}>
              {Math.round(scored.score)}% · {ecoBandLabel(scored.band ?? 'caution')}
            </Text>
          ) : null}
        </View>

        {scored.score != null && draft.plantSlugs.length > 0 ? (
          <View>
            <EcoMeter score={scored.score} height={10} />
            <Animated.View
              pointerEvents="none"
              style={[styles.glow, { backgroundColor: c.accent }, glowStyle]}
            />
          </View>
        ) : (
          <View style={[styles.emptyMeter, { backgroundColor: c.surfaceSunken }]} />
        )}

        <Text
          variant="caption"
          role={survivalCritical ? 'accent' : 'textMuted'}
          numberOfLines={3}
          style={styles.ecoVerdict}>
          {ecoMessage}
        </Text>

        {scored.report && draft.plantSlugs.length >= 2 ? (
          <View style={styles.pairSection}>
            <View style={[styles.pairDivider, { borderColor: c.border }]} />
            <Pressable
              onPress={() => { haptics.select(); setMatrixOpen((o) => !o); }}
              accessibilityRole="button"
              accessibilityLabel={`${matrixOpen ? 'Collapse' : 'Expand'} pair checks`}
              accessibilityState={{ expanded: matrixOpen }}
              style={styles.pairToggle}>
              <View style={styles.pairToggleText}>
                <Text variant="overline" role="textMuted">Pair checks</Text>
                {!matrixOpen ? (
                  <Text variant="caption" role="textMuted">Every pair, checked</Text>
                ) : null}
              </View>
              <Animated.View style={pairChevronStyle}>
                <Text variant="body" role="textMuted" style={styles.pairChevron}>›</Text>
              </Animated.View>
            </Pressable>
            <Animated.View style={[styles.pairOverflow, pairMeasured ? pairBodyStyle : matrixOpen ? styles.pairAutoHeight : styles.pairCollapsed]}>
              <View
                onLayout={onPairLayout}
                style={[styles.pairBody, pairMeasured || !matrixOpen ? styles.pairBodyAbsolute : null]}>
                <PairMatrix report={scored.report} plants={plants} />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </Card>

      {/* Catalog — search + filter + sorted rows */}
      <Card style={styles.card}>
        <SectionLabel>Add plants</SectionLabel>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plants…"
          placeholderTextColor={c.textMuted}
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
            {CATALOG_SORTS.filter((s) => s.value !== 'fit' || hasFitContext).map((s) => (
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
          <View style={styles.filterPanel}>
            <FacetGroup label="Type" options={PLANT_TYPES} selected={types} onToggle={(v) => toggleFilter(types, setTypes, v)} />
            <FacetGroup label="Biome" options={NATIVE_BIOMES} selected={biomes} onToggle={(v) => toggleFilter(biomes, setBiomes, v)} />
            <FacetGroup label="Light" options={LIGHT_LEVELS} selected={lights} onToggle={(v) => toggleFilter(lights, setLights, v)} />
            <View style={styles.facet}>
              <SectionLabel>Difficulty</SectionLabel>
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
            {activeFilters > 0 ? (
              <Pressable onPress={clearFilters} accessibilityRole="button" hitSlop={6} style={styles.clearFilters}>
                <Text variant="caption" role="primary">Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Catalog rows */}
        <View style={styles.catalogList}>
          {filtered.map((p) => {
            const fit = fitScores.get(p.slug) ?? null;
            const on = selectedSlugs.has(p.slug);
            return (
              <PlantCatalogRow
                key={p.slug}
                plant={p}
                selected={on}
                fitScore={fit}
                scheme={scheme}
                onToggle={() => togglePlant(p.slug)}
                onInfo={() => setSheetPlant(p)}
              />
            );
          })}
          {filtered.length === 0 ? (
            <Text variant="caption" role="textMuted">
              No plants match{query.trim() ? ` "${query.trim()}"` : ' these filters'}.
            </Text>
          ) : null}
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
        conflicts={sheetPlant ? getConflicts(sheetPlant, plants) : []}
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

function PlantCatalogRow({
  plant,
  selected,
  fitScore,
  scheme,
  onToggle,
  onInfo,
}: {
  plant: Plant;
  selected: boolean;
  fitScore: number | null;
  scheme: 'light' | 'dark';
  onToggle: () => void;
  onInfo: () => void;
}) {
  const { c } = useTokens();
  const emoji = plant.plantType ? (PLANT_TYPE_EMOJI[plant.plantType] ?? '🌱') : '🌱';
  const fitColor = fitScore != null ? ecoColor(fitScore, scheme) : null;

  return (
    <Pressable
      onPress={onToggle}
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
        <Text style={styles.rowEmoji}>{emoji}</Text>
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
        <Pressable
          onPress={onInfo}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Info for ${plant.commonName}`}>
          <Text variant="body" role="primary" style={styles.infoBtn}>ⓘ</Text>
        </Pressable>
      </View>
    </Pressable>
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

// --- Tier-3 pairwise matrix (unchanged from original) -----------------------

function PairMatrix({ report, plants }: { report: GroupReport; plants: readonly Plant[] }) {
  const { c } = useTokens();
  const rows: { a: Plant; b: Plant; score: number; verdict: string; lines: { msg: string; bad: boolean }[] }[] = [];
  for (let i = 0; i < plants.length; i++) {
    for (let j = i + 1; j < plants.length; j++) {
      const cell = report.pairMatrix[plants[i].slug]?.[plants[j].slug];
      if (!cell) continue;
      rows.push({
        a: plants[i],
        b: plants[j],
        score: cell.score,
        verdict: cell.verdict,
        lines: cell.conflicts.map((cf) => ({
          msg: cf.message + (cf.viaSecondary ? ' (via a secondary tolerance)' : ''),
          bad: cf.severity === 'incompatible',
        })),
      });
    }
  }

  return (
    <View style={styles.matrix}>
      {rows.map(({ a, b, score, verdict, lines }) => (
        <View key={`${a.slug}-${b.slug}`} style={styles.pairRow}>
          <View style={styles.pairHead}>
            <Text variant="caption" style={styles.pairNames}>
              {a.commonName} <Text role="textMuted">×</Text> {b.commonName}
            </Text>
            <Chip label={`${Math.round(score)}%`} tone={verdict === 'compatible' ? 'sage' : 'accent'} />
          </View>
          {lines.map((l, k) => (
            <View key={k} style={styles.conflictLine}>
              <View style={[styles.matrixDot, { backgroundColor: l.bad ? c.accent : c.sage }]} />
              <Text variant="caption" role="textMuted" style={styles.conflictText}>
                {l.msg}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  // Eco-balance bar — fixed height so a plant add updates it in place without
  // shifting the catalog below it.
  ecoBar: { padding: Spacing.lg, gap: Spacing.sm },
  ecoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  emptyMeter: { height: 10, borderRadius: 5 },
  ecoVerdict: { minHeight: 54 },
  glow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: Radii.pill },

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
  rowNames: { flex: 1, gap: 1 },
  sciSmall: { fontStyle: 'italic' },
  fitCol: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  fitDot: { width: 8, height: 8, borderRadius: Radii.pill },
  infoBtn: { fontSize: 18, paddingHorizontal: Spacing.xs },

  // Pair matrix
  matrix: { gap: Spacing.md, marginTop: Spacing.xs },
  pairRow: { gap: Spacing.xs },
  pairHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pairNames: { flexShrink: 1 },
  conflictLine: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', paddingLeft: Spacing.xs },
  matrixDot: { width: 7, height: 7, borderRadius: Radii.pill, marginTop: 5 },
  conflictText: { flexShrink: 1, lineHeight: 18 },

  // Pair checks inline collapsible inside the eco-balance card
  pairSection: { gap: Spacing.xs },
  pairDivider: { borderTopWidth: StyleSheet.hairlineWidth },
  pairToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pairToggleText: { flex: 1, gap: 2 },
  pairChevron: { fontSize: 18 },
  pairOverflow: { overflow: 'hidden' },
  pairAutoHeight: {},
  pairCollapsed: { height: 0 },
  pairBody: { gap: Spacing.sm, paddingTop: Spacing.xs },
  pairBodyAbsolute: { position: 'absolute', left: 0, right: 0, top: 0 },
});
