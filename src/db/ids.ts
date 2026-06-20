/**
 * Primary-key generation. Every persisted row uses a generated **UUID**: builds
 * are referenced by care-marks and restore = replace, so an autoincrement
 * renumber-on-reinsert would dangle every reference. UUIDs are round-trip safe
 * and the natural key for the eventual sync backend.
 *
 * Node 22 (the test runner) has `crypto.randomUUID` globally. On device, Expo's
 * runtime exposes it too; the manual v4 fallback keeps id creation from ever
 * throwing if a runtime lacks it.
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC-4122-shaped fallback (non-cryptographic) — last resort only.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
