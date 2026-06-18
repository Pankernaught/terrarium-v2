/** Port of `tests/test_guide.py` (decision-15 `.primary` scalar analog). */
import { describe, expect, it } from 'vitest';

import { generateBuildGuide } from '../guide';
import { makeContainerSpec, makePlant } from './factories';

describe('generateBuildGuide', () => {
  it('throws a ValueError-analog on empty plants', () => {
    const container = makeContainerSpec();
    expect(() => generateBuildGuide([], container)).toThrow(/At least one plant must be provided/);
  });

  it('skips drainage and separation layers for a micro container (< 1.0L)', () => {
    const plant = makePlant();
    const container = makeContainerSpec({ volumeL: 0.5 });

    const guide = generateBuildGuide([plant], container);
    const titles = guide.map((step) => step.title);

    expect(titles).not.toContain('Drainage Layer');
    expect(titles).not.toContain('Separation Layer');
  });

  it('includes drainage and separation layers for a standard container (>= 1.0L)', () => {
    const plant = makePlant();
    const container = makeContainerSpec({ volumeL: 1.0 });

    const guide = generateBuildGuide([plant], container);
    const titles = guide.map((step) => step.title);

    expect(titles).toContain('Drainage Layer');
    expect(titles).toContain('Separation Layer');
  });

  it('omits the hardscape step when no plant requires rock or wood', () => {
    const plant = makePlant({ substrateTags: ['peat', 'sphagnum'] });
    const container = makeContainerSpec();

    const guide = generateBuildGuide([plant], container);
    const titles = guide.map((step) => step.title);

    expect(titles).not.toContain('Hardscape Placement');
  });

  it('includes the hardscape step when a plant requires rock or wood', () => {
    const plant = makePlant({ substrateTags: ['rock', 'sphagnum'] });
    const container = makeContainerSpec();

    const guide = generateBuildGuide([plant], container);
    const titles = guide.map((step) => step.title);

    expect(titles).toContain('Hardscape Placement');
  });

  it('keeps the generic substrate-tags sentence when no mix recipe is given', () => {
    const plant = makePlant({ substrateTags: ['peat', 'sphagnum'] });
    const guide = generateBuildGuide([plant], makeContainerSpec());
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    expect(substrateStep.instruction).toContain('substrate explicitly supporting: peat, sphagnum');
    expect(substrateStep.instruction).not.toContain('custom mix');
  });

  it('describes the custom mix recipe + character when a mix is given', () => {
    const plant = makePlant({ substrateTags: ['peat'] });
    const guide = generateBuildGuide([plant], makeContainerSpec(), {
      substrateMix: {
        recipe: '2 parts coco coir, 1 part perlite, 1 part sphagnum moss',
        character: 'airy, moisture-retentive',
      },
    });
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    // "an" before the vowel-initial character phrase; recipe verbatim.
    expect(substrateStep.instruction).toContain(
      'your custom mix: 2 parts coco coir, 1 part perlite, 1 part sphagnum moss — ' +
        'an airy, moisture-retentive blend.',
    );
    expect(substrateStep.instruction).not.toContain('explicitly supporting');
  });

  it('uses "a" before a consonant-initial character phrase', () => {
    const plant = makePlant({ substrateTags: ['peat'] });
    const guide = generateBuildGuide([plant], makeContainerSpec(), {
      substrateMix: { recipe: '1 part coco coir', character: 'well-balanced' },
    });
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    expect(substrateStep.instruction).toContain('a well-balanced blend.');
  });

  it('numbers steps sequentially starting from 1', () => {
    const plant = makePlant({ substrateTags: ['rock'] }); // hardscape to max out steps
    const container = makeContainerSpec({ volumeL: 5.0 }); // drainage included

    const guide = generateBuildGuide([plant], container);

    guide.forEach((step, i) => {
      expect(step.step).toBe(i + 1);
    });
  });

  it('sorts plant placement tallest-first and flags fast growers', () => {
    const p1 = makePlant({
      slug: 'p1',
      commonName: 'Short Plant',
      maxHeightCm: 5,
      growthRate: 'slow',
    });
    const p2 = makePlant({
      slug: 'p2',
      commonName: 'Tall Fast Plant',
      maxHeightCm: 30,
      growthRate: 'fast',
    });
    const p3 = makePlant({
      slug: 'p3',
      commonName: 'Medium Plant',
      maxHeightCm: 15,
      growthRate: 'moderate',
    });

    const container = makeContainerSpec();
    const guide = generateBuildGuide([p1, p2, p3], container);

    const plantStep = guide.find((s) => s.title === 'Plant Placement');
    expect(plantStep).toBeDefined();
    const instruction = plantStep!.instruction;

    // Check ordering in the string.
    const idxTall = instruction.indexOf('Tall Fast Plant');
    const idxMed = instruction.indexOf('Medium Plant');
    const idxShort = instruction.indexOf('Short Plant');

    expect(idxTall).not.toBe(-1);
    expect(idxMed).not.toBe(-1);
    expect(idxShort).not.toBe(-1);
    expect(idxTall).toBeLessThan(idxMed);
    expect(idxMed).toBeLessThan(idxShort);

    // Check fast-grower mention.
    expect(instruction).toContain('Tall Fast Plant grow fast');
  });
});
