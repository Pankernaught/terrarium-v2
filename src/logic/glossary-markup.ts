/**
 * Glossary prose markup — the pure parser behind inline `[[slug]]` links (ADR 0006).
 *
 * Seed `notes`/`nativeContext` mark exactly which mentions link, author-controlled
 * rather than auto-scanned: `keep out of [[direct]] light`, `spreads by
 * [[rhizome|rhizomes]]`. This splits a string into a flat list of spans — plain
 * `text` runs and `link` runs — that the presentation layer renders, resolving each
 * link's `slug` through `lookupTerm`.
 *
 * The optional `|display` form handles grammar (plurals, tense) without changing the
 * slug; everything before the first `|` is the slug, the rest is the shown text. A
 * bracket group with an empty slug is left as literal text. The `[[ ]]` convention
 * deliberately mirrors the memory system's link syntax.
 *
 * Pure (no data import): the parser only finds and labels the spans. A seed-time +
 * test integrity check (Phase D) asserts every emitted `slug` resolves, so a typo'd
 * link fails CI instead of dead-linking on the device.
 */

export type GlossarySpan =
  | { kind: 'text'; text: string }
  | { kind: 'link'; slug: string; text: string };

/** `[[…]]` with a non-`]` inner run; non-greedy so adjacent links stay separate. */
const LINK_RE = /\[\[([^\]]+?)\]\]/g;

/**
 * Split `text` into ordered text/link spans. `[[slug]]` links the bare slug;
 * `[[slug|display]]` links `slug` but shows `display`. Returns `[]` for an empty
 * string, and a single `text` span when there is no markup.
 */
export function parseGlossaryMarkup(text: string): GlossarySpan[] {
  const spans: GlossarySpan[] = [];
  let last = 0;

  for (const m of text.matchAll(LINK_RE)) {
    const inner = m[1];
    const pipe = inner.indexOf('|');
    const slug = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
    // An empty slug isn't a link — leave the literal `[[…]]` in the text stream.
    if (!slug) continue;

    const display = (pipe === -1 ? slug : inner.slice(pipe + 1).trim()) || slug;
    const start = m.index ?? 0;
    if (start > last) spans.push({ kind: 'text', text: text.slice(last, start) });
    spans.push({ kind: 'link', slug, text: display });
    last = start + m[0].length;
  }

  if (last < text.length) spans.push({ kind: 'text', text: text.slice(last) });
  return spans;
}

/** Every slug referenced by `[[…]]` links in `text`, in order (duplicates kept). */
export function glossaryMarkupSlugs(text: string): string[] {
  return parseGlossaryMarkup(text)
    .filter((s): s is Extract<GlossarySpan, { kind: 'link' }> => s.kind === 'link')
    .map((s) => s.slug);
}
