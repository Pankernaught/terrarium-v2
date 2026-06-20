/**
 * Settings — three sections:
 *   Appearance — color scheme preference (System / Light / Dark)
 *   Backup     — back up to file / restore from file
 *   About      — version, feedback, made-by
 */
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, GlanceHeader, Screen, SectionLabel, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { type Repos, useDbState } from '@/db/provider';
import { backupToFile, restoreFromFile } from '@/lib/backup-io';
import { type ColorSchemePref, usePreferences } from '@/hooks/use-preferences';
import { useTokens } from '@/hooks/use-tokens';

export default function SettingsScreen() {
  const state = useDbState();
  return (
    <Screen edges={{ bottom: true }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <GlanceHeader title="Settings" subtitle="App preferences and backup" />
        <AppearanceSection />
        {state.status === 'ready' ? (
          <BackupSection repos={state.repos} />
        ) : (
          <View style={styles.section}>
            <SectionLabel>Backup</SectionLabel>
            <Card style={styles.card}>
              <Text variant="body" role="textMuted">
                {state.status === 'error' ? state.error : 'Opening your library…'}
              </Text>
            </Card>
          </View>
        )}
        <AboutSection />
      </ScrollView>
    </Screen>
  );
}

// --- Appearance --------------------------------------------------------------

const SCHEME_OPTIONS: { label: string; value: ColorSchemePref }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function AppearanceSection() {
  const { colorScheme, setColorScheme } = usePreferences();
  return (
    <View style={styles.section}>
      <SectionLabel>Appearance</SectionLabel>
      <Card style={styles.card}>
        <Text variant="body" role="textMuted">
          Color scheme
        </Text>
        <SegmentedControl options={SCHEME_OPTIONS} value={colorScheme} onChange={setColorScheme} />
      </Card>
    </View>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: ColorSchemePref }[];
  value: ColorSchemePref;
  onChange: (v: ColorSchemePref) => void;
}) {
  const { c } = useTokens();
  return (
    <View
      style={[styles.segmented, { backgroundColor: c.surfaceSunken }]}
      accessibilityRole="radiogroup">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && [styles.segmentActive, { backgroundColor: c.surface }]]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={opt.label}>
            <Text
              variant="caption"
              style={{ color: active ? c.primary : c.textMuted, fontWeight: active ? '600' : '400' }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Backup ------------------------------------------------------------------

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
    Alert.alert(
      'Restore from file?',
      "This replaces all of your current terrariums and care notes with the contents of the backup. This can’t be undone.",
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
      if (result === null) return;
      Alert.alert(
        'Restore complete',
        `Restored ${result.builds} ${result.builds === 1 ? 'terrarium' : 'terrariums'}` +
          `${result.careMarks > 0 ? ` and ${result.careMarks} care notes` : ''}.`,
      );
    } catch (err) {
      Alert.alert("Couldn't restore", messageOf(err));
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
          aren't included (they stay on your device).
        </Text>
        <ActionRow label="Back up to file" busy={busy === 'backup'} disabled={busy !== null} onPress={onBackup} />
        <Divider />
        <ActionRow
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

// --- About -------------------------------------------------------------------

function AboutSection() {
  const version = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.section}>
      <SectionLabel>About</SectionLabel>
      <Card style={styles.card}>
        <InfoRow label="Version" value={version} />
        <Divider />
        <ActionRow
          label="Send feedback"
          onPress={() => Linking.openURL('mailto:Larcomblucas@gmail.com')}
        />
        <Divider />
        <Text variant="caption" role="textMuted" style={styles.madeBy}>
          Made by Lucas Larcomb
        </Text>
      </Card>
    </View>
  );
}

// --- Shared row primitives ---------------------------------------------------

function ActionRow({
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body">{label}</Text>
      <Text variant="body" role="textMuted">
        {value}
      </Text>
    </View>
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
  segmented: {
    flexDirection: 'row',
    borderRadius: Radii.sm + 2,
    padding: 3,
    gap: 2,
    marginTop: Spacing.xs,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radii.sm,
    minHeight: 44,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  madeBy: { textAlign: 'center', paddingVertical: Spacing.xs },
});
