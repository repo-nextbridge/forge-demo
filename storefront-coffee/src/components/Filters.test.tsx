// Filters (S7-SF-PLP → S7-SF-PLP-FIDELITY) — the dressed facet sidebar, still 100% GET in the SSR HTML. Colors
// render as SOLID hue swatches (the theme color dictionary — the design source's colorMap, not product photos),
// sizes as a text grid, brands/cf as checkbox rows with counts, price as the no-JS form baseline; each is a plain
// link carrying the filter-url convention, and "Limpar filtros" shows only with an active filter.

import type { Facets } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { FilterState } from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import { Filters } from './Filters';

const FACETS: Facets = {
  options: [
    {
      name: 'Cor',
      values: [
        { value: 'Vermelho', count: 4 },
        { value: 'Azul', count: 2 },
      ],
    },
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
  brands: [{ slug: 'aurora', name: 'Aurora', count: 5 }],
};

// The size axis carries harvested photos too (Staging passes `buildSwatchImages(products)` which harvests EVERY
// axis) — the fixture keeps a `tamanho` entry so the routing test proves size never takes the image path.
const SWATCHES: SwatchImages = {
  cor: { Vermelho: 'https://cdn/red.jpg', Azul: 'https://cdn/blue.jpg' },
  tamanho: { P: 'https://cdn/size-p.jpg', M: 'https://cdn/size-m.jpg' },
};
const EMPTY: FilterState = { options: {}, cf: {} };

test('color axis renders SOLID hue swatches as GET toggle links (theme color dictionary)', () => {
  const html = renderToString(
    <Filters
      facets={FACETS}
      state={EMPTY}
      basePath={storeHref(HOST_BASE, '/tenis')}
      swatchImages={SWATCHES}
    />,
  );
  expect(html).toContain('option.cor=Vermelho'); // the swatch is a plain toggle link
  expect(html).toContain('#e5352b'); // "Vermelho" → its solid hue (not a product photo)
  expect(html).toContain('#2b4bd7'); // "Azul" → its solid hue
  expect(html).not.toContain('https://cdn/red.jpg'); // photos no longer drive the color swatch
});

test('size axis renders a NUMERIC text grid even when photos exist — never the image swatch path (S7 size fix)', () => {
  const html = renderToString(
    <Filters
      facets={FACETS}
      state={EMPTY}
      basePath={storeHref(HOST_BASE, '/tenis')}
      swatchImages={SWATCHES}
    />,
  );
  expect(html).toContain('option.tamanho=P');
  expect(html).toContain('(3)'); // the count is visible on the text grid
  // ONLY "Cor" is a swatch: a size value that DOES carry a harvested photo must never render as an image.
  expect(html).not.toContain('https://cdn/size-p.jpg');
  expect(html).not.toContain('https://cdn/size-m.jpg');
  // and no size value slips into a background-image swatch fill.
  expect(html).not.toContain('background-image');
});

test('brand facet renders checkbox rows carrying the brand filter + its count', () => {
  const html = renderToString(
    <Filters facets={FACETS} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('brand=aurora');
  expect(html).toContain('Aurora');
  expect(html).toContain('(5)');
});

test('facetable cf renders a collapsible group carrying cf.<key>', () => {
  const html = renderToString(
    <Filters facets={FACETS} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('cf.material=couro');
  expect(html).toContain('material'); // the group legend
});

test('price renders the no-JS GET form baseline (cents inputs)', () => {
  const html = renderToString(
    <Filters facets={FACETS} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('name="price_min"');
  expect(html).toContain('name="price_max"');
});

test('"Limpar filtros" appears only when a filter is active', () => {
  const none = renderToString(
    <Filters facets={FACETS} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(none).not.toContain('data-testid="filters-clear"');
  const active = renderToString(
    <Filters
      facets={FACETS}
      state={{ options: { cor: ['Vermelho'] }, cf: {} }}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  expect(active).toContain('Limpar filtros');
  // The clear control carries the design source's ✕ glyph (an inline svg), aligned with the label (#13).
  expect(active).toMatch(/data-testid="filters-clear"[^>]*>\s*<svg/);
});

test('no facets → nothing renders (the sidebar collapses to null)', () => {
  expect(
    renderToString(
      <Filters facets={undefined} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
    ),
  ).toBe('');
});

// ★ O1-A — the panel the emptied PLP opens must not be a dead end. A `cf` axis is part of the facet BASE set
// (packages/core/src/read/facets.ts: the base is store+category+brand+q+cf, and only the option/price axes are
// excluded from it), so a cf filter narrow enough to empty the listing empties its own facets too — and the
// drawer would then open on nothing at all. Whenever a filter is ACTIVE the way out renders, axes or no axes.
const NO_FACETS: Facets = { options: [], custom_fields: [], price: null, brands: [] };

test('★ O1-A — an active filter always keeps a way out, even when the facet base itself came back empty', () => {
  const html = renderToString(
    <Filters
      facets={NO_FACETS}
      state={{ options: {}, cf: { material: 'couro' } }}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  expect(html).toContain('data-testid="filters-clear"');
  expect(html).toContain('Limpar filtros');
});

test('★ O1-A — …and with no filter active an empty facet base still collapses to nothing', () => {
  expect(
    renderToString(
      <Filters facets={NO_FACETS} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
    ),
  ).toBe('');
});

// ★ QA20/B9 (S2A-2) — the boolean facet spoke programmer. The `impermeavel` custom field is stored as a JSON
// boolean, so `jsonb_each_text` hands the facet the literal strings "true"/"false" and the pt-BR sidebar
// rendered links reading "false (1)" and "true (38)". A shopper cannot know what "false" filters. The URL keeps
// the raw value (it is the port's contract and the tenant's data) — only the LABEL becomes a word.
test('a boolean custom-field value reads as Sim/Não, while the URL keeps the raw value', () => {
  const facets: Facets = {
    options: [],
    custom_fields: [
      {
        key: 'impermeavel',
        values: [
          { value: 'false', count: 1 },
          { value: 'true', count: 38 },
        ],
      },
    ],
    price: null,
    brands: [],
  };
  const html = renderToString(
    <Filters facets={facets} state={EMPTY} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('Impermeável'); // the titled key, as before
  expect(html).toContain('>Sim<');
  expect(html).toContain('>Não<');
  expect(html).not.toContain('>true<');
  expect(html).not.toContain('>false<');
  expect(html).toContain('cf.impermeavel=true'); // the filter itself is untouched
  expect(html).toContain('cf.impermeavel=false');
});
