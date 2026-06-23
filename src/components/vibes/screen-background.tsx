/**
 * The single seam between `Screen` and a vibe's backdrop. `Screen` mounts this
 * absolutely behind its content and forwards the (optional) `scrollY`; the dispatch
 * picks the active vibe's background, or `null` when the vibe is flat (Glasshouse).
 *
 * Adding a backdrop to a future vibe is one `case` here — no change to `Screen`.
 */
import { type SharedValue } from 'react-native-reanimated';

import { type VibeId } from '@/constants/theme';

import { ConservatoryBackground } from './conservatory-background';

export function ScreenBackground({ vibe, scrollY }: { vibe: VibeId; scrollY?: SharedValue<number> }) {
  switch (vibe) {
    case 'conservatory':
      return <ConservatoryBackground scrollY={scrollY} />;
    default:
      return null; // Glasshouse (and any vibe without a backdrop) = the flat themed View.
  }
}
