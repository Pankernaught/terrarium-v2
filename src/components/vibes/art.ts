/**
 * Per-vibe art slots — static `require()` literals (Metro bundles only static
 * requires, never `require(dynamicString)`). Each vibe owns its art the way each
 * plant owns its image; the render reads `VibeArt[vibe].<slot>`.
 *
 * The record is **open** by design — adding a slot is one `require()` line + one PNG
 * dropped at the path (ADR 0007). A typo'd slot is a runtime miss, not a compile
 * error; the CI gate (`src/data/__tests__/vibe-art.test.ts`) asserts every file
 * referenced here exists on disk under `assets/vibes/`, so a missing/renamed file
 * fails CI instead of rendering broken on device.
 *
 * Values are Metro asset ids (`require()` → `number`), which `expo-image`'s `<Image
 * source>` accepts directly.
 */
import type { VibeId } from '@/constants/theme';

export const VibeArt: Partial<Record<VibeId, Record<string, number>>> = {
  conservatory: {
    mascot: require('@/assets/vibes/conservatory/mascot.png'),
    foliageBack: require('@/assets/vibes/conservatory/foliage-back.png'),
    foliageFront: require('@/assets/vibes/conservatory/foliage-front.png'),
  },
};
