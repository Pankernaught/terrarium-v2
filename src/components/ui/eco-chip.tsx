/**
 * The Eco-balance chip for a build card: a coloured dot (the OKLab sweep colour)
 * + the score % + a short band word. Colour is *never* the only signal — the dot
 * is always paired with the number and the band label (never colour alone).
 *
 * When a build can't be scored, the chip falls back to a neutral "Needs review"
 * with a warning glyph — a real, legible state, not v1's silent grey "⚠".
 */
import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { ecoBand, ecoBandLabel, ecoColor } from '@/logic/eco';
import { useTokens } from '@/hooks/use-tokens';

import { Text } from './text';

export interface EcoChipProps {
  /** 0–100, or `null` when scoring failed (renders the review state). */
  score: number | null;
}

export function EcoChip({ score }: EcoChipProps) {
  const { c, scheme } = useTokens();

  if (score === null) {
    return (
      <View style={[styles.chip, { backgroundColor: c.surfaceSunken }]}>
        <Text variant="caption" style={{ color: c.textMuted }}>
          ⚠ Needs review
        </Text>
      </View>
    );
  }

  const band = ecoBand(score);
  const color = ecoColor(score, scheme);
  return (
    <View style={[styles.chip, { backgroundColor: c.surfaceSunken }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="caption" style={{ color: c.text }}>
        {Math.round(score)}% · {ecoBandLabel(band)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  dot: { width: 9, height: 9, borderRadius: Radii.pill },
});
