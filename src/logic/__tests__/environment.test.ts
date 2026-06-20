/** Port of `tests/test_environment.py`, plus the primary/secondary union cases. */
import { describe, expect, it } from 'vitest';

import { deriveEnvelope } from '../environment';
import { makePlant } from './factories';

describe('deriveEnvelope', () => {
  it('returns a single plant’s own ranges', () => {
    const envelope = deriveEnvelope([makePlant()]);
    expect(envelope.humidityMin).toBe(60);
    expect(envelope.humidityMax).toBe(90);
  });

  it('signals a humidity conflict as an inverted range (min > max)', () => {
    const p1 = makePlant();
    const p2 = makePlant({ slug: 'desert-cactus', humidityPctRange: [10, 30] });
    const envelope = deriveEnvelope([p1, p2]);
    expect(envelope.humidityMin).toBeGreaterThan(envelope.humidityMax);
  });

  it('throws on an empty plant list', () => {
    expect(() => deriveEnvelope([])).toThrow(/empty/);
  });

  it('narrows the envelope for two overlapping plants', () => {
    const p1 = makePlant();
    const p2 = makePlant({
      slug: 'moss',
      humidityPctRange: [70, 100],
      tempCRange: [15, 25],
    });
    const envelope = deriveEnvelope([p1, p2]);
    expect(envelope.humidityMin).toBe(70);
    expect(envelope.humidityMax).toBe(90);
    expect(envelope.tempMin).toBe(18);
    expect(envelope.tempMax).toBe(25);
    expect(new Set(envelope.compatibleLights)).toEqual(new Set(['medium']));
    expect(new Set(envelope.compatibleMoisture)).toEqual(new Set(['moist']));
  });

  it('unions primary ∪ secondary into the display sets', () => {
    const a = makePlant({ slug: 'a', light: { primary: 'low', secondary: 'medium' } });
    const b = makePlant({
      slug: 'b',
      light: { primary: 'bright-indirect' },
      soilMoisture: { primary: 'moist', secondary: 'wet' },
    });
    const envelope = deriveEnvelope([a, b]);
    expect(new Set(envelope.compatibleLights)).toEqual(
      new Set(['low', 'medium', 'bright-indirect']),
    );
    expect(new Set(envelope.compatibleMoisture)).toEqual(new Set(['moist', 'wet']));
  });
});
