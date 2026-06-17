/**
 * Migrate-ladder scaffold tests (decision 17). The real ladder is empty at v1
 * (no-op migrate), so the mechanism is exercised both against the real
 * `migratePayload` (identity + refuse-newer) and against `migrateWith` with a
 * *fake* ladder (chain application + missing-step guard) so the wiring is proven
 * before v2.1 registers a real step.
 */
import { describe, expect, it } from 'vitest';

import {
  type Migration,
  migratePayload,
  migrateWith,
  STORE_SCHEMA_VERSION,
} from '../migrate';

describe('store schema version', () => {
  it('starts at 1', () => {
    expect(STORE_SCHEMA_VERSION).toBe(1);
  });
});

describe('migratePayload (real ladder, empty at v1)', () => {
  it('is a no-op for a current-version payload', () => {
    const data = { builds: [{ id: 'b1' }], careMarks: [] };
    expect(migratePayload(data, 1)).toBe(data); // same reference — nothing ran
  });

  it('refuses a payload newer than this app', () => {
    expect(() => migratePayload({ builds: [], careMarks: [] }, 2)).toThrow(/newer version/i);
  });
});

describe('migrateWith (mechanism, fake ladder)', () => {
  const fake: Record<number, Migration> = {
    1: (d) => ({ ...d, v2: true }),
    2: (d) => ({ ...d, v3: true }),
  };

  it('applies each vN→vN+1 step in order', () => {
    expect(migrateWith(fake, { start: true }, 1, 3)).toEqual({ start: true, v2: true, v3: true });
  });

  it('applies a single step', () => {
    expect(migrateWith(fake, {}, 2, 3)).toEqual({ v3: true });
  });

  it('is identity when fromVersion === toVersion', () => {
    const d = { untouched: 1 };
    expect(migrateWith(fake, d, 2, 2)).toBe(d);
  });

  it('throws when a step in the chain is missing', () => {
    expect(() => migrateWith({}, {}, 1, 2)).toThrow(/No migration registered/);
  });

  it('refuses a payload newer than the target', () => {
    expect(() => migrateWith(fake, {}, 4, 2)).toThrow(/newer version/i);
  });
});
