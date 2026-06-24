/**
 * Sort + collapse pairwise compatibility concerns for display.
 *
 * Two transforms, no severity headers:
 *   1. **Worst-first** — incompatible concerns float above cautions.
 *   2. **Collapse duplicates** — concerns that read identically apart from which
 *      other plant they name (e.g. the same "secondary light overlap, monitor"
 *      against three different plants) merge into one row; the extra plant names
 *      move to `alsoPlantNames`.
 *
 * The collapse key strips the *other* plant's name out of the rendered message,
 * so only genuinely-identical concerns merge — a different factor, different
 * preference, or different severity keeps its own row.
 */
export interface ConflictView {
  withPlantName: string;
  message: string;
  severity: 'caution' | 'incompatible';
  /** Other plants hit by the identical concern, collapsed into this one row. */
  alsoPlantNames?: string[];
}

/** Message with the other plant's name blanked out — the collapse identity. */
function templateKey(c: ConflictView): string {
  return c.severity + '|' + c.message.split(c.withPlantName).join('{}');
}

export function groupConflicts(raw: ConflictView[]): ConflictView[] {
  const groups = new Map<string, ConflictView>();
  for (const c of raw) {
    const key = templateKey(c);
    const existing = groups.get(key);
    if (existing) {
      (existing.alsoPlantNames ??= []).push(c.withPlantName);
    } else {
      groups.set(key, { ...c });
    }
  }
  // Array.sort is stable, so same-severity groups keep insertion order.
  return [...groups.values()].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );
}

const severityRank = (s: ConflictView['severity']): number =>
  s === 'incompatible' ? 0 : 1;
