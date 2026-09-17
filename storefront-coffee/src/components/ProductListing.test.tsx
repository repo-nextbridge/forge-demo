// ProductListing (S7-SF-PLP) — the shared PLP body, proven at the SSR level (crawler/JS-off visible):
//   • the injected card carries STORE CHROME (the "Frete grátis" tag + "ou Nx" line) — the PLP is no longer a
//     chrome-less shelf;
//   • all five sorts render as GET links (the underlined tabs);
//   • "Carregar mais" shows the honest counter + the next-page link;
//   • zero results shows the empty node, never a bare shelf.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Facets } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import type { FilterState } from '@/lib/filters/filter-url';
import { makeProduct } from '@/test/fixtures';
import { ProductCard } from './ProductCard';
import { ProductListing } from './ProductListing';

const STATE: FilterState = { options: {}, cf: {} };
const FACETS: Facets = {
  options: [{ name: 'Tamanho', values: [{ value: 'P', count: 3 }] }],
  custom_fields: [],
  price: { min: 5000, max: 20000 },
};

// The page injects the theme's card WITH the store chrome it read once (cardChrome).
const withChrome = (p: ReturnType<typeof makeProduct>) => (
  <ProductCard base={HOST_BASE} product={p} freeShippingThreshold={5000} maxInstallments={12} />
);

test('the injected card carries the store chrome (Frete grátis + installment line)', () => {
  const html = renderToString(
    <ProductListing
      base={HOST_BASE}
      products={[makeProduct()]}
      page={1}
      total={1}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
      renderCard={withChrome}
    />,
  );
  expect(html).toContain('Frete grátis'); // threshold 5000 ≤ 7990 → the tag lights
  expect(html).toContain('ou 12x'); // the installment line from maxInstallments
});

test('with a title, the head row renders the h1 heading + "{total} produtos" count (#14)', () => {
  const html = renderToString(
    <ProductListing
      base={HOST_BASE}
      title={'Resultados para “Tênis”'}
      products={[makeProduct()]}
      page={1}
      total={24}
      basePath={storeHref(HOST_BASE, '/search')}
      extra={{ q: 'Tênis' }}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
    />,
  );
  expect(html).toMatch(/<h1[^>]*>Resultados para .*Tênis.*<\/h1>/);
  expect(html).toContain('24 produtos');
  // the sort strip shares the head row (proven aligned/sized live).
  expect(html).toContain('data-testid="sort-control"');
});

test('★★ QA · D3 — a single result reads "1 produto", and none reads "0 produtos"', () => {
  // The bench searched and got «Resultados para "samba" — 1 produtos». The storefront has no i18n layer, so
  // agreement is a helper (`lib/plural.ts`) rather than a catalog — but a count that disagrees with its noun
  // is the same defect on either side of the product.
  const one = renderToString(
    <ProductListing
      base={HOST_BASE}
      title="Resultados para “samba”"
      products={[makeProduct()]}
      page={1}
      total={1}
      basePath={storeHref(HOST_BASE, '/search')}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
    />,
  );
  expect(one).toContain('1 produto');
  expect(one).not.toContain('1 produtos');

  // Zero takes the plural: an empty set said in the singular reads as a count of one.
  const none = renderToString(
    <ProductListing
      base={HOST_BASE}
      title="Resultados para “xyz”"
      products={[]}
      page={1}
      total={0}
      basePath={storeHref(HOST_BASE, '/search')}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
    />,
  );
  expect(none).toContain('0 produtos');
});

test('all five sorts render as GET links (the underlined tabs)', () => {
  const html = renderToString(
    <ProductListing
      base={HOST_BASE}
      products={[makeProduct()]}
      page={1}
      total={1}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
    />,
  );
  for (const sort of ['relevance', 'price_asc', 'price_desc', 'newest', 'name']) {
    expect(html).toContain(`sort=${sort}`);
  }
});

test('load-more shows the honest counter and a link to the next page', () => {
  const html = renderToString(
    <ProductListing
      base={HOST_BASE}
      products={Array.from({ length: 20 }, (_, i) => makeProduct({ product_id: `p${i}` }))}
      page={1}
      total={45}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={FACETS}
      state={STATE}
      empty={<div>vazio</div>}
    />,
  );
  expect(html).toContain('>20</strong> de 45 produtos'); // "Mostrando 20 de 45 produtos", count bolded
  expect(html).toContain('page=2');
  expect(html).toContain('Carregar mais produtos');
});

test('zero results → the empty node, never a shelf', () => {
  const html = renderToString(
    <ProductListing
      base={HOST_BASE}
      products={[]}
      page={1}
      total={0}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={FACETS}
      state={STATE}
      empty={<div data-testid="the-empty-state">Nada por aqui</div>}
    />,
  );
  expect(html).toContain('the-empty-state');
  expect(html).not.toContain('data-testid="shelf"');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ★ O1-A — the PLP filtered down to ZERO must not trap the shopper.
//
// The trap: the empty branch replaced the WHOLE body with the message, so the sidebar went with it — and the
// sidebar is where the FilterDrawer lives. On mobile the drawer IS the only filter affordance (the trigger is
// `display:none` on desktop, where the panel is inline), so the shopper who filtered to zero lost the button
// that would undo the filter that emptied the page. Filters ride the URL, so the state survived; only the way
// back was gone. These tests hold the way back open: the trigger renders, it still opens the panel, and the
// panel/chips carry an undo — while a genuinely empty category (no filter active) keeps its full-width message.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** One active option filter — the URL that emptied the page. */
const FILTERED: FilterState = { options: { cor: ['Verde'] }, cf: {} };

const renderEmpty = (state: FilterState, facets: Facets | undefined = FACETS) =>
  render(
    <ProductListing
      base={HOST_BASE}
      title="Tênis"
      products={[]}
      page={1}
      total={0}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={facets}
      state={state}
      empty={<div data-testid="the-empty-state">Nada por aqui</div>}
    />,
  );

test('★ O1-A — filtered to ZERO on mobile: the "Filtrar (N)" trigger survives and still OPENS the panel', () => {
  const { getByTestId } = renderEmpty(FILTERED);

  // The message is still there — the empty state is not what regressed.
  expect(getByTestId('the-empty-state')).toBeTruthy();

  // The mobile affordance survived the emptying, badge and all.
  const trigger = getByTestId('filter-trigger');
  expect(trigger.textContent).toContain('Filtrar (1)');

  // …and it still WORKS: the panel opens, carrying the filters that undo the state.
  const panel = getByTestId('filter-panel');
  expect(panel.hasAttribute('data-open')).toBe(false);
  fireEvent.click(trigger);
  expect(panel.hasAttribute('data-open')).toBe(true);
  expect(panel.contains(getByTestId('filters-clear'))).toBe(true);
});

test('★ O1-A — the emptied page keeps an undo in the DOM: a chip that drops the filter + "Limpar filtros"', () => {
  const { getByTestId } = renderEmpty(FILTERED);
  const chips = getByTestId('active-chips');
  // The chip's href is the same list WITHOUT the filter — one tap and the products are back.
  const back = chips.querySelector('a');
  expect(back?.getAttribute('href')).toBe(storeHref(HOST_BASE, '/tenis'));
  expect(chips.textContent).toContain('cor: Verde');
});

test('★ O1-A — the trigger is the MOBILE affordance: hidden on the desktop baseline, shown under 768px', () => {
  // jsdom computes no layout, so the viewport half of the claim is asserted against the stylesheet the drawer
  // actually consumes: `.trigger` is display:none in the desktop baseline and re-shown inside the mobile query.
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'FilterDrawer.module.css'),
    'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');
  expect(css).toMatch(/\.trigger[^{]*{[^}]*display: none/);
  const mobile = css.slice(css.indexOf('@media (max-width: 767.98px)'));
  expect(mobile).toMatch(/\.trigger\s*{[^}]*display: flex/);
});

test('★ O1-A — with NO filter active the empty state stays full width: nothing to undo, no drawer', () => {
  // The other half of the rule, and the reason the sidebar was dropped in the first place (an empty category
  // reserving a 236px column pushed the message off-centre). Nothing was filtered → there is nothing to escape.
  const { getByTestId, queryByTestId } = renderEmpty(STATE);
  expect(getByTestId('the-empty-state')).toBeTruthy();
  expect(queryByTestId('filter-trigger')).toBeNull();
  expect(queryByTestId('active-chips')).toBeNull();
});
