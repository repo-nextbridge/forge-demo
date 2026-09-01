// ★★ QA22 · FM6 — THE PRICE A CRAWLER READS AND THE PRICE A SHOPPER READS ARE ONE NUMBER.
//
// THE DEFECT, MEASURED FROM OUTSIDE (p3b.md P3B-9). On a PDP whose buybox printed "de R$ 700,00 por
// R$ 630,00" the JSON-LD said `"price":"700.00"` — the rich result advertising a price the shop does not
// charge. The pricing engine was never wrong: `promotional_price` arrived on the doc and `displayPrice` read
// it for the buybox and for every card. The markup was a SECOND consumer computing the number by itself
// (`sku.amount`), which is the catalog price and, under a promotion, not what anyone pays.
//
// ⚠️ AND IT ONLY DIVERGES UNDER A PROMOTION, which is why this file insists on one. A `compare_at_amount`
// discount is already stored IN `amount` (the merchant typed the "was" beside it), so the two numbers agree
// there — and a test written on that fixture is green against the defect. The specimen below carries an active
// promotional preview, and the compare-at case rides along as the control that must not move.
//
// ⚠️ IT READS BOTH NUMBERS OFF ONE RENDERED PAGE, like `seo-reviews.test.tsx` next door: the property is that
// the page has ONE source for the price, and two direct function calls would only prove two functions agree
// about an argument.

import { Writable } from 'node:stream';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { makeProduct } from '@/test/fixtures';

// The PDP's Server Action prop — bound and handed to the blocks, never called here.
vi.mock('@/lib/cart-actions', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  addManyToCartAction: async () => {},
}));

const CATEGORIES = {
  roupas: { category_id: 'cat_roupas', name: 'Roupas', path: 'roupas' },
  'roupas.calcados': { category_id: 'cat_calcados', name: 'Calçados', path: 'roupas.calcados' },
};

vi.mock('@forgecommerce/storefront-kit/config', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    publicOrigin: () => 'https://loja.example',
    hostMap: () => ({}),
    readClient: () => ({
      categories: async () => CATEGORIES,
      // No app fills a slot here: this file is about the theme's own number, not about a contribution.
      extensions: async () => [],
      storeFlags: async () => ({ timezone: 'America/Sao_Paulo' }),
      shippingSummary: async () => null,
      paymentMethodsCached: async () => null,
    }),
  };
});

const STORE = 'store_1';

/** The COMPLETE server HTML: `onAllReady`, so every async server component resolved. */
function renderPage(node: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.from(chunk));
        cb();
      },
      final(cb) {
        resolve(Buffer.concat(chunks).toString('utf8'));
        cb();
      },
    });
    const stream = renderToPipeableStream(node, {
      onAllReady() {
        stream.pipe(sink);
      },
      onError: reject,
    });
  });
}

async function renderPdp(product: ProductDoc): Promise<Document> {
  globalThis.fetch = vi.fn(
    async () => new Response('null', { status: 200 }),
  ) as unknown as typeof fetch;
  const { PdpView } = await import('./PdpView');
  const html = await renderPage(<PdpView store={STORE} base={HOST_BASE} product={product} />);
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

/** The `Product` node of the page's JSON-LD (the page also emits a BreadcrumbList). */
function productGraph(doc: Document): Record<string, unknown> {
  const graphs = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(
    (s) => JSON.parse(s.textContent ?? 'null') as Record<string, unknown>,
  );
  const product = graphs.find((g) => g?.['@type'] === 'Product');
  expect(product, 'the PDP emits a Product graph').toBeTruthy();
  return product as Record<string, unknown>;
}

/** What the CRAWLER is told the product costs. */
function markupPrice(doc: Document): string {
  return String((productGraph(doc).offers as { price?: unknown }).price);
}

/** What the BUYBOX prints — the headline price, parsed back out of the rendered markup. `formatMoney` writes
 * "R$ 630,00"; this returns the number of cents so the two sides compare as amounts and not as typography. */
function shownPriceCents(doc: Document): number {
  const text = doc.querySelector('[data-testid="price"]')?.textContent ?? '';
  const digits = text.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(Number(digits) * 100);
}

/** One starred, optionless sku — everything the buybox needs to print a headline price and nothing that would
 * make the JSON-LD choose between two. `over` is what the specimen is making a point about. */
function soleSku(over: Partial<ProductDoc['skus'][number]>): ProductDoc {
  return {
    ...makeProduct(),
    options: [],
    skus: [
      {
        id: 'sku_39',
        code: 'TEN-39',
        amount: 70000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        is_default: true,
        option_values: [],
        media: [],
        ...over,
      },
    ],
  };
}

/** The specimen: the kernel's anonymous-safe promotional preview — R$ 700,00 with 10% off, the shape p3b
 * measured on `mens-adidas-adistar-4-running-shoes`. */
function promoted(): ProductDoc {
  return soleSku({
    promotional_price: {
      unit_amount: 70000,
      promotional_amount: 63000,
      discount_bp: 1000,
      label: 'Semana do consumidor',
      promotion_id: 'promo_1',
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

test('a promoted product markups the price the buybox prints, not the catalog price', async () => {
  const doc = await renderPdp(promoted());
  expect(shownPriceCents(doc)).toBe(63000); // the page really is on promotion
  expect(markupPrice(doc)).toBe('630.00');
});

test('a compare-at discount keeps markuping the amount charged (the control that must not move)', async () => {
  const doc = await renderPdp(soleSku({ amount: 20000, compare_at_amount: 29000 }));
  expect(shownPriceCents(doc)).toBe(20000);
  expect(markupPrice(doc)).toBe('200.00');
});
