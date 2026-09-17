// ★ SSR: the SERVED HTML (no JS) of the search page carries the results AND the filter UI — a crawler/sharer,
// and a JS-off shopper, see and can use everything. We renderToString the SearchTemplate and assert the states
// + that filters/sort/chips are plain links in the raw markup (GET-first).

import type { CategoryMap, Facets } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { FilterState } from '@/lib/filters/filter-url';
import { makeProduct } from '@/test/fixtures';
import { SearchTemplate } from './template';

const EMPTY_STATE: FilterState = { options: {}, cf: {} };
const NO_FACETS = undefined;
const NO_CATS: CategoryMap = {};

const FACETS: Facets = {
  options: [
    {
      name: 'Tamanho',
      values: [
        { value: 'P', count: 3 },
        { value: 'M', count: 1 },
      ],
    },
  ],
  custom_fields: [{ key: 'material', values: [{ value: 'couro', count: 2 }] }],
  price: { min: 5000, max: 20000 },
};

test('with results: the raw HTML contains the found product title and price (crawler-visible)', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q="tenis"
      products={[makeProduct()]}
      page={1}
      total={1}
      facets={NO_FACETS}
      state={EMPTY_STATE}
      catmap={NO_CATS}
      suggestions={[]}
    />,
  );
  expect(html).toContain('Tênis Esportivo'); // a found product, server-rendered
  expect(html).toContain('79,90'); // its "from" price (lowest SKU), no JS
  expect(html).toContain('Resultados para'); // the query echoed in the heading
});

test('filters render as GET links in the SSR HTML (no JS)', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q="tenis"
      products={[makeProduct()]}
      page={1}
      total={1}
      facets={FACETS}
      state={EMPTY_STATE}
      catmap={NO_CATS}
      suggestions={[]}
    />,
  );
  expect(html).toContain('Tamanho'); // the option axis legend
  expect(html).toContain('option.tamanho=P'); // a facet value is a plain GET link carrying the convention
  expect(html).toContain('cf.material=couro'); // the cf facet too
  expect(html).toContain('sort=price_asc'); // the sort control is GET links
  expect(html).toContain('q=tenis'); // the query is preserved on every filter link
});

test('active filters render removable chips (GET link back to the reduced state)', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q="tenis"
      products={[makeProduct()]}
      page={1}
      total={1}
      facets={FACETS}
      state={{ options: { tamanho: ['P'] }, cf: {} }}
      catmap={NO_CATS}
      suggestions={[]}
    />,
  );
  expect(html).toContain('tamanho: P'); // the active chip label
  // removing it → a link that no longer carries option.tamanho (only q remains)
  expect(html).toContain('href="/search?q=tenis"');
});

test('no match: suggestions (categories + newest), never a blank screen', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q="zzzz"
      products={[]}
      page={1}
      total={0}
      facets={NO_FACETS}
      state={EMPTY_STATE}
      catmap={{ cat_1: { name: 'Roupas', path: 'roupas' } }}
      suggestions={[makeProduct()]}
    />,
  );
  expect(html).toContain('Nada encontrado');
  expect(html).toContain('zzzz'); // the query is echoed back
  expect(html).toContain('Roupas'); // a suggested category
  expect(html).toContain('Novidades'); // the newest-products fallback heading
});

test('empty query (no q): a neutral prompt, not an error', () => {
  const html = renderToString(
    <SearchTemplate
      base={HOST_BASE}
      q=""
      products={[]}
      page={1}
      total={0}
      facets={NO_FACETS}
      state={EMPTY_STATE}
      catmap={NO_CATS}
      suggestions={[]}
    />,
  );
  expect(html).toContain('Buscar produtos');
  expect(html).not.toContain('Nada encontrado'); // not the no-match state
});
