/**
 * Shape-geometry seam tests — the cross-section's `ContainerShapeProfile`s. These
 * lock the contract every shape (and every future drop-in like fishbowl) must keep:
 * an *open* wall path, a *closed* interior clip path, a sane interior width, and a
 * registry lookup that always resolves to something drawable.
 */
import { describe, expect, it } from 'vitest';

import {
  CONTAINER_PROFILES,
  getContainerProfile,
  type Rect,
} from '../container-profiles';

const geom: Rect = { x: 10, y: 20, width: 100, height: 80 };

describe('container shape profiles', () => {
  it('registers the two v2 shapes', () => {
    expect(Object.keys(CONTAINER_PROFILES).sort()).toEqual(['cylindrical', 'rectangular']);
  });

  it('falls back to rectangular for a null/unknown shape', () => {
    expect(getContainerProfile(null).id).toBe('rectangular');
    expect(getContainerProfile(undefined).id).toBe('rectangular');
    expect(getContainerProfile('rectangular').id).toBe('rectangular');
    expect(getContainerProfile('cylindrical').id).toBe('cylindrical');
  });

  for (const [name, profile] of Object.entries(CONTAINER_PROFILES)) {
    describe(name, () => {
      it('wall path is open (no Z) and the clip path is closed (ends in Z)', () => {
        expect(profile.wallPath(geom)).not.toMatch(/Z\s*$/);
        expect(profile.interiorClipPath(geom).trim()).toMatch(/Z$/);
      });

      it('paths start at the rim and reach the floor', () => {
        const d = profile.wallPath(geom);
        expect(d.startsWith(`M ${geom.x} ${geom.y}`)).toBe(true);
        // The floor line (y = geom.y + geom.height) appears in the path.
        expect(d).toContain(String(geom.y + geom.height));
      });

      it('interior width is within the bounding box and positive', () => {
        for (const f of [0, 0.5, 1]) {
          const w = profile.interiorWidthAt(geom, f);
          expect(w).toBeGreaterThan(0);
          expect(w).toBeLessThanOrEqual(geom.width);
        }
      });
    });
  }

  it('rectangular has square corners (no quadratic curves)', () => {
    expect(CONTAINER_PROFILES.rectangular.wallPath(geom)).not.toContain('Q');
  });

  it('cylindrical rounds its base (uses quadratic curves)', () => {
    expect(CONTAINER_PROFILES.cylindrical.wallPath(geom)).toContain('Q');
  });
});
