/** Port of `tests/test_care.py` (reshaped to the decision-15 plant types). */
import { describe, expect, it } from 'vitest';

import { generateCareGuide } from '../care';
import { makeContainerSpec, makePlant } from './factories';

// v1 `slow_plant` fixture: bright-indirect / moist / slow grower.
const slowPlant = () =>
  makePlant({
    slug: 'slow-grower',
    commonName: 'Slow Plant',
    scientificName: 'Slow scientific',
    light: 'bright-indirect',
    soilMoisture: 'moist',
    humidityPctRange: [60, 90],
    tempCRange: [18, 28],
    maxHeightCm: 15,
    growthRate: 'slow',
    substrateTags: ['sphagnum', 'perlite'],
    closedTerrariumOk: true,
    openTerrariumOk: false,
    difficulty: 2,
  });

// v1 `fast_plant` fixture: medium / moist / fast grower.
const fastPlant = () =>
  makePlant({
    slug: 'fast-grower',
    commonName: 'Fast Plant',
    scientificName: 'Fast scientific',
    light: 'medium',
    soilMoisture: 'moist',
    humidityPctRange: [70, 95],
    tempCRange: [20, 30],
    maxHeightCm: 25,
    growthRate: 'fast',
    substrateTags: ['perlite', 'charcoal'],
    closedTerrariumOk: true,
    openTerrariumOk: false,
    difficulty: 1,
  });

// v1 `sealed_container` fixture.
const sealedContainer = () =>
  makeContainerSpec({
    slug: 'closed-jar',
    name: 'Glass Jar',
    volumeL: 3,
    opening: 'sealed',
    dimensionsCm: '15x15x30',
    suitableFor: 'closed',
  });

describe('generateCareGuide', () => {
  it('triggers the Trimming category for mixed growth rates', () => {
    const guide = generateCareGuide([slowPlant(), fastPlant()], sealedContainer());

    const categories = guide.map((item) => item.category);
    expect(categories).toContain('Watering');
    expect(categories).toContain('Humidity');
    expect(categories).toContain('Light');
    expect(categories).toContain('Trimming');
    // Substrate is built once, not maintained — the care guide stays silent on it.
    expect(categories).not.toContain('Substrate');

    // Both rates are named inside the tip content.
    const trimmingItem = guide.find((i) => i.category === 'Trimming');
    expect(trimmingItem).toBeDefined();
    expect(trimmingItem!.tip).toContain('slow');
    expect(trimmingItem!.tip).toContain('fast');
  });

  it('omits Trimming when growth rates match', () => {
    const guide = generateCareGuide([slowPlant(), slowPlant()], sealedContainer());

    const categories = guide.map((item) => item.category);
    expect(categories).not.toContain('Trimming');
  });

  it('raises a descriptive error on empty plants', () => {
    expect(() => generateCareGuide([], sealedContainer())).toThrow(
      /At least one plant must be provided/,
    );
  });
});
