// SEO-FINISH — the sitemap, whole. It already emitted products and brands; home, the categories and the CMS
// pages were simply missing, which is the cheapest SEO there is left on the floor.
//
// DATASET-AGNOSTIC (CICD-REV): every fixture is built here. Not one assertion knows a demo product exists.
//
// WHAT THIS FILE CAN AND CANNOT PROVE. It mocks the read client, so it proves what the sitemap DOES with what
// the port returns — the URL shapes, the host, the paging, which reads are even asked for. It cannot prove the
// publication filter, because that lives in the kernel handler: a page this test never receives is a page the
// port already excluded. That half is proven where it actually is, against a real Postgres, in
// apps/api/src/cms.e2e.test.ts ("unpublishing removes one"). Asserting it here would have looked like coverage
// and tested the mock.

import { CATALOG_REVALIDATE_SECONDS } from '@forgecommerce/storefront-kit/edge-cache';
import type {
  BrandMap,
  CategoryMap,
  ProductDoc,
  PublishedPageSummary,
} from '@forgecommerce/storefront-kit/read-client';
import { beforeEach, expect, test, vi } from 'vitest';
import { PATHS_PAGE } from '@/lib/collect-pages';
import { CACHEABLE_ENTRIES, SITEMAP_MAX_URLS } from '@/lib/sitemap-data';

const {
  headersMock,
  unstableCache,
  resolveStoreForHost,
  products,
  productPaths,
  brands,
  categories,
  categoryPaths,
  pagesPublished,
  collections,
  storeFlags,
} = vi.hoisted(() => ({
  headersMock: vi.fn(),
  unstableCache: vi.fn(),
  resolveStoreForHost: vi.fn(),
  products: vi.fn(),
  productPaths: vi.fn(),
  brands: vi.fn(),
  categories: vi.fn(),
  categoryPaths: vi.fn(),
  pagesPublished: vi.fn(),
  collections: vi.fn(),
  storeFlags: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('next/cache', () => ({ unstable_cache: unstableCache }));
// ⚠️ `products` IS STILL MOCKED, and still answers correctly — that is deliberate. This file's job includes
// proving the sitemap does not ask for the whole `ProductDoc` any more, and a mock that threw would prove only
// that the call crashes. Wired to a working answer, a regression back to `client.products` produces a
// PERFECTLY CORRECT sitemap and is caught anyway, by the assertion that the call never happened.
// ★ THE MOCK IS `instanceReadClient`, AND THE RENAME IS THE POINT. Both halves of this document — the
// per-host gate in `sitemap.ts` and the walk in `lib/sitemap-data.ts` — ask the port through the INSTANCE's
// face, so that a crawler stops spending the shopper's 400/60 s bucket. Which face that resolves to is
// decided in `instanceReadFace()` and is not observable here: the client is mocked, so this file says nothing
// about the face and does not pretend to. What it keeps proving is the DOCUMENT.
//
// ⚠️ `readClient` IS STILL DECLARED, AND IT THROWS. Dropping it would have made a regression back to the
// shopper's face fail with a missing-export message about a mock; wired to a refusal, it fails saying which
// face this document may not spend. It is never reached on the way through — the modules this test loads that
// do use `readClient` (`templates/collection/CollectionView`) call it only inside handlers this file does not
// run; if that ever changes, the sentence above is what the run prints.
vi.mock('@forgecommerce/storefront-kit/config', () => ({
  resolveStoreForHost,
  readClient: () => {
    throw new Error('the sitemap is an enumeration, not a shopper page — it must not spend the anonymous face');
  },
  instanceReadClient: () => ({
    products,
    productPaths,
    brands,
    categories,
    categoryPaths,
    pagesPublished,
    collections,
    storeFlags,
  }),
}));

import sitemap from './sitemap';

// ---- the cache, faked with the semantics that matter ----------------------------------------------
//
// The real `unstable_cache` needs a request-scoped incremental cache and is an Invariant throw without one, so
// it has to be replaced here. The fake keeps the two properties the sitemap's design leans on: entries are
// separated by their KEY PARTS (Next builds its fixed key from `cb.toString()` plus those, and this callback's
// source is identical for every store), and a REJECTED callback stores nothing (`cacheNewResult` runs only
// after the await). Both are asserted below rather than assumed.

/** Every `unstable_cache(cb, keys, opts)` registration, in order — the policy, as declared. */
const cacheRegistrations: { keys: string[]; opts: { revalidate?: number; tags?: string[] } }[] = [];
/** The entries the cache is actually holding, by key — this is the payload Next would serialize. */
const cacheStore = new Map<string, unknown>();

unstableCache.mockImplementation(
  (cb: () => Promise<unknown>, keys: string[], opts: { revalidate?: number; tags?: string[] }) => {
    cacheRegistrations.push({ keys, opts });
    return async () => {
      const key = JSON.stringify(keys);
      if (cacheStore.has(key)) return cacheStore.get(key);
      const value = await cb(); // a throw propagates and stores NOTHING, exactly like the real one
      cacheStore.set(key, value);
      return value;
    };
  },
);

// ---- fixtures, all local ------------------------------------------------------------------------

const product = (handle: string, path = 'roupas.camisetas'): ProductDoc =>
  ({
    product_id: `prod_${handle}`,
    title: handle,
    handle,
    status: 'active',
    metadata: {},
    options: [],
    skus: [],
    categories: [{ category_id: 'cat_1', path, is_primary: true }],
    media: [],
  }) as unknown as ProductDoc;

const catmap: CategoryMap = {
  cat_1: { name: 'Roupas', path: 'roupas' },
  cat_2: { name: 'Camisetas', path: 'roupas.camisetas' },
};

const brandmap: BrandMap = {
  br_1: { name: 'Marca Viva', slug: 'marca-viva', status: 'active', logo_media: null },
  br_2: { name: 'Marca Morta', slug: 'marca-morta', status: 'archived', logo_media: null },
};

const page = (slug: string, updatedAt = '2026-07-01T12:00:00.000Z'): PublishedPageSummary => ({
  slug,
  title: slug,
  updated_at: updatedAt,
});

/** ★ PORTA-PROJEÇÃO-LEVE — one row of `read.product_paths`: the two facts a link is made of, and no more.
 * `category_path` is the ltree path; turning it into `/roupas/camisetas` is THIS side's job, which is why the
 * kernel does not send a URL. */
const pathRow = (handle: string, categoryPath: string | null = 'roupas.camisetas') => ({
  handle,
  category_path: categoryPath,
});

const list = <T>(
  items: T[],
  over: Partial<{ page: number; limit: number; total: number }> = {},
) => ({
  items,
  page: 1,
  limit: 100,
  total: items.length,
  ...over,
});

/** The same envelope at the paths read's own page size — it is 10× the catalog lists' on purpose (the row is
 * two short strings), and `collectAllParallel` divides `total` by the port's declared `limit`, so a fixture
 * that lied about it would page wrong. */
const pathList = <T>(
  items: T[],
  over: Partial<{ page: number; limit: number; total: number }> = {},
) => list(items, { limit: PATHS_PAGE, ...over });

function onHost(host: string | null) {
  headersMock.mockResolvedValue({ get: (k: string) => (k === 'host' ? host : null) });
}

/** COLL — one row as `read.collections` serves it. Only SERVED collections are ever in that answer, which is
 * the whole reason this file applies no filter of its own. */
const collection = (handle: string) => ({
  collection_id: `col_${handle}`,
  handle,
  name: handle,
  description: null,
  seo_title: null,
  seo_description: null,
  product_count: 3,
});

const urls = (entries: { url: string }[]) => entries.map((e) => e.url);

beforeEach(() => {
  vi.clearAllMocks();
  cacheRegistrations.length = 0;
  cacheStore.clear();
  onHost('loja.example');
  resolveStoreForHost.mockResolvedValue('sto_a');
  productPaths.mockResolvedValue(pathList([pathRow('camiseta-listrada')]));
  products.mockResolvedValue(list([product('camiseta-listrada')]));
  brands.mockResolvedValue(brandmap);
  categories.mockResolvedValue(catmap);
  // MS-M1α — what THIS store's assortment fills. The tenant-wide map above is where the NAMES live; this is
  // the second predicate, and by default the fixture store fills both categories.
  categoryPaths.mockResolvedValue([{ path: 'roupas' }, { path: 'roupas.camisetas' }]);
  pagesPublished.mockResolvedValue(list([page('sobre')]));
  collections.mockResolvedValue(list([collection('winter-essentials')]));
  // pk9/P1 — a store on the street, which is what every store is by default.
  storeFlags.mockResolvedValue({ name: 'Loja', storefront_enabled: true });
});

// ---- ★ the whole map ----------------------------------------------------------------------------

test('★ the sitemap lists home, the categories, the CMS pages, the products and the active brands', async () => {
  // ★★ B2 — THE CATALOG IS LAST, AND THE ORDER IS LOAD-BEARING. Crawlers do not care about it; the document
  // ceiling does. Every other section is bounded by something a merchant counts on their fingers, so the one
  // unbounded section goes at the end and `SITEMAP_MAX_URLS` can only ever cut PRODUCTS — never the home page,
  // a category landing or a CMS page. Moving `...catalog` back up changes WHICH URLs a huge store loses.
  expect(urls(await sitemap())).toEqual([
    'https://loja.example/', // the home page — the single most important URL, and it was absent
    'https://loja.example/roupas',
    'https://loja.example/roupas/camisetas', // ltree `a.b` becomes the URL `/a/b`
    'https://loja.example/sobre',
    'https://loja.example/b/marca-viva',
    'https://loja.example/collection/winter-essentials', // SINGULAR, the sibling of /p/ and /b/
    'https://loja.example/roupas/camisetas/camiseta-listrada', // the canonical path, not /p/<handle>
  ]);
  // an archived brand is not a page anyone should be sent to
  expect(urls(await sitemap())).not.toContain('https://loja.example/b/marca-morta');
});

// ---- ★★ MS-M1α — the sitemap describes THIS STORE, not the tenant --------------------------------

test('★★ a category the store does not FILL is not advertised — even though the tenant map lists it', async () => {
  // The exact shape of MT5-A2: `mt_categoria_qa` exists tenant-wide and its only product is published in
  // another store. The tenant map still carries its NAME (breadcrumbs need it); the store's sitemap must not
  // offer a URL whose PLP is empty here.
  categories.mockResolvedValue({
    ...catmap,
    cat_3: { name: 'MT Categoria QA', path: 'mt_categoria_qa' },
  });
  const out = urls(await sitemap());
  expect(out).not.toContain('https://loja.example/mt_categoria_qa');
  // ★ THE TWIN — the same category, now filled by this store's assortment, IS advertised. Without this half a
  // filter that dropped every category would pass.
  cacheStore.clear();
  categoryPaths.mockResolvedValue([
    { path: 'roupas' },
    { path: 'roupas.camisetas' },
    { path: 'mt_categoria_qa' },
  ]);
  expect(urls(await sitemap())).toContain('https://loja.example/mt_categoria_qa');
});

test('★ the assortment read failing leaves the OLD behaviour, never an empty map', async () => {
  // A sitemap that silently loses every category is a worse day than one advertising a thin one — and the
  // entries whose absence would be deindexing are covered by UncachedSitemap, not by this.
  categoryPaths.mockResolvedValue(null);
  const out = urls(await sitemap());
  expect(out).toContain('https://loja.example/roupas');
  expect(out).toContain('https://loja.example/roupas/camisetas');
});

test('★ the collection landings come from the port UNFILTERED — the served list is the whole predicate', async () => {
  // The kernel already excluded `internal`, archived, scheduled and expired from this answer. If this file
  // ever grew its own filter, it would be a second opinion beside the one the landing route resolves against —
  // and the two would disagree the day one of them changed. So: whatever the port lists, the sitemap lists.
  collections.mockResolvedValue(list([collection('winter'), collection('gift-guide')]));
  const out = urls(await sitemap());
  expect(out).toContain('https://loja.example/collection/winter');
  expect(out).toContain('https://loja.example/collection/gift-guide');
});

test('a store that serves no collection simply has none in its map', async () => {
  collections.mockResolvedValue(list([]));
  expect(urls(await sitemap()).some((u) => u.includes('/collection/'))).toBe(false);
});

test('every URL belongs to the host that asked — one deployment, many stores', async () => {
  onHost('outlet.example');
  const out = await sitemap();
  expect(out.length).toBeGreaterThan(0);
  for (const entry of out) expect(entry.url.startsWith('https://outlet.example/')).toBe(true);
  expect(resolveStoreForHost).toHaveBeenCalledWith('outlet.example');
});

test('an unclaimed host maps to no store → an empty sitemap, and the port is never read', async () => {
  resolveStoreForHost.mockResolvedValue(undefined);
  expect(await sitemap()).toEqual([]);
  expect(productPaths).not.toHaveBeenCalled();
  expect(pagesPublished).not.toHaveBeenCalled();
});

// ---- ★ PORTA-PROJEÇÃO-LEVE: the sitemap never asks for the catalog it does not print ---------------

test('★ the catalog is walked through `product_paths` — the whole ProductDoc is NEVER asked for', async () => {
  // THE MECHANISM, in one assertion. `read.products` serves 13.346 bytes per product (9.739 of them `skus`);
  // what a URL needs off it is 51. Walking the demo catalog through it cost 44,53 MB to emit 399,6 KB — and,
  // worse, put 18 of its 28 pages over Next's 2MB data-cache ceiling, where they are dropped in production by
  // a bare `return` with no log. The read this file must use is the narrow one.
  //
  // ⚠️ `products` above is mocked to a WORKING answer, so a revert to `client.products(...)` still produces a
  // byte-identical sitemap. This test is the only thing between that revert and a green suite.
  await sitemap();

  // The PROHIBITION first, so a revert fails for the reason this test exists rather than on a shape mismatch.
  expect(
    products,
    'the sitemap must never pull a ProductDoc it prints 51 bytes of',
  ).not.toHaveBeenCalled();
  expect(productPaths).toHaveBeenCalledWith('sto_a', { page: 1, limit: PATHS_PAGE });
});

// ---- lastModified: only where the date means something -------------------------------------------

test('★ lastModified rides ONLY on the CMS pages — the one date the projections actually carry', async () => {
  pagesPublished.mockResolvedValue(list([page('sobre', '2026-07-01T12:00:00.000Z')]));
  const out = await sitemap();

  const cms = out.find((e) => e.url.endsWith('/sobre'));
  expect(cms?.lastModified).toEqual(new Date('2026-07-01T12:00:00.000Z'));

  // Everything else OMITS the field rather than inventing one. `ProductDoc` and `CategoryMap` carry no date at
  // all, and a made-up `lastmod` is worse than an absent one: it teaches the crawler to distrust the file.
  for (const entry of out.filter((e) => !e.url.endsWith('/sobre'))) {
    expect(entry.lastModified).toBeUndefined();
  }
});

// ---- paging: both paginated reads are walked to the end -------------------------------------------

test('★ the catalog is walked past the port ceiling — a store past one page lands whole, not truncated', async () => {
  const first = Array.from({ length: PATHS_PAGE }, (_, i) => pathRow(`p${i}`));
  const second = Array.from({ length: 50 }, (_, i) => pathRow(`q${i}`));
  const total = PATHS_PAGE + 50;
  productPaths
    .mockResolvedValueOnce(pathList(first, { total }))
    .mockResolvedValueOnce(pathList(second, { page: 2, total }));

  const out = await sitemap();
  expect(out.filter((e) => e.url.includes('/camisetas/')).length).toBe(total);
  expect(productPaths).toHaveBeenNthCalledWith(1, 'sto_a', { page: 1, limit: PATHS_PAGE });
  expect(productPaths).toHaveBeenNthCalledWith(2, 'sto_a', { page: 2, limit: PATHS_PAGE });
});

test('the CMS is paged the same way — a store with more pages than one port page keeps its tail', async () => {
  const first = Array.from({ length: 24 }, (_, i) => page(`page-${i}`));
  pagesPublished
    .mockResolvedValueOnce({ items: first, page: 1, limit: 24, total: 30 })
    .mockResolvedValueOnce({
      items: Array.from({ length: 6 }, (_, i) => page(`tail-${i}`)),
      page: 2,
      limit: 24,
      total: 30,
    });

  const out = await sitemap();
  expect(out.filter((e) => e.url.includes('/tail-')).length).toBe(6);
  expect(pagesPublished).toHaveBeenCalledTimes(2);
});

test('a port that keeps answering never spins the sitemap forever (the backstop still holds)', async () => {
  // `total` lies (always larger than what was delivered) — without a brake this loops until the process dies.
  // The loop must give up and still return what it has.
  //
  // ★★ B2 — AND THE BRAKE IS NOT A PAGE COUNT ANY MORE. The port answered 1 row for a page it declares holds
  // 1000: a page under the port's own `limit` is the last page. That costs ONE request, where the old
  // `PATHS_MAX_PAGES = 10` cost ten — and, unlike the constant, it is not also a ceiling on how many products
  // the merchant is allowed to have.
  productPaths.mockResolvedValue(pathList([pathRow('same')], { total: 999_999 }));
  const out = await sitemap();
  expect(productPaths.mock.calls.length).toBe(1);
  expect(out.length).toBeGreaterThan(0);
});

// ---- ★★ B2 — THE 10.000-PRODUCT CEILING WAS A DATE IN THE CALENDAR ------------------------------
//
// ★ THE DEFECT. `PATHS_MAX_PAGES(10) × PATHS_PAGE(1000)` is 10.000 PRODUCTS, and past that the walk simply
// stopped: the sitemap advertised 10.000 URLs for a store with more, forever, and nothing in the file or the
// response said so. Same date in the calendar the feed carried (M3), one consumer over.
//
// ★ AND THE NUMBER IS NOT GONE — IT MOVED TO WHAT IT WAS ACTUALLY PROTECTING. It was never a statement about
// catalogs; it was Next's 2MB data-cache cliff expressed in products. So it is now the ceiling on what may be
// CACHED (`CACHEABLE_ENTRIES`), and a bigger store is served WHOLE and cached not at all.

/** A port serving `total` products honestly, `PATHS_PAGE` at a time. */
const honestPaths = (total: number) => async (_store: string, opts: { page: number }) => {
  const from = (opts.page - 1) * PATHS_PAGE;
  return pathList(
    Array.from({ length: Math.max(0, Math.min(PATHS_PAGE, total - from)) }, (_, i) =>
      pathRow(`p-${from + i}`),
    ),
    { page: opts.page, total },
  );
};

test('★ a catalog ABOVE the old 10.000-product ceiling comes out WHOLE', async () => {
  // The case that failed before B2: 12.000 products, of which the sitemap published 10.000 and said nothing.
  const TOTAL = 12_000;
  productPaths.mockImplementation(honestPaths(TOTAL));

  const out = await sitemap();

  // The count is named in the failure message, not left to `expected 10000 to be 12000`: when a ceiling comes
  // back, what this test owes its reader is how much of the merchant's catalog stopped being advertised.
  const published = out.filter((e) => e.url.includes('/camisetas/')).length;
  expect(
    published,
    `${TOTAL - published} of ${TOTAL} products left out of the sitemap (${Math.ceil((TOTAL - published) / PATHS_PAGE)} pages of ${PATHS_PAGE} never asked for)`,
  ).toBe(TOTAL);
  expect(productPaths).toHaveBeenCalledTimes(12); // exactly the pages the answer implies — no ceiling, no waste
});

test('★ and past what the CACHE holds it is served whole, stored NOT AT ALL, and the log names both numbers', async () => {
  // The 2MB cliff is real and it is silent (production drops an oversized entry with a bare `return`). What
  // changes is who pays: the merchant used to pay in missing URLs, and now the box pays in a walk per request
  // — which is exactly what a >10.000 store already got, since the truncated walk was never cacheable either.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  productPaths.mockImplementation(honestPaths(12_000));

  const out = await sitemap();

  expect(out.length).toBeGreaterThan(CACHEABLE_ENTRIES);
  expect(cacheStore.size, 'an entry Next would drop must not be stored').toBe(0);
  const line = warn.mock.calls.map((c) => String(c[0])).join('\n');
  expect(line, 'what the store has').toContain('12006');
  expect(line, 'what fits').toContain(String(CACHEABLE_ENTRIES));
  warn.mockRestore();

  // and it walks again next request, rather than serving a frozen answer
  const after = productPaths.mock.calls.length;
  await sitemap();
  expect(productPaths.mock.calls.length).toBeGreaterThan(after);
});

test('★ the ONE ceiling that still drops a URL drops PRODUCTS, and says how many', async () => {
  // A sitemap file holds 50.000 URLs; over that it is not a big file, it is an invalid one, and the crawler
  // rejects the whole document. So this cut is real — and it is loud, and it lands on the catalog, because the
  // catalog is assembled last precisely so a store never loses its home page or a landing to it.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  productPaths.mockImplementation(honestPaths(SITEMAP_MAX_URLS + 1_000));

  const out = await sitemap();

  expect(out).toHaveLength(SITEMAP_MAX_URLS);
  expect(urls(out)).toContain('https://loja.example/'); // the fixed sections survive the cut, by construction
  expect(urls(out)).toContain('https://loja.example/sobre');
  const line = warn.mock.calls.map((c) => String(c[0])).join('\n');
  expect(line, 'a cut that does not name itself is the defect this fatia closed').toMatch(
    /dropped=1006\b/,
  );
  expect(line).toContain(String(SITEMAP_MAX_URLS));
  warn.mockRestore();
});

// ---- degradation --------------------------------------------------------------------------------

test('a store with no CMS pages and no categories still gets home, products and brands', async () => {
  categories.mockResolvedValue({});
  pagesPublished.mockResolvedValue(list([]));
  expect(urls(await sitemap())).toEqual([
    'https://loja.example/',
    'https://loja.example/b/marca-viva',
    'https://loja.example/collection/winter-essentials', // SINGULAR, the sibling of /p/ and /b/
    'https://loja.example/roupas/camisetas/camiseta-listrada',
  ]);
});

test('a null from a read (port hiccup on one capability) drops that section, never the whole file', async () => {
  categories.mockResolvedValue(null);
  pagesPublished.mockResolvedValue(null);
  const out = urls(await sitemap());
  expect(out).toContain('https://loja.example/');
  expect(out).toContain('https://loja.example/roupas/camisetas/camiseta-listrada');
});

// ---- CAT-STATUS-GAP: the file follows the resolver, through the same predicate --------------------

test('★ an INACTIVE category is not listed — the resolver 404s it, so listing it would be a lie', async () => {
  categories.mockResolvedValue({
    cat_1: { name: 'Roupas', path: 'roupas', status: 'active' },
    cat_2: { name: 'Saldos', path: 'saldos', status: 'inactive' },
  });
  const out = urls(await sitemap());
  expect(out).toContain('https://loja.example/roupas');
  expect(out).not.toContain('https://loja.example/saldos');
});

test('★ a category with NO status is listed — the sitemap inherits the same safe fallback', async () => {
  // Same hazard as the resolver's: the cached blob predates the field. `isCategoryBrowsable` is the ONE place
  // that decides, so the sitemap cannot drift from what the store actually serves. (The fixtures in the rest
  // of this file carry no status either, which is exactly why they still list.)
  categories.mockResolvedValue({ cat_1: { name: 'Roupas', path: 'roupas' } });
  expect(urls(await sitemap())).toContain('https://loja.example/roupas');
});

// ---- T6/SF-PERF: the cache policy, asserted as GEOMETRY ------------------------------------------
//
// Not one assertion here is about wall-clock time. On a box running eight agents a timing assertion measures
// the queue; what is provable is the SHAPE — how many requests reach the port, in what order, how much they
// overlap, what key the result is filed under and which tag lifts it.

test('★ the page walk OVERLAPS — the serial version is what made this cost seconds', async () => {
  let inFlight = 0;
  let peak = 0;
  const total = PATHS_PAGE * 5;
  productPaths.mockImplementation(async (_store: string, opts: { page: number }) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return pathList(
      Array.from({ length: PATHS_PAGE }, (_, i) => pathRow(`p${opts.page}_${i}`)),
      { page: opts.page, total },
    );
  });

  const out = await sitemap();

  expect(out.filter((e) => e.url.includes('/camisetas/')).length).toBe(total);
  expect(productPaths).toHaveBeenCalledTimes(5);
  expect(peak, 'pages after the first must be in flight together').toBeGreaterThan(1);
});

test('★ the result is filed under the STORE and lifted by `store:<id>` — the tag the kernel already posts', async () => {
  // The invalidation consumer purges exactly `store:<id>` on every catalog event. Riding that tag is what makes
  // a five-minute window safe instead of stale: the TTL is the backstop, the event is the authority.
  await sitemap();

  expect(cacheRegistrations).toHaveLength(1);
  const registration = cacheRegistrations[0];
  expect(
    registration?.keys,
    'the key parts are the ONLY thing separating one store from another',
  ).toContain('sto_a');
  expect(registration?.opts.tags).toContain('store:sto_a');
  expect(registration?.opts.revalidate).toBe(CATALOG_REVALIDATE_SECONDS);
});

test('★ a second request does not touch the port at all', async () => {
  await sitemap();
  const afterFirst = productPaths.mock.calls.length;
  expect(afterFirst).toBeGreaterThan(0);

  await sitemap();
  expect(productPaths.mock.calls.length, 'the hit must not walk the catalog again').toBe(
    afterFirst,
  );
});

test('★ two hosts of the same store share ONE entry, and still get their own origin', async () => {
  // One deployment serves many hosts (MS-STORE). Caching absolute URLs would file the same catalog twice and,
  // worse, let one host be served the other's URLs. Paths are cached; the origin is applied after.
  onHost('loja.example');
  const first = await sitemap();
  onHost('outlet.example');
  const second = await sitemap();

  expect(new Set(cacheRegistrations.map((r) => JSON.stringify(r.keys))).size).toBe(1);
  expect(cacheStore.size).toBe(1);
  expect(first.every((e) => e.url.startsWith('https://loja.example/'))).toBe(true);
  expect(second.every((e) => e.url.startsWith('https://outlet.example/'))).toBe(true);
  expect(urls(second)).toEqual(urls(first).map((u) => u.replace('loja.example', 'outlet.example')));
});

test("★ the cached entry stays under Next's 2MB ceiling AT THE CACHEABLE LIMIT", async () => {
  // This is the cliff that produced the card: Next drops any data-cache entry over 2MB and, in production, the
  // refusal is a bare `return` — no log. Caching `ProductDoc` pages hit it (18 of the demo catalog's 28 pages
  // are over), which is why what is cached is the DERIVED path list. `CACHEABLE_ENTRIES` is the most that is
  // ever stored, so if the entry fits here it fits always — and the handles are long on purpose, because a
  // fixture of `p-1` would prove the assertion against rows no real catalog has.
  //
  // ⚠️ The ceiling asserted is the BASE64-ADJUSTED one, not the round 2MB: the entry is stored base64, so 2MB
  // of cache is ≈1,5 MiB of payload. Asserting the round number would pass for an entry Next silently drops.
  const TOTAL = CACHEABLE_ENTRIES - 6; // + the fixture's home, 2 categories, 1 CMS page, 1 brand, 1 collection
  productPaths.mockImplementation(async (_store: string, opts: { page: number }) => {
    const from = (opts.page - 1) * PATHS_PAGE;
    return pathList(
      Array.from({ length: Math.max(0, Math.min(PATHS_PAGE, TOTAL - from)) }, (_, i) =>
        pathRow(`produto-de-nome-bem-comprido-${from + i}`),
      ),
      { page: opts.page, total: TOTAL },
    );
  });

  await sitemap();

  const [entry] = [...cacheStore.values()];
  expect((entry as unknown[]).length).toBe(CACHEABLE_ENTRIES);
  expect(JSON.stringify(entry).length).toBeLessThan(1.5 * 1024 * 1024);
});

test('★ an INCOMPLETE walk is served but NEVER cached — a truncated sitemap must not freeze', async () => {
  // A page that fails today is swallowed and the short file is served in silence. That was survivable while
  // nothing was cached; with a cache in front, the truncation would be pinned for the whole window and no
  // response would say so. So: serve what we got, store nothing, walk again next time.
  productPaths.mockImplementation(async (_store: string, opts: { page: number }) =>
    opts.page === 3
      ? null
      : pathList(
          Array.from({ length: PATHS_PAGE }, (_, i) => pathRow(`p${opts.page}_${i}`)),
          { page: opts.page, total: PATHS_PAGE * 5 },
        ),
  );

  const out = await sitemap();
  expect(out.filter((e) => e.url.includes('/camisetas/')).length).toBe(PATHS_PAGE * 4); // what it did get
  expect(cacheStore.size, 'a short walk must not be stored').toBe(0);

  const callsAfterFirst = productPaths.mock.calls.length;
  await sitemap();
  expect(productPaths.mock.calls.length, 'the next request must walk again').toBeGreaterThan(
    callsAfterFirst,
  );
});

// ---- pk9/P1 · a store with no public page ---------------------------------------------------------

test('★★ a store with NO public page hands a crawler nothing', async () => {
  // The refusal this fork was cut without. Every URL this file would emit answers 404
  // (`requirePublicStorefront`, mounted in both store-scoped trees); this route lives OUTSIDE both of them —
  // the middleware matcher excludes `sitemap.xml` and it sits above every `[store]` segment — so the layouts'
  // refusal cannot reach it and it has to ask for itself. Measured before the fix: the whole list of URLs.
  storeFlags.mockResolvedValue({ name: 'Balcão', storefront_enabled: false });

  expect(await sitemap()).toEqual([]);
  expect(
    productPaths,
    'a store with no public page must not even be walked: the catalogue read is spent on nothing',
  ).not.toHaveBeenCalled();
});

test('a kernel older than the flag still gets its whole sitemap', async () => {
  // ⚠️ THE CONTROL AGAINST REFUSING TOO MUCH. The field is optional on the wire. Read as "falsy means
  // private", every store on such an instance would silently lose its sitemap — the entire SEO surface, from
  // one missing key — which is a worse defect than the one being fixed.
  storeFlags.mockResolvedValue({ name: 'Loja' });

  expect((await sitemap()).length).toBeGreaterThan(0);
});
