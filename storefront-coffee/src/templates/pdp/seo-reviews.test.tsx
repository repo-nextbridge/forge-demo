// ★ O3-D (REV F3) — ONE AGGREGATE, READ TWICE OFF THE SAME PAGE.
//
// The PDP says a product's rating in two places: in the section a shopper reads, and in the `Product` JSON-LD
// a crawler reads. Until this slice they came from two different reads — the section from the app's
// per-product list, the markup from `cardRatings`, the WHOLE-STORE batch — and they agreed only by
// coincidence: two fetches, two cache entries, two revalidation windows, one of them (the batch) with a
// measured 2 MiB ceiling above which it is never cached at all. The day either rule moves, the page and the
// Google result disagree and the only witness is a Search Console report months later.
//
// ⚠️ SO THIS FILE READS BOTH NUMBERS OFF ONE RENDERED PAGE, never off two function calls. It server-renders
// the real `PdpView` — the same component the two product routes render — with the reviews app installed in
// the slot, waits for the WHOLE document (`onAllReady`, the crawler's bytes, not the shell), and then asks the
// HTML twice: once for the JSON-LD script, once for the section's own printed average and count. A test that
// called `productJsonLd` and `computeAggregates` separately would prove the two functions agree about an
// argument, which is not the property — the property is that the page has ONE source.
//
// And one assertion is the MECHANISM rather than the value: the page never asks the port for the whole-store
// batch, which is where the old markup's number came from. Equal numbers are a coincidence that holds until
// the two caches diverge; a single read is why they cannot — and which read it is, is the part a test can see.
//
// ⚠️ WHAT THIS HARNESS CANNOT SEE, stated rather than implied. The app's read is memoized with React `cache()`
// (`extensions/reviews/product-reviews.ts`), the same per-request memo `cardChrome` and `cardRatings` use — and
// that memo is scoped by the RSC renderer, not by `react-dom/server`. MEASURED here: under Fizz two callers of
// one `cache()`d function call through twice. So this file counts WHICH URLs the page asked for, never how
// many times; the read that would betray a second source is a different URL, and that is what it watches.

import { Writable } from 'node:stream';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveBlock } from '@/lib/extensions/registry';
import { composedProductStructuredData } from '@/lib/product-structured-data/generated/registry';
import { makeProduct } from '@/test/fixtures';

// The PDP's Server Action prop — bound and handed to the blocks, never called here. Mocked so the test does
// not drag `next/headers` (and the cookie the real action owns) into a render that has no request.
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
      // The reviews app fills the PDP slot — discovery, exactly as a real install answers it.
      extensions: async () => [
        {
          extension_id: 'reviews',
          hooks: [{ component: 'reviews', target: 'storefront:pdp.below_gallery', position: 0 }],
        },
      ],
      storeFlags: async () => ({ timezone: 'America/Sao_Paulo' }),
      shippingSummary: async () => null,
      paymentMethodsCached: async () => null,
    }),
  };
});

const STORE = 'store_1';
const BASE = HOST_BASE;

/** A row as the extension data port hands it back (unknowns, and a legacy row with no `status`). */
type Row = Record<string, unknown>;

function review(over: Partial<Row> & { id: string }): Row {
  return {
    product_id: 'prod_1',
    rating: 5,
    body: 'Muito bom',
    author: 'Alguém',
    verified: true,
    status: 'approved',
    created_at: '2026-07-15T12:00:00.000Z',
    ...over,
  };
}

/** Every URL the render asked the port for — the "how many reads" half of the property. */
let asked: string[] = [];

/**
 * The port, with its TWO review reads answered SEPARATELY — and that separation is what lets this file tell
 * one source from two.
 *
 * The app reads its reviews two ways: `?product_id=` (the PDP block's own list) and `?projection=summary`
 * (the whole-store batch behind `cardRatings`, which every product CARD on a page shares). They are two HTTP
 * calls with two `next.revalidate` entries under two different tags, and the batch one has a measured ceiling
 * above which Next stores nothing at all — so in production they routinely hold DIFFERENT snapshots of the
 * same store. A stub that answered both from one array would make a two-source page and a one-source page
 * produce identical HTML, and every assertion below would pass against the defect.
 *
 * So `stale`, when given, is what the BATCH answers: the older snapshot. A page with one source can never
 * print it; a page that markups from `cardRatings` prints it in the JSON-LD while the section shows the other.
 */
function stubPort(rows: Row[], stale?: Row[]) {
  asked = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    asked.push(url);
    if (url.includes('/v1/ext-public-config/reviews')) {
      return new Response(JSON.stringify({ moderation: true, open_reviews: false }), {
        status: 200,
      });
    }
    if (url.includes('/v1/ext-public/reviews/review')) {
      const batch = !url.includes('product_id=');
      return new Response(JSON.stringify(batch ? (stale ?? rows) : rows), { status: 200 });
    }
    return new Response('null', { status: 200 });
  }) as unknown as typeof fetch;
}

/** The reads that answer "this product's reviews" — the ones two sources would double. */
const reviewReads = () => asked.filter((u) => u.includes('/v1/ext-public/reviews/review'));

/** The COMPLETE server HTML: `onAllReady`, so every async server component (the outlet, the block) resolved. */
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

async function renderPdp(rows: Row[], stale?: Row[]): Promise<Document> {
  stubPort(rows, stale);
  const { PdpView } = await import('./PdpView');
  // ⚠️ THE ELEMENT, NOT `await PdpView(...)`. React itself has to be the one that awaits this component, or the
  // view runs OUTSIDE the render and its reads land in a different request scope from the ones the blocks make
  // inside it — which is exactly the "two snapshots" this file is about, manufactured by the harness.
  const html = await renderPage(<PdpView store={STORE} base={BASE} product={makeProduct()} />);
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

/** The app's section on the page — every screen-side query is scoped to it, never to the whole document: the
 * PDP has other lists and other numbers, and a bare `.item` would happily count breadcrumb crumbs. */
function section(doc: Document): Element | null {
  return doc.querySelector('[data-testid="ext-reviews"]');
}

/** What the SECTION prints — the shopper's own two numbers, parsed back out of the rendered markup. */
function shownAggregate(doc: Document): { average: number; count: number } {
  const box = section(doc);
  const score = box?.querySelector('.scoreNumber')?.textContent ?? '';
  const countText = box?.querySelector('.scoreCount')?.textContent ?? '';
  return {
    average: Number(score.replace(',', '.')),
    count: Number(countText.replace(/\D+/g, '')),
  };
}

/** The review CARDS the server HTML actually contains — the set the markup has to mirror. */
function shownCards(doc: Document): { author: string; body: string }[] {
  return [...(section(doc)?.querySelectorAll('.list > .item') ?? [])].map((li) => ({
    author: li.querySelector('.author')?.textContent ?? '',
    body: li.querySelector('.body')?.textContent ?? '',
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- the specimen has to be IN THIS IMAGE ---------------------------------------------------------

test('★ the specimen is composed here — both halves of it, named', () => {
  // ★ WITHOUT THIS, EVERY ASSERTION BELOW COULD FAIL FOR THE WRONG REASON. An instance whose composition list
  // drops `reviews` has no block to render and no contribution to call, and the equality test would then
  // report "the markup disagrees with the page" about an app that is simply not in this build. Asked of the
  // two registries — the same question the outlet and the aggregator ask — so the condition cannot drift from
  // what would actually run.
  expect(resolveBlock('reviews', 'reviews'), 'the reviews BLOCK is composed').toBeTruthy();
  expect(
    composedProductStructuredData.map((c) => c.id),
    'an app contributes to storefront.product_structured_data',
  ).toContain('reviews');
});

// ---- ★ the property ------------------------------------------------------------------------------

test('★ the aggregate in the markup IS the aggregate on the screen (one page, both read)', async () => {
  const doc = await renderPdp(
    [
      review({ id: 'r1', rating: 5, author: 'Ana' }),
      review({ id: 'r2', rating: 4, author: 'Bruno' }),
      review({ id: 'r3', rating: 4, author: 'Carla' }),
      // A row written before 0.2.0: no `status` at all, and published is what it was.
      review({ id: 'r4', rating: 3, author: 'Davi', status: undefined }),
    ],
    // …and the whole-store batch still holds YESTERDAY: two of the four, and a different average. Whichever
    // number reaches the crawler tells you which read the markup came from (see stubPort).
    [
      review({ id: 'r1', rating: 1, author: 'Ana' }),
      review({ id: 'r2', rating: 1, author: 'Bruno' }),
    ],
  );

  const shown = shownAggregate(doc);
  expect(shown).toEqual({ average: 4, count: 4 });

  const rating = productGraph(doc).aggregateRating as Record<string, unknown>;
  expect(rating?.['@type']).toBe('AggregateRating');
  expect(rating?.ratingValue).toBe(shown.average);
  expect(rating?.reviewCount).toBe(shown.count);
});

test('★ the markup comes from the section’s OWN read — the whole-store batch is never consulted', async () => {
  await renderPdp([review({ id: 'r1', rating: 5, author: 'Ana' })]);
  const reads = reviewReads();
  expect(reads.length, 'the page reads this product’s reviews').toBeGreaterThan(0);
  // Every review read this page makes is the product-scoped one — the section's. `?projection=summary` (the
  // card batch behind `cardRatings`) is the fingerprint of the second source, and it is absent: the PDP no
  // longer reaches for it, so there is no other snapshot for the markup to have been computed from.
  expect(
    reads.filter((u) => !u.includes('product_id=')),
    `reads: ${reads.join(' | ')}`,
  ).toEqual([]);
});

test('★ the Review items ARE the reviews the page shows — same set, same order', async () => {
  // MORE ROWS THAN THE FIRST PAGE, deliberately. The section paginates client-side, so the server HTML — the
  // crawler's bytes and a JS-off shopper's page — carries only the first page of cards. A fixture that fitted
  // in one page would let the markup list every review in the store and still look right here.
  const doc = await renderPdp([
    review({ id: 'r1', rating: 5, author: 'Ana', body: 'Confortável demais' }),
    review({ id: 'r2', rating: 4, author: 'Bruno', body: 'Bom custo-benefício' }),
    review({ id: 'r3', rating: 5, author: 'Carla', body: 'Chegou rápido' }),
    review({ id: 'r4', rating: 3, author: 'Davi', body: 'Serve, mas aperta' }),
    review({ id: 'r5', rating: 4, author: 'Elis', body: 'Boa pisada' }),
    review({ id: 'r6', rating: 5, author: 'Fábio', body: 'Comprei o segundo par' }),
    review({ id: 'r7', rating: 2, author: 'Gil', body: 'Solado escorrega' }),
    review({ id: 'r8', rating: 5, author: 'Helena', body: 'Leve demais' }),
  ]);

  const cards = shownCards(doc);
  expect(cards.length, 'the server HTML carries the first page of cards').toBeLessThan(8);

  const items = productGraph(doc).review as Record<string, unknown>[];
  expect(
    items?.length,
    `markup lists ${items?.length} reviews, the page shows ${cards.length}`,
  ).toBe(cards.length);
  expect(
    items.map((r) => ({
      author: (r.author as Record<string, unknown>)?.name,
      body: r.reviewBody,
    })),
  ).toEqual(cards);
  expect(items[0]?.['@type']).toBe('Review');
  expect((items[0]?.reviewRating as Record<string, unknown>)?.ratingValue).toBe(5);
});

test('a review the merchant has NOT published is in neither — not on the page, not in the markup', async () => {
  const doc = await renderPdp([
    review({ id: 'r1', rating: 5, author: 'Ana' }),
    review({ id: 'r2', rating: 1, author: 'Espião', body: 'texto pendente', status: 'pending' }),
  ]);

  expect(doc.body.textContent).not.toContain('Espião');
  const graph = productGraph(doc);
  expect(JSON.stringify(graph)).not.toContain('Espião');
  // …and the aggregate the crawler gets counts the same one review the shopper counts.
  expect((graph.aggregateRating as Record<string, unknown>)?.reviewCount).toBe(1);
  expect(shownAggregate(doc).count).toBe(1);
});

test('★ no published reviews → no section on the page, and no rating in the markup', async () => {
  const doc = await renderPdp([]);
  expect(doc.querySelector('[data-testid="ext-reviews"]')).toBeNull();
  const graph = productGraph(doc);
  expect(graph).not.toHaveProperty('aggregateRating');
  expect(graph).not.toHaveProperty('review');
});
