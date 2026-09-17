// LoadMore — the "Carregar mais produtos" GET affordance (S7-SF-PLP). Server-rendered; the counter is always
// honest, the button appears whenever a page is still unloaded. QA20/B11: past the per-request window the shelf
// shows a SLICE, so the counter names the slice ("561 a 653") and a way back to the top of the list appears.

import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { LoadMore } from './LoadMore';

test('page 1 of 45: shows 20, an honest counter, and a link to page 2', () => {
  const html = renderToString(
    <LoadMore page={1} from={1} shown={20} total={45} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('>20</strong> de 45 produtos'); // "Mostrando 20 de 45 produtos"
  expect(html).toContain('Carregar mais produtos');
  expect(html).toContain('href="/tenis?page=2"');
});

test('page 2 of 45 (40 shown): still more → link to page 3', () => {
  const html = renderToString(
    <LoadMore page={2} from={1} shown={40} total={45} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('>40</strong> de 45 produtos');
  expect(html).toContain('href="/tenis?page=3"');
});

test('page 3 of 45 (all 45 shown): the counter, but NO button', () => {
  const html = renderToString(
    <LoadMore page={3} from={1} shown={45} total={45} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toContain('>45</strong> de 45 produtos');
  expect(html).not.toContain('Carregar mais produtos');
});

test('appends page with & when the base path already carries a query (search)', () => {
  const html = renderToString(
    <LoadMore
      page={1}
      from={1}
      shown={20}
      total={45}
      basePath={storeHref(HOST_BASE, '/search?q=tenis')}
    />,
  );
  expect(html).toContain('href="/search?q=tenis&amp;page=2"');
});

test('past 100 the button keeps loading (a big category stays fully browsable)', () => {
  const html = renderToString(
    <LoadMore
      page={5}
      from={1}
      shown={100}
      total={250}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  expect(html).toContain('>100</strong> de 250 produtos');
  expect(html).toContain('Carregar mais produtos');
  expect(html).toContain('href="/tenis?page=6"');
});

// ★ QA20/B11 — past the window the shelf is a SLICE of the catalog, and the counter has to say so: "Mostrando
// 100" while items 1..100 are NOT on screen is the same class of lie as a facet count that promises 1 and
// delivers 0. The way back to the top of the list is a link, not just the browser's Back.
test('a slid window names the slice and offers the way back to the top of the list', () => {
  const html = renderToString(
    <LoadMore
      page={6}
      from={21}
      shown={100}
      total={250}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  expect(html).toContain('>21 a 120</strong> de 250 produtos');
  expect(html).toContain('Carregar mais produtos');
  expect(html).toContain('href="/tenis?page=7"');
  expect(html).toContain('Voltar ao começo da lista');
  expect(html).toContain('href="/tenis"');
});

test('the LAST page of a big catalog: the slice, the way back, and NO next button', () => {
  const html = renderToString(
    <LoadMore
      page={13}
      from={241}
      shown={10}
      total={250}
      basePath={storeHref(HOST_BASE, '/tenis')}
    />,
  );
  expect(html).toContain('>241 a 250</strong> de 250 produtos');
  expect(html).not.toContain('Carregar mais produtos');
  expect(html).toContain('Voltar ao começo da lista');
});

test('no results: renders nothing (the empty-state owns that screen)', () => {
  const html = renderToString(
    <LoadMore page={1} from={1} shown={0} total={0} basePath={storeHref(HOST_BASE, '/tenis')} />,
  );
  expect(html).toBe('');
});
