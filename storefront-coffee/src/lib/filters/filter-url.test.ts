import { formatMoney } from '@forgeco/storefront-kit/money';
import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { describe, expect, test } from 'vitest';
import {
  activeChips,
  buildFilterUrl,
  clearPrice,
  type FilterState,
  hasActiveFilters,
  parseFilterState,
  removeOptionValue,
  setBrand,
  toggleOption,
  toQueryParams,
} from './filter-url';

describe('parseFilterState', () => {
  test('reads option.* (csv → OR values), cf.*, price and sort; drops junk', () => {
    const s = parseFilterState({
      'option.tamanho': 'P,M',
      'cf.material': 'couro',
      price_min: '1000',
      price_max: '5000',
      sort: 'price_asc',
      q: 'tenis', // ignored (not filter state)
      bogus: 'x',
      'option.EMPTY': '', // dropped
    });
    expect(s.options).toEqual({ tamanho: ['P', 'M'] });
    expect(s.cf).toEqual({ material: 'couro' });
    expect(s.priceMin).toBe(1000);
    expect(s.priceMax).toBe(5000);
    expect(s.sort).toBe('price_asc');
  });

  test('an unknown sort is dropped (not passed through)', () => {
    expect(parseFilterState({ sort: 'cheapest' }).sort).toBeUndefined();
  });
});

describe('toQueryParams / buildFilterUrl', () => {
  const state: FilterState = {
    options: { tamanho: ['P', 'M'] },
    cf: { material: 'couro' },
    priceMin: 1000,
    sort: 'name',
  };

  test('round-trips the convention', () => {
    expect(toQueryParams(state)).toEqual({
      'option.tamanho': 'P,M',
      'cf.material': 'couro',
      price_min: '1000',
      sort: 'name',
    });
  });

  test('buildFilterUrl merges extra (q), sorts keys, resets page by omission', () => {
    const url = buildFilterUrl(storeHref(HOST_BASE, '/search'), state, { q: 'tenis' });
    // deterministic sorted keys; page is never emitted
    expect(url).toBe(
      '/search?cf.material=couro&option.tamanho=P%2CM&price_min=1000&q=tenis&sort=name',
    );
    expect(url).not.toContain('page=');
  });

  test('empty state → bare basePath', () => {
    expect(buildFilterUrl(storeHref(HOST_BASE, '/c/roupas'), { options: {}, cf: {} })).toBe(
      '/c/roupas',
    );
  });
});

describe('transforms', () => {
  test('toggleOption adds then removes, pruning empty axes', () => {
    let s: FilterState = { options: {}, cf: {} };
    s = toggleOption(s, 'Tamanho', 'P');
    expect(s.options).toEqual({ tamanho: ['P'] });
    s = toggleOption(s, 'tamanho', 'M');
    expect(s.options.tamanho).toEqual(['P', 'M']);
    s = toggleOption(s, 'tamanho', 'P');
    expect(s.options.tamanho).toEqual(['M']);
    s = removeOptionValue(s, 'tamanho', 'M');
    expect(s.options).toEqual({}); // axis pruned
  });

  test('clearPrice keeps the other axes', () => {
    const s: FilterState = { options: { tamanho: ['P'] }, cf: {}, priceMin: 100, priceMax: 200 };
    const cleared = clearPrice(s);
    expect(cleared.priceMin).toBeUndefined();
    expect(cleared.priceMax).toBeUndefined();
    expect(cleared.options).toEqual({ tamanho: ['P'] });
  });
});

describe('activeChips / hasActiveFilters', () => {
  test('one chip per option value + cf + price, each removing itself', () => {
    const s: FilterState = {
      options: { tamanho: ['P', 'M'] },
      cf: { material: 'couro' },
      priceMin: 1000,
      priceMax: 5000,
    };
    const chips = activeChips(s);
    expect(chips.map((c) => c.label)).toEqual([
      'tamanho: P',
      'tamanho: M',
      'Material: couro', // QA20/B9 — the cf key is titled for the shopper (cf-label)
      `Preço: ${formatMoney(1000)} a ${formatMoney(5000)}`,
    ]);
    // removing the "tamanho: P" chip drops only that value
    expect(chips[0]?.next.options.tamanho).toEqual(['M']);
  });

  test('hasActiveFilters is false for an empty state', () => {
    expect(hasActiveFilters({ options: {}, cf: {} })).toBe(false);
    expect(hasActiveFilters({ options: { a: ['1'] }, cf: {} })).toBe(true);
  });
});

describe('S5-BRAND — brand filter', () => {
  test('parse + serialize round-trips ?brand=<slug>', () => {
    expect(parseFilterState({ brand: 'nike' }).brand).toBe('nike');
    expect(toQueryParams({ options: {}, cf: {}, brand: 'nike' })).toEqual({ brand: 'nike' });
    expect(parseFilterState({ brand: '' }).brand).toBeUndefined();
  });

  test('setBrand sets and clears; hasActiveFilters reflects it', () => {
    const s: FilterState = { options: {}, cf: {} };
    expect(setBrand(s, 'nike').brand).toBe('nike');
    expect(setBrand(setBrand(s, 'nike'), undefined).brand).toBeUndefined();
    expect(hasActiveFilters({ options: {}, cf: {}, brand: 'nike' })).toBe(true);
  });

  test('a brand chip removes itself but keeps the other axes', () => {
    const s: FilterState = { options: { tamanho: ['P'] }, cf: {}, brand: 'nike' };
    const chips = activeChips(s);
    const brandChip = chips.find((c) => c.kind === 'brand');
    expect(brandChip?.label).toBe('Marca: nike');
    expect(brandChip?.next.brand).toBeUndefined();
    expect(brandChip?.next.options.tamanho).toEqual(['P']); // other axes intact
  });
});

// ★ QA20/B9 (S2A-2) — the active chip is the same promise as the facet label: it names the filter the shopper
// turned on. "impermeavel: true" is the raw key and the raw value, in a chip a human reads.
test('a cf chip names the field and speaks Sim/Não for a boolean value', () => {
  const chips = activeChips({ options: {}, cf: { impermeavel: 'true' } });
  expect(chips[0]?.label).toBe('Impermeável: Sim');
  const off = activeChips({ options: {}, cf: { impermeavel: 'false' } });
  expect(off[0]?.label).toBe('Impermeável: Não');
  // A non-boolean cf keeps its own value, with the key titled.
  const material = activeChips({ options: {}, cf: { material: 'couro' } });
  expect(material[0]?.label).toBe('Material: couro');
});

// ★ QA29 · S2A-10 — THE CHIP IS READ BY A SHOPPER, AND IT WAS PRINTING A MACHINE.
//
// Staging showed "Preço: 1500.00–∞" for `?price_min=150000`: a decimal point where this store writes a comma,
// no currency, no thousands separator, and a mathematical symbol for "no upper bound" — on the same screen
// where every price beside it reads "R$ 1.500,00". The cf chip beside it was already fixed for the same reason
// (QA20/B9); this is the last raw one.
describe('QA29 · S2A-10 — the price chip in the shopper’s own currency', () => {
  const chip = (priceMin?: number, priceMax?: number) =>
    activeChips({ options: {}, cf: {}, priceMin, priceMax })[0]?.label;

  // The money itself comes from the theme's ONE formatter (Intl, pt-BR — its space between "R$" and the
  // digits is a non-breaking one, which is exactly why the expectation is built rather than typed).
  test('★ a floor with no ceiling says so in words, never "1500.00–∞"', () => {
    expect(chip(150000, undefined)).toBe(`Preço: a partir de ${formatMoney(150000)}`);
    expect(chip(150000, undefined)).not.toContain('∞');
    expect(chip(150000, undefined)).not.toContain('1500.00');
  });

  test('★ a ceiling with no floor is the mirror sentence', () => {
    expect(chip(undefined, 20000)).toBe(`Preço: até ${formatMoney(20000)}`);
  });

  test('a real range keeps both ends, both formatted', () => {
    expect(chip(1000, 5000)).toBe(`Preço: ${formatMoney(1000)} a ${formatMoney(5000)}`);
  });
});
