// S7-SF-PDP — the product's custom fields, projected to renderable key/value rows. Shared by ProductCustomFields
// and the PDP "Detalhes" tab so both humanize the key and drop non-scalars the SAME way (a tab with no rows must
// not render). The kernel gives a typed, validated slot; the theme decides what it looks like and where it lives
// (deliberate doctrine — the kernel does not auto-render custom fields).

/** A definition carries no label (only the key), so the theme humanizes it: "peso_liquido" → "Peso liquido". */
export function labelOf(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Renderable values only: text/number/boolean/select land as scalars; anything structured is skipped. */
function displayValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return null;
}

/** The doc's `metadata` is `unknown` on the wire (a free JSONB bag) — only a plain object has fields. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** The (humanized-key, scalar-value) pairs of a product's custom-field bag, in insertion order, with empties
 * and non-scalars dropped. Empty array → the caller renders nothing (no table, no "Detalhes" tab). */
export function customFieldEntries(metadata: unknown): (readonly [string, string])[] {
  return Object.entries(asRecord(metadata))
    .map(([key, value]) => [key, displayValue(value)] as const)
    .filter((entry): entry is readonly [string, string] => entry[1] !== null);
}
