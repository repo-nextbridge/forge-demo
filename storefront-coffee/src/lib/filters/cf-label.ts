// How a facetable custom field is NAMED to a shopper — the key and the value.
//
// ★ QA20/B9 (S2A-2) — the port serves the tenant's own data: the raw key (`impermeavel`) and the raw value, and
// a JSON boolean reaches the read as the literal string "true"/"false" (`jsonb_each_text`). The sidebar rendered
// both, so a pt-BR store offered links reading "false (1)" and "true (38)" and a chip reading
// "impermeavel: true". That is programmer vocabulary in front of a buyer, who cannot know what "false" filters.
//
// The translation lives HERE and only here, so the sidebar and the active chips cannot drift apart, and it
// touches the LABEL only: the URL, the filter and the port contract keep the raw value.
//
// ⚠️ The boolean rule is about the VALUE, never a list of field names: any facetable field whose values are the
// two JSON booleans reads as Sim/Não. A blacklist of keys would go stale the day a tenant declares another one.

/** Titled labels for the facetable custom-field keys the demo catalog ships. Unknown keys degrade to a
 * capitalized key, so a new facet is never shown lowercase-and-raw. */
const CF_LABELS: Record<string, string> = {
  genero: 'Gênero',
  material: 'Material',
  uso: 'Uso',
  pisada: 'Pisada',
  amortecimento: 'Amortecimento',
  solado: 'Solado',
  fechamento: 'Fechamento',
  cano: 'Cano',
  impermeavel: 'Impermeável',
};

export function cfLabel(key: string): string {
  return CF_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** The shopper-facing form of a cf VALUE. A JSON boolean becomes the word for it; everything else is the
 * tenant's own text and is shown as typed. */
export function cfValueLabel(value: string): string {
  if (value === 'true') return 'Sim';
  if (value === 'false') return 'Não';
  return value;
}
