/**
 * The dashboard build card — the deliberate collapse of v1's 7-button card
 * (`components/build_card.py`: Open / Build Guide / Post to Forum / Duplicate /
 * TXT / PDF / Delete) down to: hero photo + name + Eco-balance chip + a single ⋮
 * overflow, tap-to-open. Social sharing is cut.
 *
 * The Eco chip surfaces a scoring failure as a real "Needs review" state, never
 * v1's silent grey "⚠". Colour is always paired with the number + band word —
 * never colour alone (accessibility rule: never encode meaning in colour only).
 */
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TerrariumCrossSection } from '@/components/planner/cross-section';
import { draftFromBuild } from '@/components/planner/draft';
import { vibeMascot } from '@/components/vibes/art';
import { Radii, Spacing } from '@/constants/theme';
import type { Build } from '@/db/schema';
import type { ScoredBuild } from '@/logic/score-build';
import type { Plant } from '@/types/plant';
import { useTokens } from '@/hooks/use-tokens';

import { Card } from './ui/card';
import { EcoChip } from './ui/eco-chip';
import { Text } from './ui/text';

/** Stable no-op — the card cross-section is view-only (no drag commits). */
function noop() {}

export interface BuildCardProps {
  name: string;
  plantCount: number;
  scored: ScoredBuild;
  heroUri: string | null;
  /** The build, for the schematic cross-section shown when there's no photo. */
  build: Build;
  /** Resolved plant records for this build (height bars in the schematic). */
  plants: readonly Plant[];
  width: number;
  onPress: () => void;
  onOverflow: () => void;
}

export function BuildCard({ name, plantCount, scored, heroUri, build, plants, width, onPress, onOverflow }: BuildCardProps) {
  const { c, vibe } = useTokens();
  // Memoized on the build so a parent re-render (overflow sheet, delete window)
  // never rebuilds the SVG scene.
  const xsDraft = useMemo(() => draftFromBuild(build), [build]);
  const heroMascot = vibeMascot(vibe, 'pensive');

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name}`} style={{ width }}>
      <Card>
        {/* Hero — real photo, else a schematic cross-section, else the mascot. */}
        {heroUri ? (
          <Image source={{ uri: heroUri }} style={styles.hero} contentFit="cover" transition={150} />
        ) : build.containerShape && build.containerDimensions ? (
          <TerrariumCrossSection
            draft={xsDraft}
            plants={plants}
            draggableKind={null}
            onCommit={noop}
            height={150}
          />
        ) : (
          <View style={[styles.hero, styles.heroFallback, { backgroundColor: c.surfaceSunken }]}>
            {heroMascot != null ? (
              <Image source={heroMascot} style={styles.heroMascot} contentFit="contain" />
            ) : (
              <Text variant="headline" role="textMuted">
                🌿
              </Text>
            )}
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
          <EcoChip score={scored.score} empty={scored.empty} />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 150, borderTopLeftRadius: Radii.lg, borderTopRightRadius: Radii.lg },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroMascot: { width: 90, height: 90 },
  body: { padding: Spacing.md, gap: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { flexShrink: 1 },
  overflow: { paddingHorizontal: Spacing.xs },
});
