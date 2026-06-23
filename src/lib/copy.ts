/**
 * Authored UI copy, looked up by key from `src/data/copy.json`.
 *
 * The catalog holds every editable sentence the app shows — screen copy, the
 * build-guide steps, and the compatibility/verdict warnings — so prose can be
 * reworded in the Plant Admin "Copy" tab instead of in source. The branching
 * logic that *chooses* which entry fires (and computes the numbers/names) stays
 * in code; the catalog only owns the wording.
 *
 * Templates carry `{slot}` placeholders the caller fills, e.g.
 * `copy('guide.drainage', { depth: '2 cm', material: 'pebbles' })`. Keys are
 * typed against the JSON, so a typo or a renamed entry fails `tsc`, not the device.
 */
import catalog from '../data/copy.json';

export type CopyKey = keyof typeof catalog;

/** Look up authored copy, substituting any `{slot}` placeholders. */
export function copy(key: CopyKey, slots?: Record<string, string | number>): string {
  let text: string = catalog[key];
  if (slots) {
    for (const k in slots) text = text.replaceAll(`{${k}}`, String(slots[k]));
  }
  return text;
}
