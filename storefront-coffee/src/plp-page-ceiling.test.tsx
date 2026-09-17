// ★ QA20/B11 — the PLP's per-request page ceiling, measured in BYTES.
//
// THE DEFECT, as the QA measured it on staging (kernel 88e30299d): `GET /tenis?page=999` answered 200 with
// 8.800.271 bytes of html, 655 product links and ~2,8 s of server time. `?page=N` meant "render N pages
// accumulated", nothing clamped N, and the accumulation walked the whole category — 33 port calls for one
// anonymous GET. That is an amplification vector: the cost of the request is chosen by whoever types the URL.
//
// WHAT THIS PROVES, and why it is a byte assertion and not a status one: a 200 was never the symptom. The
// symptom is the SIZE of what a stranger can make the store render, so the test renders the real PLP body twice
// over the same synthetic catalog — once as the page ceiling serves it, once as the whole catalog would be
// served — and asserts the ratio. The port-call count rides along, because the html is only half the cost.

import type { CatalogList, ProductDoc } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgeco/storefront-kit/store-route';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ProductListing } from '@/components/ProductListing';
import type { FilterState } from '@/lib/filters/filter-url';
import { accumulateList, PLP_MAX_PAGES_PER_REQUEST, PLP_PAGE_SIZE } from '@/lib/filters/plp';
import { makeProduct } from '@/test/fixtures';

/** The demo category the QA hit: 653 published products. */
const CATALOG = 653;
const STATE: FilterState = { options: {}, cf: {} };

const CATALOG_DOCS: ProductDoc[] = Array.from({ length: CATALOG }, (_, i) =>
  makeProduct({ product_id: `prod_${i}`, handle: `tenis-${i}`, title: `Tênis ${i}` }),
);

/** A fake port over CATALOG_DOCS that records every call — the port pages this storefront actually makes. */
function port() {
  const calls: number[] = [];
  const fetchPage = (page: number, limit: number): Promise<CatalogList | null> => {
    calls.push(page);
    const start = (page - 1) * limit;
    return Promise.resolve({
      items: CATALOG_DOCS.slice(start, start + limit),
      page,
      limit,
      total: CATALOG,
    });
  };
  return { calls, fetchPage };
}

function renderPlp(products: ProductDoc[], page: number): string {
  return renderToString(
    <ProductListing
      base={HOST_BASE}
      products={products}
      page={page}
      total={CATALOG}
      basePath={storeHref(HOST_BASE, '/tenis')}
      facets={undefined}
      state={STATE}
      empty={<div>vazio</div>}
      title="Tênis"
    />,
  );
}

test('?page=999 renders a WINDOW: a fraction of the bytes of the whole catalog, 6 port calls not 33', async () => {
  const p = port();
  const list = await accumulateList(p.fetchPage, 999);
  const served = list?.items ?? [];

  // 1 call for total/facets + the 5 window pages. The uncapped accumulation made one per page of the category.
  expect(p.calls).toHaveLength(1 + PLP_MAX_PAGES_PER_REQUEST);
  expect(p.calls.length).toBeLessThan(Math.ceil(CATALOG / PLP_PAGE_SIZE));
  expect(served.length).toBeLessThanOrEqual(PLP_PAGE_SIZE * PLP_MAX_PAGES_PER_REQUEST);

  const capped = Buffer.byteLength(renderPlp(served, 999));
  const whole = Buffer.byteLength(renderPlp(CATALOG_DOCS, 999)); // what the defect served
  // The ratio is the finding: a page a stranger can name must not cost the catalog. MEASURED on this synthetic
  // catalog: 182.173 bytes against 1.264.884 — 6,9x. (On the real store the card is far heavier, which is how
  // the same 653 products became the 8,8 MB the QA logged.)
  expect(capped).toBeLessThan(whole / 5);
  // And it is a CEILING, not a discount: no `?page=` renders more than the window does.
  expect(capped).toBeLessThan(400_000);
});

test('the shelf really holds the window (the last products of the catalog), and the count stays honest', async () => {
  const p = port();
  const list = await accumulateList(p.fetchPage, 999);
  const html = renderPlp(list?.items ?? [], 999);
  // 653 = 32 full pages + 13, so the last window (pages 29..33) starts at item 561 = index 560.
  expect(html).toContain('tenis-560');
  expect(html).toContain('tenis-652');
  expect(html).not.toContain('tenis-559');
  // The heading still names the whole catalog — the window narrows the RENDER, never the truth about the set.
  expect(html).toContain('653 produtos');
  expect(html).toContain('>561 a 653</strong> de 653 produtos');
  expect(html).toContain('Voltar ao começo da lista');
});
