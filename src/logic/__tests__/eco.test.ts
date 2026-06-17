import { describe, expect, it } from 'vitest';

import { ecoBand, ecoBandLabel, ecoColor } from '../eco';

describe('ecoBand — v1 badge thresholds', () => {
  it('≥80 is healthy', () => {
    expect(ecoBand(100)).toBe('healthy');
    expect(ecoBand(80)).toBe('healthy');
  });
  it('50–79 is caution', () => {
    expect(ecoBand(79)).toBe('caution');
    expect(ecoBand(50)).toBe('caution');
  });
  it('<50 is critical', () => {
    expect(ecoBand(49)).toBe('critical');
    expect(ecoBand(0)).toBe('critical');
  });
  it('labels each band', () => {
    expect(ecoBandLabel('healthy')).toBe('Healthy');
    expect(ecoBandLabel('caution')).toBe('Caution');
    expect(ecoBandLabel('critical')).toBe('At risk');
  });
});

describe('ecoColor — OKLab sweep', () => {
  it('returns a valid hex for any score', () => {
    for (const s of [0, 25, 50, 65, 80, 100]) {
      expect(ecoColor(s)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('clamps out-of-range scores', () => {
    expect(ecoColor(-20)).toBe(ecoColor(0));
    expect(ecoColor(140)).toBe(ecoColor(100));
  });

  it('endpoints land on the configured stops', () => {
    expect(ecoColor(0)).toBe('#c0492f'); // critical red
    expect(ecoColor(100)).toBe('#3fa45b'); // healthy green
  });

  it('the midpoint is a vivid amber, not muddy brown (the OKLab payoff)', () => {
    // A naïve sRGB lerp of red↔green gives ~#80's grey-brown (R≈G, low sat).
    // OKLab keeps the amber: red channel stays clearly above blue, green high.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(ecoColor(65).slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(150);
    expect(g).toBeGreaterThan(110);
    expect(r - b).toBeGreaterThan(60); // warm, not grey
  });

  it('dark scheme raises lightness vs light scheme at the same score', () => {
    const lum = (hex: string) =>
      [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(lum(ecoColor(100, 'dark'))).toBeGreaterThan(lum(ecoColor(100, 'light')));
  });
});
