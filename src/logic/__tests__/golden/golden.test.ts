/**
 * M0 golden-fixture suite — characterization only (runbook §4; see README.md).
 *
 * For each engine family it builds one `captured` object from the frozen inputs in
 * `scenarios.ts`, normalizes it through `JSON.parse(JSON.stringify(...))` (dates →
 * ISO strings, `undefined` dropped — exactly what the fixture files store), and
 * deep-equals it against `fixtures/<family>.json`. With `UPDATE_GOLDEN=1` it
 * (re)writes the fixture instead — legitimate only as a recorded decision (ADR
 * 0029); the one sanctioned run was the M0 capture.
 *
 * Assertions pin behavior, not intent: thrown-error messages, clamp quirks, and
 * copy.json prose are all part of the frozen contract. Nothing here may change an
 * engine output (First-PR boundary) — a red golden test means the *engine* moved.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { env } from 'node:process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { checkGroup, deriveConsensus, scorePlantVsConsensus } from '../../compatibility';
import {
  computeVolumeL,
  containerProfile,
  defaultLayerDepths,
  dimensionsToStr,
  floorAreaCm2,
  makeContainer,
  parseDimensionsStr,
  recommendContainerDimensions,
  resolveBuildContainer,
} from '../../containers';
import { ecoBand, ecoBandLabel, type EcoBand } from '../../eco';
import { deriveEnvelope } from '../../environment';
import { formatExportDate, generateTextSummary, resolveBuildSummary } from '../../export-txt';
import { generateBuildGuide } from '../../guide';
import { generateCareGuide } from '../../care';
import {
  buildCareSchedule,
  IOS_PENDING_CAP,
  MAX_CARE_INTERVAL_DAYS,
  MIN_CARE_INTERVAL_DAYS,
  nextDueAfter,
  PENDING_BUDGET,
  planNotificationBudget,
  volumeBucket,
} from '../../careSchedule';
import {
  clampPlacement,
  defaultPlacement,
  isInsidePlane,
  movePlacement,
  removePlacement,
  scalePlacement,
  upsertPlacement,
} from '../../placement';
import { plantFitScore, recommend } from '../../recommend';
import { scoreBuild } from '../../score-build';
import {
  PROPERTY_MAX,
  SIZE_CLASS,
  SIZE_CLASS_MAX,
  SUBSTRATE_MATRIX,
  SUBSTRATE_PROPERTIES,
} from '../../substrate-matrix';
import { describeMix, formatMixRecipe, mixSubstrate, perchedWaterTable } from '../../substrateMixer';
import { summarizeVerdict } from '../../verdict';
import { exportBackup, restoreBackup } from '../../../db/backup';
import { migratePayload, STORE_SCHEMA_VERSION } from '../../../db/migrate';
import { buildPhotos, builds, careMarks } from '../../../db/schema';
import { makeTestDb } from '../../../db/__tests__/helpers';
import {
  asScorableBuild,
  BROKEN_BUILD_BAD_DIMENSIONS,
  BROKEN_BUILD_NO_CONTAINER,
  BROKEN_BUILD_UNKNOWN_SLUG,
  CARE_CONTAINER_S12,
  CARE_OVERRIDES_S12,
  CARE_PLANTS_S12,
  CREATED_AT,
  CYL_12_TALL_LIDDED,
  CYL_10_MICRO_SEALED,
  CYL_15_SEALED,
  CYL_20_OPEN,
  CYL_25_OPEN,
  EMPTY_BUILD,
  EXPORT_BUILD,
  EXPORT_BUILD_NA,
  EXPORT_DATE_EDGES,
  EXPORT_MIX,
  EXPORT_PLACEMENTS,
  frozenLabelOf,
  GROUP_SCENARIOS,
  MIX_SCENARIOS,
  NOW,
  NOW_EARLY,
  PENDING_70,
  plant,
  plantsOf,
  RECT_10_SEALED,
  RECT_25_LIDDED,
  RECT_30_SEALED,
  representativeSlugs,
  SETTLE_BOUNDARY,
  SETTLE_BOUNDARY_MINUS_1MS,
  SNAPSHOT_PLANTS,
  UPDATED_AT,
} from './scenarios';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const UPDATE = env.UPDATE_GOLDEN === '1';

/** The fixture form of a value: dates → ISO strings, `undefined` keys dropped. */
function normalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** Pin a synchronous throw as data — the message is part of the frozen contract. */
function thrown(fn: () => unknown): { threw: true; message: string } {
  try {
    fn();
  } catch (err) {
    return { threw: true, message: err instanceof Error ? err.message : String(err) };
  }
  throw new Error('Expected the call to throw — the pinned behavior has changed.');
}

/** Async twin of {@link thrown}, with the error's name kept (typed rejects). */
async function thrownAsync(fn: () => Promise<unknown>): Promise<{ threw: true; name: string; message: string }> {
  try {
    await fn();
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return { threw: true, name: e.name, message: e.message };
  }
  throw new Error('Expected the call to reject — the pinned behavior has changed.');
}

/** Deep-equal `captured` against `fixtures/<family>.json` (or rewrite under UPDATE_GOLDEN=1). */
function checkFamily(family: string, captured: Record<string, unknown>): void {
  const file = join(FIXTURES_DIR, `${family}.json`);
  const normalized = normalize(captured);
  if (UPDATE) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
    writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`);
  }
  if (!existsSync(file)) {
    throw new Error(
      `Missing golden fixture ${family}.json — capture once with: ` +
        'UPDATE_GOLDEN=1 npx vitest run src/logic/__tests__/golden/golden.test.ts',
    );
  }
  expect(normalized).toEqual(JSON.parse(readFileSync(file, 'utf8')));
}

const ALL_CONTAINERS = [
  RECT_30_SEALED,
  CYL_25_OPEN,
  CYL_12_TALL_LIDDED,
  CYL_15_SEALED,
  RECT_25_LIDDED,
  RECT_10_SEALED,
  CYL_20_OPEN,
  CYL_10_MICRO_SEALED,
];

describe('golden fixtures — M0 engine characterization', () => {
  it('compatibility: checkGroup / deriveConsensus / scorePlantVsConsensus', () => {
    const captured: Record<string, unknown> = {};
    for (const s of GROUP_SCENARIOS) {
      const plants = plantsOf(s.plantSlugs);
      const consensus = deriveConsensus(plants);
      captured[`report:${s.id}`] = checkGroup(plants, s.container);
      captured[`consensus:${s.id}`] = consensus;
      // Container-less per-plant scores pin the consensus-only ladder (the path
      // plantFitScore/recommend use); the with-container path is pinned inside
      // each report's plantScores.
      captured[`plantVsConsensus:${s.id}`] = Object.fromEntries(
        representativeSlugs(s).map((slug) => [slug, scorePlantVsConsensus(plant(slug), consensus)]),
      );
    }
    captured['consensus:empty-selection'] = deriveConsensus([]);
    captured['checkGroup:empty-throws'] = thrown(() => checkGroup([], RECT_30_SEALED));
    checkFamily('compatibility', captured);
  });

  it('verdict + eco: summarizeVerdict / scoreBuild / ecoBand boundaries', () => {
    const captured: Record<string, unknown> = {};
    for (const s of GROUP_SCENARIOS) {
      const report = checkGroup(plantsOf(s.plantSlugs), s.container);
      captured[`verdict:${s.id}`] = summarizeVerdict(report, s.plantSlugs.length);
      captured[`scoreBuild:${s.id}`] = scoreBuild(asScorableBuild(s), SNAPSHOT_PLANTS);
    }
    // plantCount 0 forces the neutral empty-build sentence regardless of report.
    captured['verdict:plantCount-0'] = summarizeVerdict(
      checkGroup(plantsOf(GROUP_SCENARIOS[0].plantSlugs), GROUP_SCENARIOS[0].container),
      0,
    );
    captured['scoreBuild:empty-build'] = scoreBuild(EMPTY_BUILD, SNAPSHOT_PLANTS);
    captured['scoreBuild:unknown-slug'] = scoreBuild(BROKEN_BUILD_UNKNOWN_SLUG, SNAPSHOT_PLANTS);
    captured['scoreBuild:no-container'] = scoreBuild(BROKEN_BUILD_NO_CONTAINER, SNAPSHOT_PLANTS);
    // resolveBuildContainer sits outside scoreBuild's try — malformed geometry throws.
    captured['scoreBuild:bad-dimensions-throws'] = thrown(() =>
      scoreBuild(BROKEN_BUILD_BAD_DIMENSIONS, SNAPSHOT_PLANTS),
    );
    captured['ecoBand'] = Object.fromEntries(
      [0, 19, 20, 49, 50, 79, 80, 100].map((score) => [String(score), ecoBand(score)]),
    );
    captured['ecoBandLabel'] = Object.fromEntries(
      (['healthy', 'caution', 'critical'] as EcoBand[]).map((band) => [band, ecoBandLabel(band)]),
    );
    checkFamily('verdict', captured);
  });

  it('container math: volume / floor area / round-trip / depths / profile / recommendation', () => {
    const captured: Record<string, unknown> = {};
    for (const c of ALL_CONTAINERS) {
      // The Container object itself pins makeContainer (volume, name, dimensionsCm).
      captured[`container:${c.slug}`] = c;
      const dims = parseDimensionsStr(c.shape, c.dimensionsCm);
      captured[`roundTrip:${c.slug}`] = {
        parsed: dims,
        volumeL: computeVolumeL(c.shape, dims),
        floorAreaCm2: floorAreaCm2(c.shape, dims),
        rendered: dimensionsToStr(c.shape, dims),
      };
    }
    for (const s of GROUP_SCENARIOS) {
      captured[`defaultLayerDepths:${s.id}`] = defaultLayerDepths(
        plantsOf(s.plantSlugs),
        s.container.volumeL,
      );
      captured[`recommendDimensions:${s.id}`] = recommendContainerDimensions(plantsOf(s.plantSlugs));
    }
    captured['profile:rect-full'] = containerProfile(
      'rectangular',
      { length: 30, width: 20, height: 25 },
      6,
      2,
      12,
      1.5,
    );
    captured['profile:rect-no-charcoal-default'] = containerProfile(
      'rectangular',
      { length: 30, width: 20, height: 25 },
      6,
      2,
      12,
    );
    captured['profile:clamped-overflow'] = containerProfile(
      'cylindrical',
      { diameter: 12, height: 40 },
      50,
      10,
      30,
      5,
    );
    captured['profile:zero-defaults'] = containerProfile('rectangular', {
      length: 30,
      width: 20,
      height: 25,
    });
    captured['resolveBuildContainer:full-snapshot'] = resolveBuildContainer(EXPORT_BUILD);
    captured['resolveBuildContainer:no-snapshot'] = resolveBuildContainer(BROKEN_BUILD_NO_CONTAINER);
    // Thrown messages are behavior (runbook §4.1 row 3).
    captured['errors'] = {
      unknownShapeVolume: thrown(() => computeVolumeL('spherical', { length: 10, width: 10, height: 10 })),
      negativeRectVolume: thrown(() => computeVolumeL('rectangular', { length: -1, width: 10, height: 10 })),
      missingRectDimension: thrown(() => computeVolumeL('rectangular', { width: 10, height: 10 })),
      zeroDiameterVolume: thrown(() => computeVolumeL('cylindrical', { diameter: 0, height: 10 })),
      unknownShapeFloor: thrown(() => floorAreaCm2('hexagonal', { length: 10, width: 10 })),
      missingWidthFloor: thrown(() => floorAreaCm2('rectangular', { length: 10 })),
      missingDiameterFloor: thrown(() => floorAreaCm2('cylindrical', {})),
      invalidOpening: thrown(() =>
        makeContainer('rectangular', { length: 10, width: 10, height: 10 }, 'vented'),
      ),
      recommendForNoPlants: thrown(() => recommendContainerDimensions([])),
    };
    checkFamily('containers', captured);
  });

  it('substrate: mixSubstrate / perchedWaterTable / describeMix / formatMixRecipe / matrix constants', () => {
    const captured: Record<string, unknown> = {};
    for (const m of MIX_SCENARIOS) {
      const stats = mixSubstrate(m.mix);
      captured[m.id] = {
        stats,
        character: describeMix(stats),
        recipe: formatMixRecipe(m.mix, frozenLabelOf),
        perchedWaterTable: Object.fromEntries(
          m.depthsCm.map((depth) => [String(depth), perchedWaterTable(m.mix, depth)]),
        ),
      };
    }
    // The matrix is data-as-code (ADR 0015) — a verbatim copy is the drift alarm.
    captured['matrix-constants'] = {
      SUBSTRATE_PROPERTIES,
      PROPERTY_MAX,
      SUBSTRATE_MATRIX,
      SIZE_CLASS,
      SIZE_CLASS_MAX,
    };
    checkFamily('substrate', captured);
  });

  it('care: generateCareGuide / buildCareSchedule / buckets / notification budget', () => {
    const captured: Record<string, unknown> = {};
    for (const s of GROUP_SCENARIOS) {
      const plants = plantsOf(s.plantSlugs);
      captured[`guide:${s.id}`] = generateCareGuide(plants, s.container);
      // 5 days in — inside the settle-in window, so the one-time task is present.
      captured[`schedule-early:${s.id}`] = buildCareSchedule(
        plants,
        s.container,
        CREATED_AT,
        undefined,
        NOW_EARLY,
      );
    }
    captured['guide:empty-throws'] = thrown(() => generateCareGuide([], RECT_30_SEALED));
    const s12 = plantsOf(CARE_PLANTS_S12);
    captured['schedule:s12-defaults-now'] = buildCareSchedule(s12, CARE_CONTAINER_S12, CREATED_AT, undefined, NOW);
    captured['schedule:s12-overrides-now'] = buildCareSchedule(s12, CARE_CONTAINER_S12, CREATED_AT, CARE_OVERRIDES_S12, NOW);
    captured['schedule:s12-overrides-early'] = buildCareSchedule(s12, CARE_CONTAINER_S12, CREATED_AT, CARE_OVERRIDES_S12, NOW_EARLY);
    // The settle-in age gate is a strict `<`: absent at exactly +14 d, present 1 ms inside.
    captured['schedule:s12-overrides-at-boundary'] = buildCareSchedule(s12, CARE_CONTAINER_S12, CREATED_AT, CARE_OVERRIDES_S12, SETTLE_BOUNDARY);
    captured['schedule:s12-overrides-boundary-minus-1ms'] = buildCareSchedule(s12, CARE_CONTAINER_S12, CREATED_AT, CARE_OVERRIDES_S12, SETTLE_BOUNDARY_MINUS_1MS);
    captured['volumeBucket'] = Object.fromEntries(
      [0.5, 4.99, 5, 7.5, 20, 20.01, 50].map((v) => [String(v), volumeBucket(v)]),
    );
    captured['nextDueAfter'] = {
      'now-plus-3d': nextDueAfter(NOW, 3),
      'now-plus-90d': nextDueAfter(NOW, 90),
    };
    captured['budget:default'] = planNotificationBudget(PENDING_70);
    captured['budget:ios-cap'] = planNotificationBudget(PENDING_70, IOS_PENDING_CAP);
    captured['budget:zero'] = planNotificationBudget(PENDING_70, 0);
    captured['constants'] = {
      PENDING_BUDGET,
      IOS_PENDING_CAP,
      MIN_CARE_INTERVAL_DAYS,
      MAX_CARE_INTERVAL_DAYS,
    };
    checkFamily('care', captured);
  });

  it('build guide: generateBuildGuide in both unit systems', () => {
    const captured: Record<string, unknown> = {};
    for (const s of GROUP_SCENARIOS) {
      const plants = plantsOf(s.plantSlugs);
      captured[`metric:${s.id}`] = generateBuildGuide(plants, s.container);
      captured[`imperial:${s.id}`] = generateBuildGuide(plants, s.container, { units: 'imperial' });
    }
    // Full-fat opts: the export build's real depths + its custom mix line.
    const exportContainer = resolveBuildContainer(EXPORT_BUILD);
    if (!exportContainer) throw new Error('EXPORT_BUILD must resolve a container.');
    const exportPlants = plantsOf(EXPORT_BUILD.plantSlugs);
    const fullOpts = {
      substrateDepth: EXPORT_BUILD.substrateDepth,
      drainageDepth: EXPORT_BUILD.drainageDepth,
      charcoalDepth: EXPORT_BUILD.charcoalDepth,
      substrateMix: {
        recipe: formatMixRecipe(EXPORT_MIX, frozenLabelOf),
        character: describeMix(mixSubstrate(EXPORT_MIX)),
      },
    };
    captured['metric:full-fat-export-build'] = generateBuildGuide(exportPlants, exportContainer, fullOpts);
    captured['imperial:full-fat-export-build'] = generateBuildGuide(exportPlants, exportContainer, {
      ...fullOpts,
      units: 'imperial',
    });
    // drainageDepth 0 drops the drainage + separation steps entirely.
    captured['metric:zero-drainage'] = generateBuildGuide(exportPlants, exportContainer, { drainageDepth: 0 });
    captured['guide:empty-throws'] = thrown(() => generateBuildGuide([], RECT_30_SEALED));
    checkFamily('guide', captured);
  });

  it('export: resolveBuildSummary / generateTextSummary / formatExportDate edges', () => {
    const captured: Record<string, unknown> = {};
    const full = resolveBuildSummary(EXPORT_BUILD, SNAPSHOT_PLANTS);
    captured['summary:full'] = full;
    // The text block is byte-exact v1 layout — the string itself is the contract.
    captured['text:full'] = generateTextSummary(full);
    const na = resolveBuildSummary(EXPORT_BUILD_NA, SNAPSHOT_PLANTS);
    captured['summary:na'] = na;
    captured['text:na'] = generateTextSummary(na);
    // EXPORT_BUILD_NA is an *empty* build, which v1-parity scores 100 — so it never
    // reaches the `N/A` render. An unknown slug does (score: null), and the missing
    // plant name falls back to its slug in the Plants block. Pin both.
    const naScore = resolveBuildSummary(
      { ...EXPORT_BUILD_NA, plantSlugs: ['not-a-real-plant'] },
      SNAPSHOT_PLANTS,
    );
    captured['summary:na-score'] = naScore;
    captured['text:na-score'] = generateTextSummary(naScore);
    captured['formatExportDate'] = Object.fromEntries(
      EXPORT_DATE_EDGES.map((edge) => [edge.label, formatExportDate(edge.value)]),
    );
    checkFamily('export', captured);
  });

  it('recommend + environment + placement', () => {
    const captured: Record<string, unknown> = {};
    for (const s of GROUP_SCENARIOS) {
      const selected = plantsOf(s.plantSlugs);
      // Slimmed per the settled design: full Plant payloads are already frozen in
      // the catalog snapshot, so each hit keeps only its slug + scoring surface.
      captured[`recommend:${s.id}`] = recommend(selected, s.container, SNAPSHOT_PLANTS).map((r) => ({
        plant: r.plant.slug,
        fitScore: r.fitScore,
        reasons: r.reasons,
        cautions: r.cautions,
      }));
    }
    captured['plantFitScore:no-context'] = plantFitScore(plant('fittonia-albivenis'), [], null);
    captured['plantFitScore:container-only'] = plantFitScore(plant('echeveria-elegans'), [], RECT_30_SEALED);
    captured['plantFitScore:selected-with-container'] = plantFitScore(
      plant('echeveria-elegans'),
      plantsOf(['fittonia-albivenis', 'calathea-ornata']),
      RECT_30_SEALED,
    );
    captured['envelope:closed-tropical-rect'] = deriveEnvelope(plantsOf(GROUP_SCENARIOS[0].plantSlugs));
    // Disjoint humidity/temp ranges invert (min > max) — the caller-detected signal.
    captured['envelope:inverted-ranges'] = deriveEnvelope(
      plantsOf(['fittonia-albivenis', 'haworthia-attenuata']),
    );
    captured['envelope:empty-throws'] = thrown(() => deriveEnvelope([]));
    captured['placement:clamp'] = {
      inBounds: clampPlacement({ slug: 'p', x: 0.5, y: 0.5, scale: 1 }),
      offPlane: clampPlacement({ slug: 'p', x: -0.2, y: 1.7, scale: 9 }),
      // Non-finite coordinates collapse to 0 and scale to the band minimum.
      nonFinite: clampPlacement({ slug: 'p', x: Number.NaN, y: Number.POSITIVE_INFINITY, scale: Number.NaN }),
      withMargin: clampPlacement({ slug: 'p', x: 0.01, y: 0.99, scale: 1 }, 0.08),
      marginCappedAtHalf: clampPlacement({ slug: 'p', x: 0.5, y: 0.5, scale: 1 }, 0.9),
    };
    captured['placement:move'] = movePlacement({ slug: 'p', x: 0.5, y: 0.5, scale: 1 }, 0.25, -0.75, 0.08);
    captured['placement:scale'] = scalePlacement({ slug: 'p', x: 0.5, y: 0.5, scale: 1 }, 2);
    captured['placement:upsert'] = {
      replaceExisting: upsertPlacement(EXPORT_PLACEMENTS, {
        slug: 'fittonia-albivenis',
        x: 0.9,
        y: 0.1,
        scale: 2,
      }),
      appendNew: upsertPlacement(EXPORT_PLACEMENTS, {
        slug: 'adiantum-raddianum',
        x: 0.5,
        y: 0.5,
        scale: 1,
      }),
    };
    captured['placement:remove'] = removePlacement(EXPORT_PLACEMENTS, 'calathea-ornata');
    captured['placement:defaults'] = [0, 1, 2, 3, 4, 5].map((i) => defaultPlacement(`plant-${i}`, i));
    captured['placement:isInsidePlane'] = {
      onEdge: isInsidePlane({ slug: 'p', x: 0, y: 1, scale: 1 }),
      outside: isInsidePlane({ slug: 'p', x: 1.01, y: 0.5, scale: 1 }),
    };
    checkFamily('recommend', captured);
  });

  it('backup payload: exportBackup / restore round-trip / migrate ladder', async () => {
    const captured: Record<string, unknown> = {};
    const { db } = makeTestDb();

    // §5-mirroring seed (runbook decision 8): 6 builds across both shapes, a mix +
    // charcoal build, overrides incl. a mute, placements on two builds, tags +
    // description, 4 care-mark kinds incl. a plant-scoped one, and 2 photo rows
    // whose absence from the envelope proves the by-design photo exclusion.
    // Everything pinned: literal ids, scenario dates, no repos, no newId().
    await db.insert(builds).values([
      {
        id: 'gb-01',
        name: 'Rainforest Shelf Jar',
        containerSlug: 'golden-rect-30',
        containerShape: 'rectangular',
        containerDimensions: { length: 30, width: 20, height: 25 },
        containerVolumeL: computeVolumeL('rectangular', { length: 30, width: 20, height: 25 }),
        containerOpening: 'lidded',
        plantSlugs: ['fittonia-albivenis', 'calathea-ornata', 'adiantum-raddianum'],
        tags: ['gift', 'humid'],
        description: 'Golden-fixture backup build — every optional surface filled.',
        placements: EXPORT_PLACEMENTS,
        substrateDepth: 6,
        drainageDepth: 2,
        charcoalDepth: 1.5,
        substrateMix: EXPORT_MIX,
        careOverrides: { 'watering-inspection': { intervalDays: 10 } },
        primaryPhotoId: 'gp-01',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
      },
      {
        id: 'gb-02',
        name: 'Desert Bowl',
        containerShape: 'cylindrical',
        containerDimensions: { diameter: 25, height: 20 },
        containerVolumeL: computeVolumeL('cylindrical', { diameter: 25, height: 20 }),
        containerOpening: 'open',
        plantSlugs: ['haworthia-attenuata', 'echeveria-elegans', 'crassula-ovata-mini'],
        tags: [],
        createdAt: new Date('2026-01-16T12:00:00Z'),
        updatedAt: new Date('2026-01-16T12:00:00Z'),
      },
      {
        id: 'gb-03',
        name: 'Tall Jar',
        containerShape: 'cylindrical',
        containerDimensions: { diameter: 12, height: 40 },
        containerVolumeL: computeVolumeL('cylindrical', { diameter: 12, height: 40 }),
        containerOpening: 'lidded',
        plantSlugs: ['fittonia-albivenis', 'soleirolia-soleirolii', 'episcia-cupreata', 'pilea-involucrata'],
        tags: ['tall'],
        placements: [{ slug: 'soleirolia-soleirolii', x: 0.42, y: 0.7, scale: 0.9 }],
        careOverrides: { 'lid-opening': { muted: true }, trimming: { intervalDays: 21 } },
        createdAt: new Date('2026-01-17T12:00:00Z'),
        updatedAt: new Date('2026-01-17T12:00:00Z'),
      },
      {
        id: 'gb-04',
        name: 'Single Fittonia',
        containerShape: 'cylindrical',
        containerDimensions: { diameter: 15, height: 20 },
        containerVolumeL: computeVolumeL('cylindrical', { diameter: 15, height: 20 }),
        containerOpening: 'sealed',
        plantSlugs: ['fittonia-albivenis'],
        tags: [],
        createdAt: new Date('2026-01-18T12:00:00Z'),
        updatedAt: new Date('2026-01-18T12:00:00Z'),
      },
      {
        id: 'gb-05',
        name: 'Crowded Cube',
        containerShape: 'rectangular',
        containerDimensions: { length: 10, width: 10, height: 15 },
        containerVolumeL: computeVolumeL('rectangular', { length: 10, width: 10, height: 15 }),
        containerOpening: 'sealed',
        plantSlugs: [
          'fittonia-albivenis',
          'soleirolia-soleirolii',
          'episcia-cupreata',
          'pilea-involucrata',
          'hypoestes-phyllostachya',
          'calathea-ornata',
        ],
        tags: ['experiment'],
        createdAt: new Date('2026-01-19T12:00:00Z'),
        updatedAt: new Date('2026-01-19T12:00:00Z'),
      },
      {
        id: 'gb-06',
        name: 'Micro Dome',
        containerShape: 'cylindrical',
        containerDimensions: { diameter: 10, height: 12 },
        containerVolumeL: computeVolumeL('cylindrical', { diameter: 10, height: 12 }),
        containerOpening: 'sealed',
        plantSlugs: ['soleirolia-soleirolii', 'fittonia-albivenis'],
        tags: [],
        description: 'Under a litre, sealed.',
        createdAt: new Date('2026-01-20T12:00:00Z'),
        updatedAt: new Date('2026-01-20T12:00:00Z'),
      },
    ]);
    await db.insert(buildPhotos).values([
      {
        id: 'gp-01',
        buildId: 'gb-01',
        filePath: 'photos/gb-01/hero.jpg',
        caption: 'Fresh build',
        takenAt: new Date('2026-01-16T09:00:00Z'),
        sortOrder: 0,
      },
      {
        id: 'gp-02',
        buildId: 'gb-03',
        filePath: 'photos/gb-03/one.jpg',
        takenAt: new Date('2026-01-20T18:30:00Z'),
        sortOrder: 1,
      },
    ]);
    await db.insert(careMarks).values([
      {
        id: 'gm-01',
        buildId: 'gb-01',
        kind: 'watering-inspection',
        note: 'Glass read moist — left it alone.',
        dueAt: new Date('2026-01-25T12:00:00Z'),
        completedAt: new Date('2026-01-26T08:00:00Z'),
        createdAt: new Date('2026-01-15T12:05:00Z'),
      },
      {
        id: 'gm-02',
        buildId: 'gb-01',
        kind: 'lid-opening',
        dueAt: new Date('2026-02-10T12:00:00Z'),
        createdAt: new Date('2026-01-15T12:05:00Z'),
      },
      {
        id: 'gm-03',
        buildId: 'gb-03',
        kind: 'settle-in',
        dueAt: new Date('2026-01-19T12:00:00Z'),
        completedAt: new Date('2026-01-19T13:00:00Z'),
        createdAt: new Date('2026-01-17T12:05:00Z'),
      },
      {
        id: 'gm-04',
        buildId: 'gb-02',
        plantSlug: 'haworthia-attenuata',
        kind: 'trimming',
        note: 'Pup crowding the parent rosette.',
        dueAt: new Date('2026-02-05T12:00:00Z'),
        createdAt: new Date('2026-01-16T12:05:00Z'),
      },
    ]);

    const envelope = await exportBackup(db, 'golden-fixture');
    // The one non-deterministic field — normalized before compare (runbook §4.1 row 9).
    captured['envelope'] = { ...envelope, exportedAt: 'NORMALIZED' };

    // Restore into a fresh store; counts + a re-export prove the lossless round-trip.
    const fresh = makeTestDb().db;
    captured['restore:counts'] = await restoreBackup(fresh, normalize(envelope));
    const reExported = await exportBackup(fresh, 'golden-fixture');
    expect(normalize(reExported.data)).toEqual(normalize(envelope.data));

    captured['restore:not-a-backup'] = await thrownAsync(() => restoreBackup(makeTestDb().db, { nope: true }));

    // The migrate ladder: v1 → v2 is the identity step (additive nullish fields).
    const v1Data = {
      builds: [
        {
          id: 'v1-01',
          name: 'V1 Jar',
          containerSlug: null,
          containerShape: 'rectangular',
          containerDimensions: { length: 20, width: 12, height: 18 },
          containerVolumeL: 4.32,
          containerOpening: 'lidded',
          plantSlugs: ['fittonia-albivenis'],
          tags: ['v1'],
          description: null,
          placements: null,
          substrateDepth: 4,
          drainageDepth: 1,
          primaryPhotoId: null,
          createdAt: '2025-11-02T10:00:00.000Z',
          updatedAt: '2025-11-02T10:00:00.000Z',
        },
      ],
      careMarks: [],
    };
    captured['migrate:v1-to-v2'] = migratePayload(v1Data, 1);
    captured['migrate:same-version'] = migratePayload(v1Data, STORE_SCHEMA_VERSION);
    captured['migrate:refuse-newer'] = thrown(() => migratePayload({}, STORE_SCHEMA_VERSION + 1));
    captured['migrate:missing-step'] = thrown(() => migratePayload({}, 0));
    captured['restore:v1-envelope-counts'] = await restoreBackup(makeTestDb().db, {
      schemaVersion: 1,
      data: v1Data,
    });
    captured['constants'] = { STORE_SCHEMA_VERSION };
    checkFamily('backup', captured);
  });
});
