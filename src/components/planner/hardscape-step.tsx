/**
 * Hardscape step — pick generic wood/rock pieces to place on the 2-D front view
 * (decision 10). The palette here is *selection only*: tapping a piece toggles a
 * placement on the shared front plane; the actual drag-to-position happens in the
 * persistent preview pane above this body, not in this file.
 *
 * Because a hardscape slug is unique per asset id (`hardscapeSlug(id)`), each
 * palette item is a simple on/off toggle — an asset is either placed (one
 * instance, seeded by `defaultPlacement` so successive adds fan out) or absent.
 * The build-guide's hardscape line is *derived* from whether anything is placed
 * (`hasHardscape`), never a separate toggle. Presentational + pure: reads the
 * draft and emits patches through `update`, imports nothing from `@/db`.
 */
import { StyleSheet, View } from 'react-native';

import { Card, Chip, haptics, SectionLabel, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  defaultPlacement,
  hardscapeSlug,
  hasHardscape,
  isHardscapeSlug,
  removePlacement,
  upsertPlacement,
} from '@/logic/placement';

import { HARDSCAPE_ASSETS } from './hardscape-assets';
import type { StepProps } from './step';

export function HardscapeStep({ draft, update }: StepProps) {
  const { placements } = draft;

  const placedSlugs = new Set(placements.filter((p) => isHardscapeSlug(p.slug)).map((p) => p.slug));
  const anyPlaced = hasHardscape(placements);

  function toggle(assetId: string) {
    const slug = hardscapeSlug(assetId);
    haptics.select();
    if (placedSlugs.has(slug)) {
      update({ placements: removePlacement(placements, slug) });
      return;
    }
    const index = placements.filter((p) => isHardscapeSlug(p.slug)).length;
    update({ placements: upsertPlacement(placements, defaultPlacement(slug, index)) });
  }

  return (
    <View style={styles.group}>
      <Card style={styles.card}>
        <SectionLabel>Hardscape</SectionLabel>
        <Text variant="caption" role="textMuted">
          Tap a piece to add it. It appears in the preview above — drag it into place.
        </Text>

        <View style={styles.palette}>
          {HARDSCAPE_ASSETS.map((asset) => {
            const selected = placedSlugs.has(hardscapeSlug(asset.id));
            return (
              <Chip
                key={asset.id}
                label={`${asset.emoji}  ${asset.label}`}
                tone="sage"
                selected={selected}
                onPress={() => toggle(asset.id)}
              />
            );
          })}
        </View>

        {anyPlaced ? (
          <Text variant="caption" role="textMuted">
            A hardscape step is now part of your build guide — it follows from the pieces you place.
          </Text>
        ) : (
          <Text variant="caption" role="textMuted">
            Optional, but a piece of wood or rock gives a terrarium its shape — add one to begin.
          </Text>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.md },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
