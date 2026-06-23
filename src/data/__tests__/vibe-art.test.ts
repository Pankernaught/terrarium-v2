/**
 * Vibe-art gate (mirrors images.test.ts for plants). Every PNG a vibe bundle
 * `require()`s must exist on disk under `assets/vibes/` — a missing or renamed file
 * fails CI instead of rendering broken on device. This is what makes the "open"
 * `art` record safe: a typo'd slot path is caught here, not by the compiler.
 *
 * It reads the art module as **text** and extracts the static `require('…')` paths,
 * rather than importing it — importing would try to resolve the PNG `require()`s in
 * Node, which only Metro can do. (Lives under src/data so the vitest include picks it
 * up; it isn't plant data, but it's an asset-existence gate, same as its sibling.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ART_MODULE = join(process.cwd(), 'src', 'components', 'vibes', 'art.ts');
// require('@/assets/vibes/<vibe>/<slot>.png') — capture the aliased path.
const REQUIRE_ASSET = /require\(\s*['"](@\/assets\/[^'"]+)['"]\s*\)/g;

function referencedAssetPaths(): string[] {
  const src = readFileSync(ART_MODULE, 'utf8');
  return [...src.matchAll(REQUIRE_ASSET)].map((m) => m[1].replace(/^@\/assets\//, 'assets/'));
}

describe('vibe art — every required PNG exists on disk', () => {
  const paths = referencedAssetPaths();

  it('finds at least one art require (the gate is actually wired)', () => {
    expect(paths.length).toBeGreaterThan(0);
  });

  it('has every referenced art file present under assets/vibes/', () => {
    const missing = paths.filter((p) => !existsSync(join(process.cwd(), p)));
    expect(missing).toEqual([]);
  });
});
