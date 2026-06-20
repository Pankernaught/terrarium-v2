/**
 * Presentation-only label helpers — humanize the controlled vocabularies (light,
 * moisture, growth, …) for display. Pure string formatting, no engine semantics,
 * so the screens read consistently (v1 did `.replace("-", " ").title()` inline in
 * every page; this centralizes it).
 */
import type { LightRequirement, MoistureRequirement } from '@/types/plant';

/** "bright-indirect" → "Bright Indirect". */
export function humanize(value: string): string {
  return value
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Primary condition, with the tolerable secondary noted in parentheses. */
export function lightLabel(req: LightRequirement): string {
  return req.secondary
    ? `${humanize(req.primary)} (tolerates ${humanize(req.secondary)})`
    : humanize(req.primary);
}

export function moistureLabel(req: MoistureRequirement): string {
  return req.secondary
    ? `${humanize(req.primary)} (tolerates ${humanize(req.secondary)})`
    : humanize(req.primary);
}

/** Closed/Open terrarium suitability as a short phrase. */
export function suitabilityLabel(closedOk: boolean, openOk: boolean): string {
  const parts: string[] = [];
  if (closedOk) parts.push('Closed');
  if (openOk) parts.push('Open');
  return parts.length ? parts.join(' & ') : 'Neither';
}
