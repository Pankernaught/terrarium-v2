import { describe, expect, it } from 'vitest';

import {
  cmToIn,
  fmtDimensions,
  fmtLength,
  fmtLengthRange,
  fmtTempRange,
  fmtVolume,
  inToCm,
} from '../units';

describe('units', () => {
  it('round-trips cm ↔ in', () => {
    expect(inToCm(12)).toBeCloseTo(30.48, 5);
    expect(cmToIn(30.48)).toBeCloseTo(12, 5);
  });

  it('formats length per unit, dropping trailing .0', () => {
    expect(fmtLength(12, 'metric')).toBe('12 cm');
    expect(fmtLength(2.54, 'imperial')).toBe('1 in');
  });

  it('formats a length range', () => {
    expect(fmtLengthRange(5, 8, 'metric')).toBe('5–8 cm');
    expect(fmtLengthRange(2.54, 5.08, 'imperial')).toBe('1–2 in');
    expect(fmtLengthRange(5, '?', 'metric')).toBe('5–? cm');
  });

  it('formats a temperature range in whole degrees', () => {
    expect(fmtTempRange(18, 24, 'metric')).toBe('18–24°C');
    expect(fmtTempRange(20, 25, 'imperial')).toBe('68–77°F');
  });

  it('formats volume as L or US gallons', () => {
    expect(fmtVolume(10, 'metric')).toBe('10 L');
    expect(fmtVolume(3.785411784, 'imperial')).toBe('1 gal');
  });

  it('formats dimensions per unit', () => {
    expect(fmtDimensions('rectangular', { length: 30, width: 20, height: 25 }, 'metric')).toBe(
      '30×20×25 cm',
    );
    expect(fmtDimensions('cylindrical', { diameter: 2.54, height: 25.4 }, 'imperial')).toBe(
      '⌀1×10 in',
    );
  });
});
