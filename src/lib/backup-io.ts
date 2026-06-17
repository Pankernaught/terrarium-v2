/**
 * Whole-app backup/restore — the **device-only** IO around the pure
 * `src/db/backup.ts` (export/restore + the decision-17 import pipeline). Export
 * writes the `BackupEnvelope` JSON to a cache file and opens the share sheet;
 * restore picks a file (`expo-document-picker`), reads it, and hands the parsed
 * envelope to `restoreBackup` (migrate → validate → replace). The validation and
 * the round-trip are unit-tested in `src/db/__tests__/backup.test.ts`; this is the
 * file plumbing.
 */
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { exportBackup, type RestoreResult, restoreBackup } from '@/db/backup';
import type { TerrariumDb } from '@/db/schema';

/** Stamped into the envelope as provenance (decision 17 `appVersion`). */
const APP_VERSION = '1.0.0';

function backupFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `terrarium-backup-${stamp}.json`;
}

/** Export every build + care-mark to a JSON file and open the share sheet. */
export async function backupToFile(db: TerrariumDb): Promise<void> {
  const envelope = await exportBackup(db, APP_VERSION);
  const json = JSON.stringify(envelope, null, 2);

  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Back up your terrariums',
    UTI: 'public.json',
  });
}

/**
 * Pick a backup file and restore it (replace). Returns `null` if the user cancels
 * the picker; otherwise the restore counts. Surfaces a clear error for a file that
 * isn't valid JSON, propagating `restoreBackup`'s newer-version / corrupt rejection
 * messages to the caller (the whole file is rejected — no half-import).
 */
export async function restoreFromFile(db: TerrariumDb): Promise<RestoreResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const text = await new File(picked.assets[0].uri).text();
  let envelope: unknown;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON — it may be corrupt or not a Terrarium backup.');
  }
  return restoreBackup(db, envelope);
}
