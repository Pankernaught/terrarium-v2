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

  it('uses a standard-mix sentence with the preset depth when no mix recipe is given', () => {
    const plant = makePlant();
    const guide = generateBuildGuide([plant], makeContainerSpec());
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    expect(substrateStep.instruction).toBe(
      'Add 3-5cm of a standard well-draining terrarium mix.',
    );
    expect(substrateStep.instruction).not.toContain('custom mix');
  });

  it('renders the build’s real substrate depth verbatim', () => {
    const plant = makePlant();
    const guide = generateBuildGuide([plant], makeContainerSpec(), { substrateDepth: 5 });
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    expect(substrateStep.instruction).toBe(
      'Add 5 cm of a standard well-draining terrarium mix.',
    );
  });

  it('describes the custom mix recipe + character when a mix is given', () => {
    const plant = makePlant();
    const guide = generateBuildGuide([plant], makeContainerSpec(), {
      substrateDepth: 6,
      substrateMix: {
        recipe: '2 parts coco coir, 1 part perlite, 1 part sphagnum moss',
        character: 'airy, moisture-retentive',
      },
    });
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    // "an" before the vowel-initial character phrase; real depth + recipe verbatim.
    expect(substrateStep.instruction).toBe(
      'Add 6 cm of your custom mix: 2 parts coco coir, 1 part perlite, 1 part sphagnum moss — ' +
        'an airy, moisture-retentive blend.',
    );
    expect(substrateStep.instruction).not.toContain('standard well-draining');
  });

  it('uses "a" before a consonant-initial character phrase', () => {
    const plant = makePlant();
    const guide = generateBuildGuide([plant], makeContainerSpec(), {
      substrateMix: { recipe: '1 part coco coir', character: 'well-balanced' },
    });
    const substrateStep = guide.find((s) => s.title === 'Substrate Layer')!;
    expect(substrateStep.instruction).toContain('a well-balanced blend.');
  });

  it('adds a charcoal layer line with its depth only when charcoalDepth > 0', () => {
    const plant = makePlant();
    const container = makeContainerSpec({ volumeL: 5.0 });

    const withCharcoal = generateBuildGuide([plant], container, { charcoalDepth: 1.5 });
    const charcoalStep = withCharcoal.find((s) => s.title === 'Charcoal Layer');
    expect(charcoalStep).toBeDefined();
    expect(charcoalStep!.instruction).toContain('1.5 cm');
    // Charcoal sits between the separation and substrate layers.
    const titles = withCharcoal.map((s) => s.title);
    expect(titles.indexOf('Charcoal Layer')).toBeGreaterThan(titles.indexOf('Separation Layer'));
    expect(titles.indexOf('Charcoal Layer')).toBeLessThan(titles.indexOf('Substrate Layer'));

    const noCharcoal = generateBuildGuide([plant], container, { charcoalDepth: 0 });
    expect(noCharcoal.map((s) => s.title)).not.toContain('Charcoal Layer');
  });

  it('omits the drainage + separation layers when drainageDepth is 0', () => {
    const plant = makePlant();
    const container = makeContainerSpec({ volumeL: 5.0 });

    const guide = generateBuildGuide([plant], container, { drainageDepth: 0 });
    const titles = guide.map((s) => s.title);
    expect(titles).not.toContain('Drainage Layer');
    expect(titles).not.toContain('Separation Layer');
  });

  it('renders the build’s real drainage depth verbatim', () => {
    const plant = makePlant();
    const container = makeContainerSpec({ volumeL: 5.0 });

    const guide = generateBuildGuide([plant], container, { drainageDepth: 2 });
    const drainageStep = guide.find((s) => s.title === 'Drainage Layer')!;
    expect(drainageStep.instruction).toContain('2 cm');
  });

  it('numbers steps sequentially starting from 1', () => {
    const plant = makePlant();
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
