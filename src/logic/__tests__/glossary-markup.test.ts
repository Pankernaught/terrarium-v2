import { describe, expect, it } from 'vitest';

import { glossaryMarkupSlugs, parseGlossaryMarkup } from '../glossary-markup';

describe('parseGlossaryMarkup', () => {
  it('returns a single text span when there is no markup', () => {
    expect(parseGlossaryMarkup('just plain prose')).toEqual([
      { kind: 'text', text: 'just plain prose' },
    ]);
  });

  it('returns [] for an empty string', () => {
    expect(parseGlossaryMarkup('')).toEqual([]);
  });

  it('links a bare [[slug]], showing the slug as its text', () => {
    expect(parseGlossaryMarkup('[[direct]]')).toEqual([
      { kind: 'link', slug: 'direct', text: 'direct' },
    ]);
  });

  it('links [[slug|display]] with the display text but the slug target', () => {
    expect(parseGlossaryMarkup('[[rhizome|rhizomes]]')).toEqual([
      { kind: 'link', slug: 'rhizome', text: 'rhizomes' },
    ]);
  });

  it('splits surrounding prose into text spans', () => {
    expect(parseGlossaryMarkup('keep out of [[direct]] light')).toEqual([
      { kind: 'text', text: 'keep out of ' },
      { kind: 'link', slug: 'direct', text: 'direct' },
      { kind: 'text', text: ' light' },
    ]);
  });

  it('keeps adjacent links separate with no text between', () => {
    expect(parseGlossaryMarkup('[[a]][[b]]')).toEqual([
      { kind: 'link', slug: 'a', text: 'a' },
      { kind: 'link', slug: 'b', text: 'b' },
    ]);
  });

  it('handles multiple links across a sentence', () => {
    const spans = parseGlossaryMarkup('a [[moss]] floor and a [[fern|fern]] canopy.');
    expect(spans).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'link', slug: 'moss', text: 'moss' },
      { kind: 'text', text: ' floor and a ' },
      { kind: 'link', slug: 'fern', text: 'fern' },
      { kind: 'text', text: ' canopy.' },
    ]);
  });

  it('trims whitespace from the slug but preserves spaces in the display', () => {
    expect(parseGlossaryMarkup('[[ false-bottom | false bottom ]]')).toEqual([
      { kind: 'link', slug: 'false-bottom', text: 'false bottom' },
    ]);
  });

  it('splits only on the first pipe (display may contain pipes)', () => {
    expect(parseGlossaryMarkup('[[a|b|c]]')).toEqual([{ kind: 'link', slug: 'a', text: 'b|c' }]);
  });

  it('leaves an empty-slug bracket group as literal text', () => {
    expect(parseGlossaryMarkup('see [[|nope]] here')).toEqual([
      { kind: 'text', text: 'see [[|nope]] here' },
    ]);
  });

  it('leaves an unclosed bracket as literal text', () => {
    expect(parseGlossaryMarkup('a [[dangling link')).toEqual([
      { kind: 'text', text: 'a [[dangling link' },
    ]);
  });
});

describe('glossaryMarkupSlugs', () => {
  it('collects every linked slug in order, keeping duplicates', () => {
    expect(glossaryMarkupSlugs('water the [[moss]], then the [[moss]] again, near [[direct]] sun')).toEqual(
      ['moss', 'moss', 'direct'],
    );
  });

  it('is empty when there are no links', () => {
    expect(glossaryMarkupSlugs('no links at all')).toEqual([]);
  });
});
