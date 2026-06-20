/**
 * Container geometry, custom-container construction, and dimension advice
 * (port of the pure functions in `engine/containers.py`).
 *
 * **DB-free by design.** v1's `resolve_build_container` was DB-coupled (it imported
 * `db.loader` / `ContainerModel` / a SQLAlchemy `Session`). It is a **pure**
 * function here that takes the candidate containers as an argument (the same
 * dependency-inversion `recommend()` uses) — so this module still imports nothing
 * from `src/db`/`src/data`. The repo / UI layer passes the bundled seed containers
 * (`loadContainers()`).
 *
 * **Dimension dicts (preserved exactly from v1):** rectangular shapes carry
 * `length`/`width`/`height`; cylindrical shapes carry `diameter`/`height`.
 */
import type { Container, ContainerOpening, ContainerShape, Plant } from '../types';

/** A loose dimension bag: rectangular uses length/width/height, cylindrical uses diameter/height. */
export type Dimensions = {
  length?: number;
  width?: number;
  height?: number;
  diameter?: number;
};

export const VALID_SHAPES: readonly ContainerShape[] = ['rectangular', 'cylindrical'];
export const VALID_OPENINGS: readonly ContainerOpening[] = ['sealed', 'lidded', 'open'];

/**
 * Round to 2 decimals, mirroring v1's `round(x, 2)` for display/volume values.
 * JS `Number.prototype.toFixed` returns a string that, when re-parsed, drops any
 * trailing zeros — so `10.0` reads back as `10`, matching Python float equality.
 */
function round2(value: number): number {
  return Number(value.toFixed(2));
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function isPositiveNumber(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Compute interior volume in litres from a shape + dimensions (all cm).
 *
 * Rectangular dimensions: `length`, `width`, `height`.
 * Cylindrical dimensions: `diameter`, `height`.
 *
 * @throws on an unknown shape or a missing/non-positive dimension.
 */
export function computeVolumeL(shape: string, dimensions: Dimensions): number {
  let cm3: number;
  if (shape === 'rectangular') {
    const { length, width, height } = dimensions;
    if (![length, width, height].every(isPositiveNumber)) {
      throw new Error('Rectangular container needs positive length/width/height.');
    }
    cm3 = (length as number) * (width as number) * (height as number);
  } else if (shape === 'cylindrical') {
    const { diameter, height } = dimensions;
    if (![diameter, height].every(isPositiveNumber)) {
      throw new Error('Cylindrical container needs positive diameter/height.');
    }
    cm3 = Math.PI * ((diameter as number) / 2) ** 2 * (height as number);
  } else {
    throw new Error(
      `Shape must be one of ${JSON.stringify(VALID_SHAPES)}, got ${JSON.stringify(shape)}.`,
    );
  }
  return round2(cm3 / 1000);
}

/**
 * Render a dimension without a trailing `.0` (v1 `_clean`). In JS a numeric `12.0`
 * already stringifies to `"12"` and `12.5` to `"12.5"`, so `String(value)` alone
 * reproduces v1's int-vs-float branching.
 */
function clean(value: number): string {
  return String(value);
}

/** Human-readable dimension string, e.g. `30×20×25 cm` or `⌀12×40 cm`. */
export function dimensionsToStr(shape: string, dimensions: Dimensions): string {
  if (shape === 'rectangular') {
    return (
      `${clean(dimensions.length as number)}×${clean(dimensions.width as number)}` +
      `×${clean(dimensions.height as number)} cm`
    );
  }
  return `⌀${clean(dimensions.diameter as number)}×${clean(dimensions.height as number)} cm`;
}

/**
 * Parse a preset `dimensionsCm` string (`LxWxH`) into a dimension bag by shape.
 *
 * Cylindrical presets store diameter as the first value and height as the last;
 * the middle value (duplicate diameter) is ignored.
 */
export function parseDimensionsStr(shape: string, dimensionsCm: string): Dimensions {
  const parts = dimensionsCm
    .toLowerCase()
    .replace(/×/g, 'x')
    .split('x')
    .map((p) => Number(p));
  if (shape === 'cylindrical') {
    return { diameter: parts[0], height: parts[parts.length - 1] };
  }
  return { length: parts[0], width: parts[1], height: parts[2] };
}

/** Derive the `suitableFor` field from the opening type (v1 `_suitable_for`). */
function suitableFor(opening: string): Container['suitableFor'] {
  return opening === 'open' ? 'open' : 'closed';
}

/**
 * Build a Container object from a custom spec (no DB).
 *
 * @throws on an invalid shape/opening or bad dimensions.
 */
export function makeContainer(
  shape: string,
  dimensions: Dimensions,
  opening: string,
  slug = 'custom',
  name: string | null = null,
): Container {
  if (!VALID_OPENINGS.includes(opening as ContainerOpening)) {
    throw new Error(`Opening must be one of ${JSON.stringify(VALID_OPENINGS)}, got ${JSON.stringify(opening)}.`);
  }
  const volumeL = computeVolumeL(shape, dimensions);
  const resolvedName =
    name ?? `Custom ${shape.charAt(0).toUpperCase()}${shape.slice(1)} (${volumeL} L)`;
  return {
    slug,
    name: resolvedName,
    volumeL,
    opening: opening as ContainerOpening,
    dimensionsCm: dimensionsToStr(shape, dimensions),
    shape: shape as ContainerShape,
    suitableFor: suitableFor(opening),
  };
}

/**
 * The container-bearing fields of a saved build — the snapshot the planner wrote
 * plus the provenance slug. Matches the camelCase shape of the persisted `Build`
 * row (and any plain object carrying these keys), without importing the DB layer.
 */
export interface BuildContainerSnapshot {
  containerShape?: string | null;
  containerDimensions?: Dimensions | null;
  containerOpening?: string | null;
  containerSlug?: string | null;
}

/**
 * Resolve the `Container` for a build, from its geometry snapshot or its preset
 * slug (port of v1 `engine/containers.resolve_build_container`).
 *
 * - A full snapshot (`shape` + `dimensions` + `opening`) is **authoritative** —
 *   it rebuilds the container with the pure constructor, no lookup needed.
 * - Otherwise a `slug` is resolved against the supplied `candidates` (the seed
 *   containers, passed in by the caller — the engine never reaches the DB/bundle).
 * - Neither present → `null`.
 *
 * v2 note: v1 looked the slug up in the `ContainerModel` table; here the caller
 * passes `loadContainers()` so this stays pure and mostly collapses into
 * `makeContainer`.
 */
export function resolveBuildContainer(
  build: BuildContainerSnapshot,
  candidates: readonly Container[] = [],
): Container | null {
  const shape = build.containerShape;
  const dimensions = build.containerDimensions;
  const opening = build.containerOpening;
  const slug = build.containerSlug;

  if (shape && dimensions && opening) {
    return makeContainer(shape, dimensions, opening, slug ?? 'custom');
  }
  if (slug) {
    return candidates.find((c) => c.slug === slug) ?? null;
  }
  return null;
}

/**
 * Default `[substrateCm, drainageCm]` for a build, matching guide logic.
 *
 * Deeper substrate for tall plants, more drainage for moisture-lovers, and no
 * drainage in micro (<1 L) containers.
 *
 * **Decision 15 ripple:** v1 read the scalar `soil_moisture`; the analog here is
 * `soilMoisture.primary`.
 */
export function defaultLayerDepths(plants: Plant[], volumeL: number): [number, number] {
  const hasTall = plants.some((p) => p.maxHeightCm > 15);
  const substrateCm = hasTall ? 7.0 : 4.0;

  let drainageCm: number;
  if (volumeL < 1.0) {
    drainageCm = 0.0;
  } else if (plants.some((p) => p.soilMoisture.primary === 'wet' || p.soilMoisture.primary === 'moist')) {
    drainageCm = 2.5;
  } else {
    drainageCm = 1.0;
  }
  return [substrateCm, drainageCm];
}

/**
 * Cross-section band boundaries for the container visualizer (no DB).
 *
 * Each `*TopCm` is the y-height (cm, measured from the interior base) of the **top**
 * of that layer. Layers stack bottom→top: drainage → charcoal → substrate, so
 * `drainageTopCm ≤ charcoalTopCm ≤ substrateTopCm`. The planting surface is the
 * substrate top; plants and root bands are measured from there.
 */
export interface ContainerProfile {
  interiorHeightCm: number;
  widthCm: number;
  drainageTopCm: number;
  /** Top of the charcoal layer (= `drainageTopCm` when there is no charcoal layer). */
  charcoalTopCm: number;
  substrateTopCm: number;
  plantingSurfaceCm: number;
  plantTopCm: number;
  headroomCm: number;
  overflowCm: number;
}

/**
 * Compute cross-section band boundaries for the container visualizer (no DB).
 *
 * Returns y-boundaries (cm, measured from the base) for each layer plus the
 * headroom above the planting surface and any plant overflow above the rim. The
 * layer order is drainage → charcoal → substrate; `charcoalCm` defaults to 0 so an
 * older caller (and any build with no charcoal layer) collapses the charcoal band to
 * zero height and gets the exact pre-charcoal boundaries. All values are clamped to
 * the container's interior height.
 */
export function containerProfile(
  shape: string,
  dimensions: Dimensions,
  substrateCm = 0.0,
  drainageCm = 0.0,
  tallestPlantCm = 0.0,
  charcoalCm = 0.0,
): ContainerProfile {
  const interiorH = Number(dimensions.height);
  const widthCm = Number(shape === 'cylindrical' ? dimensions.diameter : dimensions.length);

  const drainageTop = Math.min(drainageCm, interiorH);
  const charcoalTop = Math.min(drainageTop + charcoalCm, interiorH);
  const substrateTop = Math.min(charcoalTop + substrateCm, interiorH);
  const plantingSurface = substrateTop;
  const headroomCm = Math.max(0.0, interiorH - plantingSurface);
  const plantTop = plantingSurface + tallestPlantCm;
  const overflowCm = Math.max(0.0, plantTop - interiorH);

  return {
    interiorHeightCm: interiorH,
    widthCm,
    drainageTopCm: drainageTop,
    charcoalTopCm: charcoalTop,
    substrateTopCm: substrateTop,
    plantingSurfaceCm: plantingSurface,
    plantTopCm: plantTop,
    headroomCm: round1(headroomCm),
    overflowCm: round1(overflowCm),
  };
}

/** Result of `recommendContainerDimensions`. */
export interface ContainerRecommendation {
  shape: ContainerShape;
  dimensions: Dimensions;
  opening: ContainerOpening;
  volumeL: number;
  rationale: string[];
}

/**
 * Suggest a container shape/dimensions/opening from the chosen plants.
 *
 * Sizes height from the tallest plant plus substrate and headroom, footprint
 * from the plant count, and opening from whether any plant requires an open
 * container.
 *
 * @throws if `plants` is empty.
 */
export function recommendContainerDimensions(plants: Plant[]): ContainerRecommendation {
  if (plants.length === 0) {
    throw new Error('Cannot recommend container dimensions for no plants.');
  }

  const tallest = Math.max(...plants.map((p) => p.maxHeightCm));
  const substrateCm = tallest > 15 ? 7.0 : 4.0;
  const headroomCm = Math.max(6.0, Math.round(tallest * 0.5));
  const recHeight = Math.ceil(substrateCm + tallest + headroomCm);

  const n = plants.length;
  const side = Math.min(40, Math.max(10, 8 + 5 * n));

  const needsOpen = plants.some((p) => !p.closedTerrariumOk);
  const opening: ContainerOpening = needsOpen ? 'open' : 'lidded';

  const shape: ContainerShape = n === 1 ? 'cylindrical' : 'rectangular';
  let dimensions: Dimensions;
  if (shape === 'cylindrical') {
    dimensions = { diameter: side, height: recHeight };
  } else {
    dimensions = {
      length: side,
      width: Math.max(10, Math.round(side * 0.7)),
      height: recHeight,
    };
  }

  const rationale = [
    `Height ${recHeight} cm = ~${Math.trunc(substrateCm)} cm substrate + ` +
      `${Math.trunc(tallest)} cm tallest plant + ${Math.trunc(headroomCm)} cm headroom.`,
    `Footprint sized for ${n} plant${n !== 1 ? 's' : ''}.`,
    needsOpen
      ? 'Open container suggested — at least one plant prefers open airflow.'
      : 'Lidded container suggested to hold humidity for these plants.',
  ];

  return {
    shape,
    dimensions,
    opening,
    volumeL: computeVolumeL(shape, dimensions),
    rationale,
  };
}
