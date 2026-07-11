/**
 * M0 golden-fixture **input matrix** (M0 runbook §4.2 — characterization only).
 *
 * Every input here is deterministic and hermetic:
 *   - Plants resolve against the **frozen** `catalog.snapshot.json` (a copy of
 *     `src/data/plants.json` taken at M0 capture time, 2026-07-11), never the live
 *     catalog — a future catalog edit must not silently shift a fixture.
 *   - All dates are pinned constants; `buildCareSchedule`'s `now` parameter is
 *     always passed explicitly (its default is the real clock).
 *   - Substrate component labels are frozen here for the same reason the catalog
 *     is: `formatMixRecipe` takes an injected `labelOf`, and the fixture pins the
 *     formatter's behavior, not `src/data`'s label spelling of the day.
 *
 * Scenario ids are stable keys into the fixture JSON — do not rename or remove
 * (the §4.2 minimum set); adding scenarios is allowed.
 */
import { plantSchema, type Container, type Plant } from '../../../types';
import { makeContainer, parseDimensionsStr } from '../../containers';
import type { CareOverrides, PendingTask } from '../../careSchedule';
import type { SubstrateMix } from '../../substrateMixer';
import type { ScorableBuild } from '../../score-build';
import type { SummarizableBuild } from '../../export-txt';
import type { Placement } from '../../placement';
import catalogJson from './catalog.snapshot.json';

// --- Frozen catalog ----------------------------------------------------------

/** Every snapshot record, parsed through the engines' own contract (base schema). */
export const SNAPSHOT_PLANTS: Plant[] = (catalogJson as { plants: unknown[] }).plants.map((raw) =>
  plantSchema.parse(raw),
);

const BY_SLUG = new Map(SNAPSHOT_PLANTS.map((p) => [p.slug, p]));

/** Resolve a snapshot slug, throwing loudly on a typo (never silently skipping). */
export function plant(slug: string): Plant {
  const found = BY_SLUG.get(slug);
  if (!found) throw new Error(`Golden scenario slug not in catalog.snapshot.json: ${slug}`);
  return found;
}

export function plantsOf(slugs: readonly string[]): Plant[] {
  return slugs.map(plant);
}

// --- Pinned dates (runbook §4: never rely on a real clock) --------------------

/** Build creation time for every scheduled/exported scenario. */
export const CREATED_AT = new Date('2026-01-15T12:00:00Z');
/** The standard evaluation instant (17 days after creation — past the settle-in window). */
export const NOW = new Date('2026-02-01T12:00:00Z');
/** Early evaluation instant (5 days in — inside the settle-in window). */
export const NOW_EARLY = new Date('2026-01-20T12:00:00Z');
/** Exactly createdAt + 14 days — the settle-in age gate is a strict `<`. */
export const SETTLE_BOUNDARY = new Date(CREATED_AT.getTime() + 14 * 86_400_000);
/** One millisecond inside the settle-in window. */
export const SETTLE_BOUNDARY_MINUS_1MS = new Date(SETTLE_BOUNDARY.getTime() - 1);
/** Pinned `updatedAt` for export scenarios. */
export const UPDATED_AT = new Date('2026-01-28T09:30:00Z');

// --- Frozen substrate-component labels (capture-time copy of src/data) --------

export const FROZEN_COMPONENT_LABELS: Readonly<Record<string, string>> = {
  perlite: 'Perlite',
  peat: 'Peat',
  sphagnum: 'Sphagnum moss',
  sand: 'Sand',
  'coco-coir': 'Coco coir',
  grit: 'Grit',
  'orchid-bark': 'Orchid bark',
  pumice: 'Pumice',
  mud: 'Mud',
  'potting-soil': 'Potting soil',
  'worm-castings': 'Worm castings',
  vermiculite: 'Vermiculite',
  leca: 'LECA',
  akadama: 'Akadama',
};

export const frozenLabelOf = (id: string): string => FROZEN_COMPONENT_LABELS[id] ?? id;

// --- Containers ---------------------------------------------------------------

/** S1/S5 vessel: the happy-path rectangle (15 L, 600 cm² floor). */
export const RECT_30_SEALED: Container = makeContainer(
  'rectangular',
  { length: 30, width: 20, height: 25 },
  'sealed',
  'golden-rect-30',
);

/** S2 vessel: open cylinder (⌀25×20 — 9.82 L). */
export const CYL_25_OPEN: Container = makeContainer(
  'cylindrical',
  { diameter: 25, height: 20 },
  'open',
  'golden-cyl-25',
);

/** S3 vessel: tall narrow jar (⌀12×40) — the litres-without-floor divergence. */
export const CYL_12_TALL_LIDDED: Container = makeContainer(
  'cylindrical',
  { diameter: 12, height: 40 },
  'lidded',
  'golden-cyl-12-tall',
);

/** S4 vessel: single-plant jar. */
export const CYL_15_SEALED: Container = makeContainer(
  'cylindrical',
  { diameter: 15, height: 20 },
  'sealed',
  'golden-cyl-15',
);

/** S6/S12 vessel: mid rectangle, lidded (7.5 L → medium volume bucket). */
export const RECT_25_LIDDED: Container = makeContainer(
  'rectangular',
  { length: 25, width: 15, height: 20 },
  'lidded',
  'golden-rect-25',
);

/** S7 vessel: 100 cm² floor — 6 plants trip the incompatible crowding rung. */
export const RECT_10_SEALED: Container = makeContainer(
  'rectangular',
  { length: 10, width: 10, height: 15 },
  'sealed',
  'golden-rect-10',
);

/** S8 vessel: open cylinder for the sparse-fields pair. */
export const CYL_20_OPEN: Container = makeContainer(
  'cylindrical',
  { diameter: 20, height: 15 },
  'open',
  'golden-cyl-20',
);

/** S15 vessel: micro sealed jar (0.94 L < 1 L) — the gas-exchange threshold. */
export const CYL_10_MICRO_SEALED: Container = makeContainer(
  'cylindrical',
  { diameter: 10, height: 12 },
  'sealed',
  'golden-cyl-10-micro',
);

// --- Group scenarios (checkGroup-evaluable rows of the §4.2 matrix) -----------

export interface GroupScenario {
  id: string;
  /** One line: the behavior this scenario pins. */
  pins: string;
  plantSlugs: string[];
  container: Container;
}

export const GROUP_SCENARIOS: GroupScenario[] = [
  {
    id: 'closed-tropical-rect',
    pins: 'happy path — 4 compatible humid plants, unanimous consensus, no penalties',
    plantSlugs: ['fittonia-albivenis', 'calathea-ornata', 'adiantum-raddianum', 'episcia-cupreata'],
    container: RECT_30_SEALED,
  },
  {
    id: 'open-arid-cyl',
    pins: '3 arid plants in an open cylinder; echeveria matches bright-indirect consensus only via its secondary (viaSecondary caution)',
    plantSlugs: ['haworthia-attenuata', 'echeveria-elegans', 'crassula-ovata-mini'],
    container: CYL_25_OPEN,
  },
  {
    id: 'tall-cylinder',
    pins: 'volume-vs-floor-area divergence: 4.52 L reads roomy but 113 cm² floor / 4 plants = crowding caution',
    plantSlugs: [
      'fittonia-albivenis',
      'soleirolia-soleirolii',
      'episcia-cupreata',
      'pilea-involucrata',
    ],
    container: CYL_12_TALL_LIDDED,
  },
  {
    id: 'single-plant',
    pins: 'consensus-of-one: every stat is its own majority, score 100',
    plantSlugs: ['fittonia-albivenis'],
    container: CYL_15_SEALED,
  },
  {
    id: 'survival-clamp',
    pins: 'ADR 0017 clamp: echeveria fails survival (light lethal + disjoint humidity + closed container) → plant ≤20, weakest-link build ≤20; the three matching plants keep their scores',
    plantSlugs: [
      'fittonia-albivenis',
      'calathea-ornata',
      'adiantum-raddianum',
      'echeveria-elegans',
    ],
    container: RECT_30_SEALED,
  },
  {
    id: 'split-tie',
    pins: 'ADR 0017 tie: light 2v2 (medium/low camps, 1 step apart) → no light consensus, no per-plant light penalty, one build-level caution split (−5)',
    plantSlugs: [
      'fittonia-albivenis',
      'soleirolia-soleirolii',
      'selaginella-uncinata',
      'pellionia-repens',
    ],
    container: RECT_25_LIDDED,
  },
  {
    id: 'crowded',
    pins: 'crowding incompatible rung: 100 cm² / 6 plants = 16.7 cm² each (<18) → build-survival clamp',
    plantSlugs: [
      'fittonia-albivenis',
      'soleirolia-soleirolii',
      'episcia-cupreata',
      'pilea-involucrata',
      'hypoestes-phyllostachya',
      'calathea-ornata',
    ],
    container: RECT_10_SEALED,
  },
  {
    id: 'sparse-fields',
    pins: 'optional-field sparseness (Open Q A6): tillandsia has no plantType; engines must not care',
    plantSlugs: ['tillandsia-ionantha', 'haworthia-attenuata'],
    container: CYL_20_OPEN,
  },
  {
    id: 'micro-sealed-gas',
    pins: 'gas-exchange caution: fast grower (soleirolia) sealed under the 1 L threshold',
    plantSlugs: ['soleirolia-soleirolii', 'fittonia-albivenis'],
    container: CYL_10_MICRO_SEALED,
  },
];

/** Up to three per-plant scorePlantVsConsensus captures per scenario. */
export function representativeSlugs(s: GroupScenario): string[] {
  return s.plantSlugs.slice(0, 3);
}

// --- scoreBuild / verdict scenarios -------------------------------------------

/** A group scenario reshaped as the persisted-build snapshot `scoreBuild` takes. */
export function asScorableBuild(s: GroupScenario): ScorableBuild {
  return {
    containerShape: s.container.shape,
    containerDimensions: parseDimensionsStr(s.container.shape, s.container.dimensionsCm),
    containerOpening: s.container.opening,
    containerSlug: s.container.slug,
    plantSlugs: [...s.plantSlugs],
  };
}

/** §4.2 #9 — empty build: v1 parity score 100 + `empty: true`. */
export const EMPTY_BUILD: ScorableBuild = {
  containerShape: 'rectangular',
  containerDimensions: { length: 30, width: 20, height: 25 },
  containerOpening: 'sealed',
  containerSlug: 'golden-rect-30',
  plantSlugs: [],
};

/** §4.2 #10a — unknown slug → "catalog out of date" diagnostic. */
export const BROKEN_BUILD_UNKNOWN_SLUG: ScorableBuild = {
  containerShape: 'rectangular',
  containerDimensions: { length: 30, width: 20, height: 25 },
  containerOpening: 'sealed',
  containerSlug: 'golden-rect-30',
  plantSlugs: ['fittonia-albivenis', 'not-a-real-plant'],
};

/** §4.2 #10b — no container snapshot → "can't be scored yet" diagnostic. */
export const BROKEN_BUILD_NO_CONTAINER: ScorableBuild = {
  containerShape: null,
  containerDimensions: null,
  containerOpening: null,
  containerSlug: null,
  plantSlugs: ['fittonia-albivenis'],
};

/**
 * §4.2 #10c — malformed geometry. `resolveBuildContainer` runs *outside*
 * `scoreBuild`'s try, so this **throws** out of `scoreBuild` (pinned as behavior).
 */
export const BROKEN_BUILD_BAD_DIMENSIONS: ScorableBuild = {
  containerShape: 'rectangular',
  containerDimensions: { length: -1, width: 10, height: 10 },
  containerOpening: 'sealed',
  containerSlug: 'golden-bad',
  plantSlugs: ['fittonia-albivenis'],
};

// --- Substrate scenarios (§4.2 #11) --------------------------------------------

export interface MixScenario {
  id: string;
  pins: string;
  mix: SubstrateMix;
  /** Substrate depths (cm) to evaluate the perched water table at. */
  depthsCm: number[];
}

export const MIX_SCENARIOS: MixScenario[] = [
  {
    id: 'fine-shallow-pwt',
    pins: 'peat-heavy fine mix: perched height 5.5 cm ≈ whole 6 cm base (saturatedFraction >0.9 — the rot signal)',
    mix: { peat: 2, 'potting-soil': 1 },
    depthsCm: [6, 12],
  },
  {
    id: 'packed-tropical',
    pins: 'packing correction active: coco/perlite/sphagnum size spread bends aeration below and retention above the weighted mean',
    mix: { 'coco-coir': 2, perlite: 1, sphagnum: 1 },
    depthsCm: [6],
  },
  {
    id: 'akadama-mineral',
    pins: 'akadama-bearing mineral mix (ADR 0015 addition)',
    mix: { akadama: 2, pumice: 1, 'orchid-bark': 1 },
    depthsCm: [6],
  },
  {
    id: 'single-component',
    pins: 'single component = its matrix row verbatim, packing mismatch 0',
    mix: { peat: 3 },
    depthsCm: [6],
  },
  {
    id: 'empty-mix',
    pins: 'empty recipe → null stats, null PWT, "well-balanced", empty recipe string',
    mix: {},
    depthsCm: [6, 0],
  },
  {
    id: 'unknown-id-ignored',
    pins: 'unknown component ids are outside the matrix domain and contribute nothing',
    mix: { unobtainium: 2, peat: 1 },
    depthsCm: [6],
  },
];

// --- Care scenarios (§4.2 #12) --------------------------------------------------

/** S12 overrides: custom interval, a muted task, and an out-of-band value that must clamp to 90. */
export const CARE_OVERRIDES_S12: CareOverrides = {
  'watering-inspection': { intervalDays: 3 },
  'lid-opening': { muted: true },
  trimming: { intervalDays: 500 },
};

/** Mixed-growth pair on the lidded mid rectangle (trimming task present). */
export const CARE_PLANTS_S12 = ['soleirolia-soleirolii', 'fittonia-albivenis'];
export const CARE_CONTAINER_S12 = RECT_25_LIDDED;

// --- Notification-budget scenario (§4.2 #13) ------------------------------------

const DAY_MS = 86_400_000;
const TASK_TYPES = ['watering-inspection', 'lid-opening', 'trimming', 'settle-in'] as const;

/**
 * 70 deterministic pending tasks across 12 builds. `dueAt = NOW + (i % 5) days`
 * gives 5 large tie groups so the stable-order (input index) tiebreak is pinned.
 */
export const PENDING_70: PendingTask[] = Array.from({ length: 70 }, (_, i) => ({
  buildId: `bld-${String((i % 12) + 1).padStart(2, '0')}`,
  type: TASK_TYPES[i % TASK_TYPES.length],
  dueAt: NOW.getTime() + (i % 5) * DAY_MS,
}));

// --- Export scenario (§4.2 #14) --------------------------------------------------

export const EXPORT_PLACEMENTS: Placement[] = [
  { slug: 'fittonia-albivenis', x: 0.3, y: 0.62, scale: 1 },
  { slug: 'calathea-ornata', x: 0.7, y: 0.5, scale: 1.15 },
];

export const EXPORT_MIX: SubstrateMix = { 'coco-coir': 2, perlite: 1, sphagnum: 1 };

/** The full-fat export build: tags, placements, mix, overrides, charcoal, pinned dates. */
export const EXPORT_BUILD: SummarizableBuild & {
  placements: Placement[];
  substrateMix: SubstrateMix;
  careOverrides: CareOverrides;
  substrateDepth: number;
  drainageDepth: number;
  charcoalDepth: number;
  description: string;
} = {
  name: 'Rainforest Shelf Jar',
  containerShape: 'rectangular',
  containerDimensions: { length: 30, width: 20, height: 25 },
  containerOpening: 'lidded',
  containerSlug: 'golden-rect-30',
  plantSlugs: ['fittonia-albivenis', 'calathea-ornata', 'adiantum-raddianum'],
  tags: ['gift', 'humid'],
  description: 'Golden-fixture export build — every optional surface filled.',
  placements: EXPORT_PLACEMENTS,
  substrateMix: EXPORT_MIX,
  careOverrides: { 'watering-inspection': { intervalDays: 10 } },
  substrateDepth: 6,
  drainageDepth: 2,
  charcoalDepth: 1.5,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

/** Export edge: scoring fails (unknown slug) → Score renders `N/A`; no tags/plants fallbacks. */
export const EXPORT_BUILD_NA: SummarizableBuild = {
  name: 'Broken Export',
  containerShape: null,
  containerDimensions: null,
  containerOpening: null,
  containerSlug: null,
  plantSlugs: [],
  tags: [],
  createdAt: null,
  updatedAt: undefined,
};

/** formatExportDate edge inputs (each rendered to a string in the fixture). */
export const EXPORT_DATE_EDGES: { label: string; value: string | number | Date | null | undefined }[] = [
  { label: 'null', value: null },
  { label: 'undefined', value: undefined },
  { label: 'empty-string', value: '' },
  { label: 'garbage', value: 'not-a-date' },
  { label: 'impossible-calendar-date', value: '2026-02-30' },
  { label: 'epoch-zero', value: 0 },
  { label: 'iso-millis', value: '2026-03-05T23:59:59.999Z' },
  { label: 'date-object', value: UPDATED_AT },
];
