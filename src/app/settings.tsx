/**
 * Settings — data durability lives here (decision 7): "Back up to file" /
 * "Restore from file", wrapping the pure `src/db/backup.ts` pipeline through the
 * device IO in `src/lib/backup-io.ts`. Restore is **replace** (decision 17), so it
 * goes behind a confirm; a newer-version or corrupt file is rejected cleanly with
 * the message the pipeline surfaces (no half-import).
 *
 * Preferences (theme, units) are Phase 9 — this screen is the backup surface now.
 */
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, GlanceHeader, haptics, Screen, SectionLabel, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { type Repos, useDbState } from '@/db/provider';
import { backupToFile, restoreFromFile } from '@/lib/backup-io';
import { useTokens } from '@/hooks/use-tokens';

export default function SettingsScreen() {
  const state = useDbState();
  return (
    <Screen edges={{ bottom: true }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <GlanceHeader title="Settings" subtitle="Back up and restore your terrariums" />
        {state.status === 'ready' ? (
          <BackupSection repos={state.repos} />
        ) : (
          <Card style={styles.card}>
            <Text variant="body" role="textMuted">
              {state.status === 'error' ? state.error : 'Opening your library…'}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

function BackupSection({ repos }: { repos: Repos }) {
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null);

  async function onBackup() {
    setBusy('backup');
    try {
      await backupToFile(repos.db);
    } catch (err) {
      Alert.alert('Backup failed', messageOf(err));
    } finally {
      setBusy(null);
    }
  }

  function onRestore() {
    // Restore = replace (decision 17): confirm before wiping current data.
    Alert.alert(
      'Restore from file?',
      'This replaces all of your current terrariums and care notes with the contents of the backup. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: doRestore },
      ],
    );
  }

  async function doRestore() {
    setBusy('restore');
    try {
      const result = await restoreFromFile(repos.db);
      if (result === null) return; // user cancelled the picker
      haptics.success();
      Alert.alert(
        'Restore complete',
        `Restored ${result.builds} ${result.builds === 1 ? 'terrarium' : 'terrariums'}` +
          `${result.careMarks > 0 ? ` and ${result.careMarks} care notes` : ''}.`,
      );
    } catch (err) {
      // Newer-version / corrupt / not-a-backup all land here with a clear message.
      Alert.alert('Couldn’t restore', messageOf(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.section}>
      <SectionLabel>Backup</SectionLabel>
      <Card style={styles.card}>
        <Text variant="body" role="textMuted" style={styles.note}>
          Back up your builds, placements, and care notes to a single JSON file you control. Photos
          aren’t included (they stay on your device).
        </Text>
        <Row label="Back up to file" busy={busy === 'backup'} disabled={busy !== null} onPress={onBackup} />
        <Divider />
        <Row
          label="Restore from file"
          destructive
          busy={busy === 'restore'}
          disabled={busy !== null}
          onPress={onRestore}
        />
      </Card>
    </View>
  );
}

function Row({
  label,
  onPress,
  busy,
  disabled,
  destructive,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const { c } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={[styles.row, disabled && !busy && styles.rowDisabled]}>
      <Text variant="body" style={{ color: destructive ? c.accent : c.primary, fontWeight: '600' }}>
        {label}
      </Text>
      <Text variant="body" role="textMuted">
        {busy ? '…' : '›'}
      </Text>
    </Pressable>
  );
}

function Divider() {
  const { c } = useTokens();
  return <View style={[styles.divider, { backgroundColor: c.border }]} />;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const styles = StyleSheet.create({
  scroll: { gap: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.sm },
  card: { padding: Spacing.lg, gap: Spacing.sm },
  note: { lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  rowDisabled: { opacity: 0.4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
});
