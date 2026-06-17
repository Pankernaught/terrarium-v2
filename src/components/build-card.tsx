/**
 * The dashboard build card — the deliberate collapse of v1's 7-button card
 * (`components/build_card.py`: Open / Build Guide / Post to Forum / Duplicate /
 * TXT / PDF / Delete) down to: hero photo + name + Eco-balance chip + a single ⋮
 * overflow, tap-to-open. "Post to Forum" is gone with social (decision 3).
 *
 * The Eco chip surfaces a scoring failure as a real "Needs review" state, never
 * v1's silent grey "⚠" (Phase 5 DoD). Colour is paired with the number + band
 * word, never colour alone (§2).
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import type { ScoredBuild } from '@/logic/score-build';
import { useTokens } from '@/hooks/use-tokens';

import { Card } from './ui/card';
import { EcoChip } from './ui/eco-chip';
import { Text } from './ui/text';

export interface BuildCardProps {
  name: string;
  plantCount: number;
  scored: ScoredBuild;
  heroUri: string | null;
  width: number;
  onPress: () => void;
  onOverflow: () => void;
}

export function BuildCard({ name, plantCount, scored, heroUri, width, onPress, onOverflow }: BuildCardProps) {
  const { c } = useTokens();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name}`} style={{ width }}>
      <Card>
        {/* Hero */}
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.hero} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.hero, styles.heroFallback, { backgroundColor: c.surfaceSunken }]}>
            <Text variant="headline" role="textMuted">
              🌿
            </Text>
          </View>
        )}

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="title" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            <Pressable
              onPress={onOverflow}
              accessibilityRole="button"
              accessibilityLabel={`More actions for ${name}`}
              hitSlop={10}
              style={styles.overflow}>
              <Text variant="title" role="textMuted">
                ⋮
              </Text>
            </Pressable>
          </View>
          <Text variant="caption" role="textMuted">
            {plantCount === 1 ? '1 plant' : `${plantCount} plants`}
          </Text>
          <EcoChip score={scored.score} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 150, borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.md, gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { flexShrink: 1 },
  overflow: { paddingHorizontal: Spacing.xs },
});
