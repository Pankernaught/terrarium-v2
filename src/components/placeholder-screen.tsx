import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

/**
 * Phase 1 skeleton placeholder. The real screens (component library, dashboard,
 * browse, care, settings) are built in Phases 5+. This just proves the tab shell
 * boots and respects safe-area insets.
 */
export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.background }]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 14, textAlign: 'center' },
});
