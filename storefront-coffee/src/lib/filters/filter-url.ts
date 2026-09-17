// The PLP/search filter state <-> URL codec (SEARCH-6, yellow zone). The single source of the theme's filter
// URL convention (the de-facto contract with the read port): everything the sidebar/chips/sort do is a plain
// GET link built here, so the whole PLP works WITHOUT JS (progressive enhancement only layers on top). Pure —
// no React, no fetch — so it is unit-tested in isolation and reused by the templates and the read client.
//
// CONVENTION (mirrors packages/core read/catalog-filters.ts):
//   option.<name>=<v1>,<v2>   price_min=<cents>  price_max=<cents>  cf.<key>=<value>  sort=<enum>
// `q` and `page` are NOT filter state — the caller carries them; changing a filter resets to page 1 (drop page).

import { formatMoney } from '@forgeco/storefront-kit/money';
import type { StorePath } from '@forgeco/storefront-kit/store-route';
import { cfLabel, cfValueLabel } from './cf-label';

export const SORT_KEYS = ['relevance', 'price_asc', 'price_desc', 'newest', 'name'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type FilterState = {
  /** option axis name (lowercased) -> the OR-set of selected values. */
  options: Record<string, string[]>;
  /** facetable cf key -> selected value. */
  cf: Record<string, string>;
  priceMin?: number;
  priceMax?: number;
  /** S5-BRAND — the selected brand slug (a single value; a product has one brand). */
  brand?: string;
  sort?: SortKey;
};

type RawSearch = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === '' ? undefined : s;
}

function toInt(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Parse a Next `searchParams` record into a normalized FilterState (unknown/blank values dropped). */
export function parseFilterState(search: RawSearch): FilterState {
  const options: Record<string, string[]> = {};
  const cf: Record<string, string> = {};
  for (const [k, raw] of Object.entries(search)) {
    const v = first(raw);
    if (v === undefined) continue;
    if (k.startsWith('option.')) {
      const name = k.slice('option.'.length).toLowerCase();
      const values = v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (name && values.length) options[name] = values;
    } else if (k.startsWith('cf.')) {
      const key = k.slice('cf.'.length);
      if (key) cf[key] = v;
    }
  }
  const sortRaw = first(search.sort);
  const sort = SORT_KEYS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : undefined;
  return {
    options,
    cf,
    priceMin: toInt(first(search.price_min)),
    priceMax: toInt(first(search.price_max)),
    brand: first(search.brand),
    sort,
  };
}

/** Serialize a FilterState back to flat query params (the read-port / URL convention). Blank/empty are omitted;
 * facets is NOT here (it is a fetch concern, added by the caller). */
export function toQueryParams(state: FilterState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, values] of Object.entries(state.options)) {
    if (values.length) out[`option.${name}`] = values.join(',');
  }
  for (const [key, value] of Object.entries(state.cf)) {
    if (value) out[`cf.${key}`] = value;
  }
  if (state.priceMin !== undefined) out.price_min = String(state.priceMin);
  if (state.priceMax !== undefined) out.price_max = String(state.priceMax);
  if (state.brand) out.brand = state.brand;
  if (state.sort) out.sort = state.sort;
  return out;
}

/** Build a full href: basePath + the filter params + any extra (e.g. `q`). Deterministic key order (sorted) so
 * SSR output and tests are stable. Resets pagination by construction (page is never emitted here).
 *
 * MULTISTORE M1-β — `basePath` is a `StorePath`: a list's own address, already placed in the store of the
 * request (`storeHref(base, '/tenis')`). Every filter, sort and pagination link on the page is derived from it,
 * so ONE scoped value scopes all of them — and the type is what makes that a guarantee instead of a habit. It
 * is deliberately not a `(base, path)` pair: a helper called once per chip, per facet value and per sort key
 * would re-derive the same answer dozens of times per render, and each of those is a place to forget. */
export function buildFilterUrl(
  basePath: StorePath,
  state: FilterState,
  extra: Record<string, string> = {},
): StorePath {
  const merged = { ...toQueryParams(state), ...extra };
  const keys = Object.keys(merged).sort();
  if (keys.length === 0) return basePath;
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(merged[k] ?? '')}`)
    .join('&');
  // Still inside the store it came from: appending a query never leaves an address space.
  return `${basePath}?${qs}` as StorePath;
}

// ── immutable state transforms (a chip's "remove", a facet's "toggle") ────────────────────────────────────

/** Toggle one value of an option axis (add if absent, remove if present). Empty axes are pruned. */
export function toggleOption(state: FilterState, name: string, value: string): FilterState {
  const key = name.toLowerCase();
  const current = state.options[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const options = { ...state.options };
  if (next.length) options[key] = next;
  else delete options[key];
  return { ...state, options };
}

/** Remove one option value (chip). */
export function removeOptionValue(state: FilterState, name: string, value: string): FilterState {
  const key = name.toLowerCase();
  if (!state.options[key]?.includes(value)) return state;
  return toggleOption(state, key, value);
}

/** Set (or clear, with undefined) a cf equality. */
export function setCf(state: FilterState, key: string, value: string | undefined): FilterState {
  const cf = { ...state.cf };
  if (value) cf[key] = value;
  else delete cf[key];
  return { ...state, cf };
}

/** Clear the price range (both bounds). */
export function clearPrice(state: FilterState): FilterState {
  return { options: state.options, cf: state.cf, brand: state.brand, sort: state.sort };
}

/** Set (or clear, with undefined) the selected brand slug (S5-BRAND). */
export function setBrand(state: FilterState, slug: string | undefined): FilterState {
  const next = { ...state };
  if (slug) next.brand = slug;
  else delete next.brand;
  return next;
}

export type Chip = { label: string; kind: 'option' | 'cf' | 'price' | 'brand'; next: FilterState };

/** ★ QA29 · S2A-10 — the price range, in the words and the currency the rest of the page uses.
 *
 * It used to be `${cents/100}.toFixed(2)` on each end with `∞` standing in for an open one — "1500.00–∞" beside
 * a grid of "R$ 1.500,00". An open end is not infinity to a shopper; it is "a partir de" / "até". The bounds
 * are cents (kernel unit) and are formatted, never divided into a string here. */
function priceRangeLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${formatMoney(min)} a ${formatMoney(max)}`;
  if (min !== undefined) return `a partir de ${formatMoney(min)}`;
  return `até ${formatMoney(max as number)}`;
}

/** The active filters as chips, each carrying the FilterState WITHOUT it (for the remove link). */
export function activeChips(state: FilterState): Chip[] {
  const chips: Chip[] = [];
  for (const [name, values] of Object.entries(state.options)) {
    for (const value of values) {
      chips.push({
        label: `${name}: ${value}`,
        kind: 'option',
        next: removeOptionValue(state, name, value),
      });
    }
  }
  for (const [key, value] of Object.entries(state.cf)) {
    // QA20/B9 — the chip is read by a shopper, so it carries the titled key and the worded value (cf-label),
    // never the raw `impermeavel: true` the port serves.
    chips.push({
      label: `${cfLabel(key)}: ${cfValueLabel(value)}`,
      kind: 'cf',
      next: setCf(state, key, undefined),
    });
  }
  if (state.priceMin !== undefined || state.priceMax !== undefined) {
    chips.push({
      label: `Preço: ${priceRangeLabel(state.priceMin, state.priceMax)}`,
      kind: 'price',
      next: clearPrice(state),
    });
  }
  if (state.brand) {
    chips.push({ label: `Marca: ${state.brand}`, kind: 'brand', next: setBrand(state, undefined) });
  }
  return chips;
}

/** True when any filter is active (drives the "clear all" / empty-sidebar affordances). */
export function hasActiveFilters(state: FilterState): boolean {
  return (
    Object.keys(state.options).length > 0 ||
    Object.keys(state.cf).length > 0 ||
    state.priceMin !== undefined ||
    state.priceMax !== undefined ||
    state.brand !== undefined
  );
}
