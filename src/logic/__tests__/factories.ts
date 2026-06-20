/**
 * Shared test factories — the TS analog of the pytest `_make_plant` /
 * `_make_container` fixtures. All ported engine suites build their inputs here.
 *
 * To keep the ported cases readable, `light` and `soilMoisture` accept either a
 * bare level string (wrapped as `{ primary }`, mirroring the v1 scalar) OR a full
 * `{ primary, secondary }` object for the primary/secondary cases.
 *
 * `makeContainerSpec` is named to avoid colliding with `makeContainer` in
 * `../containers` — the latter is the pure geometry constructor that *computes*
 * volume from dimensions; this one just stamps out a fully-specified Container.
 */
import {
  containerSchema,
  type Container,
  type LightLevel,
  type LightRequirement,
  type MoistureLevel,
  type MoistureRequirement,
  type Plant,
  plantSchema,
} from '../../types';

function asLight(v: LightLevel | LightRequirement): LightRequirement {
  return typeof v === 'string' ? { primary: v } : v;
}
function asMoisture(v: MoistureLevel | MoistureRequirement): MoistureRequirement {
  return typeof v === 'string' ? { primary: v } : v;
}

type PlantOverrides = Partial<Omit<Plant, 'light' | 'soilMoisture'>> & {
  light?: LightLevel | LightRequirement;
  soilMoisture?: MoistureLevel | MoistureRequirement;
};

export function makePlant(overrides: PlantOverrides = {}): Plant {
  const { light, soilMoisture, ...rest } = overrides;
  return plantSchema.parse({
    slug: 'fittonia',
    commonName: 'Nerve Plant',
    scientificName: 'Fittonia albivenis',
    light: asLight(light ?? 'medium'),
    humidityPctRange: [60, 90],
    soilMoisture: asMoisture(soilMoisture ?? 'moist'),
    tempCRange: [18, 28],
    maxHeightCm: 15,
    growthRate: 'slow',
    substrateTags: ['peat'],
    closedTerrariumOk: true,
    openTerrariumOk: false,
    difficulty: 2,
    ...rest,
  });
}

export function makeContainerSpec(overrides: Partial<Container> = {}): Container {
  return containerSchema.parse({
    slug: 'nano-sealed',
    name: 'Nano Sealed Jar',
    volumeL: 5,
    opening: 'sealed',
    dimensionsCm: '15x15x20',
    suitableFor: 'closed',
    ...overrides,
  });
}
