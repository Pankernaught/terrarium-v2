/**
 * The one empty-state card — used at first-run (home, care) and search-no-match
 * (browse). It renders the active vibe's featured mascot pose **iff defined** (ADR
 * 0007 A9): Conservatory greets with a face, Glasshouse stays text-only. The mascot
 * is centered above the title, ~100px, **static** — ambient critters carry the
 * motion, so the greeter is a calm focal point (and sidesteps reduce-motion).
 *
 * Extracting this killed the home/care duplication; browse's two no-match cards reuse
 * it with the `sad` pose (a failed search earns a commiserating face, not a cheery one).
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { vibeMascot, type MascotPose } from '@/components/vibes/art';
import { Radii, Spacing } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';

import { Card } from './card';
import { Text } from './text';

export interface EmptyStateProps {
  pose: MascotPose;
  title: string;
  body: string;
  /** Optional primary action (home's "New terrarium"). */
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ pose, title, body, cta }: EmptyStateProps) {
  const { c, vibe } = useTokens();
  const mascot = vibeMascot(vibe, pose);
  return (
    <Card style={styles.card}>
      {mascot != null ? (
        <Image source={mascot} style={styles.mascot} contentFit="contain" />
      ) : null}
      <Text variant="subhead">{title}</Text>
      <Text variant="body" role="textMuted" style={styles.body}>
        {body}
      </Text>
      {cta ? (
        <Pressable
          onPress={cta.onPress}
          accessibilityRole="button"
          style={[styles.cta, { backgroundColor: c.primary }]}>
          <Text variant="body" style={{ color: c.onPrimary, fontWeight: '600' }}>
            {cta.label}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, gap: Spacing.sm },
  // Centered above the title; ~100px; never behind text (sits on the card's surface).
  mascot: { width: 100, height: 100, alignSelf: 'center', marginBottom: Spacing.xs },
  body: { lineHeight: 22 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
  },
});
