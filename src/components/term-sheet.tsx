/**
 * Shared glossary term sheet (ADR 0006) — the single surface for Terms-mode list
 * taps AND inline chip / `[[slug]]` links. Sibling of `PlantSheet`, built on the
 * same `BottomSheet`.
 *
 * Driven by a slug. `seeAlso` cross-links swap the sheet's content **in place**
 * (same sheet, new term) via the `lastSlug`-reset pattern from `plant-sheet.tsx`,
 * so a reader can walk the dictionary without stacking sheets. The slug resolves
 * through `lookupTerm`; a slug with no entry degrades to a graceful "not found"
 * (the CI integrity checks make that path unreachable in shipped data).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BottomSheet, Chip, haptics, SectionLabel, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { lookupTerm } from '@/data';
import { humanize } from '@/lib/labels';
import { GLOSSARY_CATEGORY_LABELS } from '@/types';

export interface TermSheetProps {
  /** The term to show, by slug. `null` closes the sheet. */
  slug: string | null;
  onClose: () => void;
}

export function TermSheet({ slug, onClose }: TermSheetProps) {
  const { height } = useWindowDimensions();

  // Internal navigation so a `seeAlso` tap swaps content in place. Reset to the
  // prop slug whenever the parent opens a (different) term — the lastSlug pattern.
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [lastProp, setLastProp] = useState<string | null>(null);
  if (slug !== lastProp) {
    setLastProp(slug);
    setActiveSlug(slug);
  }

  const entry = activeSlug ? lookupTerm(activeSlug) : null;
  const title = entry?.term ?? (activeSlug ? humanize(activeSlug) : undefined);

  function goTo(next: string) {
    haptics.select();
    setActiveSlug(next);
  }

  return (
    <BottomSheet visible={slug != null} onClose={onClose} title={title}>
      {activeSlug ? (
        <ScrollView
          style={{ maxHeight: height * 0.55 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          {entry ? (
            <>
              <View style={styles.badgeRow}>
                <Chip label={GLOSSARY_CATEGORY_LABELS[entry.category]} tone="sage" selected />
              </View>

              <Text variant="body" role="textMuted" style={styles.definition}>
                {entry.definition}
              </Text>

              {entry.seeAlso.length > 0 ? (
                <View style={styles.seeAlso}>
                  <SectionLabel>Related</SectionLabel>
                  <View style={styles.chipWrap}>
                    {entry.seeAlso.map((ref) => {
                      const target = lookupTerm(ref);
                      return (
                        <Chip
                          key={ref}
                          label={target?.term ?? humanize(ref)}
                          tone="neutral"
                          onPress={() => goTo(ref)}
                        />
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text variant="body" role="textMuted" style={styles.definition}>
              No definition found for “{activeSlug}”.
            </Text>
          )}
        </ScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, paddingBottom: Spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  definition: { lineHeight: 22 },
  seeAlso: { gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
