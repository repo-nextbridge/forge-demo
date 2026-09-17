// COLL wave 2 — the collection landing's RESOLUTION, which is where every "is this served?" answer is decided.
//
// THE INVARIANT: this template holds NO predicate about visibility, schedule or archival. It asks the port for
// the store's served collections and 404s on anything absent from that answer. So these cases pin the
// DELEGATION, not a copy of the rule — a future reader must not be able to "helpfully" add
// `if (visibility === 'internal')` here and keep the tests green, because the kernel's answer would then have
// a second opinion beside it.
//
// The store-assortment case (a collection product this store does not carry) lives in the PORT: `read.products`
// is store-scoped, so the template proves it by passing the store through, and the kernel's own test proves the
// filtering. Asserting it twice with a stub would only pin the stub.

import { beforeEach, expect, test, vi } from 'vitest';

const { readClient } = vi.hoisted(() => ({ readClient: vi.fn() }));
vi.mock('@forgeco/storefront-kit/config', () => ({ readClient }));
// The render's furniture is not what is under test — only WHICH question the view asks the port.
vi.mock('@/lib/cardChrome', () => ({
  cardChrome: async () => ({ freeShippingThreshold: null, maxInstallments: 1 }),
}));
vi.mock('@/lib/cardRatings', () => ({ cardRatings: async () => ({}) }));
vi.mock('@/templates/list/template', () => ({ ListTemplate: () => null }));
vi.mock('@/components/ProductCard', () => ({ ProductCard: () => null }));
vi.mock('@/components/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/lib/extensions/ExtensionOutlet', () => ({ ExtensionOutlet: () => null }));

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { parseFilterState } from '@/lib/filters/filter-url';
import {
  CollectionView,
  collectionMetadata,
  collectionPath,
  servedCollection,
} from './CollectionView';

type Served = {
  collection_id: string;
  handle: string;
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  product_count: number;
};

const row = (over: Partial<Served> = {}): Served => ({
  collection_id: 'col_1',
  handle: 'winter',
  name: 'Winter Essentials',
  description: null,
  seo_title: null,
  seo_description: null,
  product_count: 4,
  ...over,
});

/** The port, answering with ONE page of served collections. */
function servingCollections(items: Served[], total = items.length) {
  const collections = vi.fn().mockResolvedValue({ items, page: 1, limit: 100, total });
  readClient.mockReturnValue({ collections });
  return collections;
}

beforeEach(() => vi.clearAllMocks());

test('the public path is SINGULAR and English — the sibling of /p/ and /b/', () => {
  // `/collections/winter` would read as "the list of collections, item winter", which is a different page and
  // does not exist. The decision is pinned here so a well-meaning pluralisation is a red test, not a 404 in
  // production and a dead entry in the sitemap.
  expect(collectionPath('winter')).toBe('/collection/winter');
});

test('a collection the port SERVES resolves', async () => {
  servingCollections([row()]);
  expect(await servedCollection('sto_1', 'winter')).toMatchObject({ handle: 'winter' });
});

test('★ a collection the port does NOT list resolves to null — whatever the reason', async () => {
  // internal / archived / scheduled / expired all arrive here identically: ABSENT. That is the point — the
  // template cannot tell them apart and must not try, because the kernel already decided.
  servingCollections([row({ handle: 'other' })]);
  expect(await servedCollection('sto_1', 'winter')).toBeNull();
});

test('the walk crosses pages — a store with more collections than one page still serves the later ones', async () => {
  const full = Array.from({ length: 100 }, (_, i) =>
    row({ handle: `c${i}`, collection_id: `col_${i}` }),
  );
  const collections = vi
    .fn()
    .mockResolvedValueOnce({ items: full, page: 1, limit: 100, total: 101 })
    .mockResolvedValueOnce({ items: [row({ handle: 'late' })], page: 2, limit: 100, total: 101 });
  readClient.mockReturnValue({ collections });

  expect(await servedCollection('sto_1', 'late')).toMatchObject({ handle: 'late' });
  expect(collections).toHaveBeenCalledTimes(2);
});

test('a port that answers nothing is a null, not a crash', async () => {
  readClient.mockReturnValue({ collections: vi.fn().mockResolvedValue(null) });
  expect(await servedCollection('sto_1', 'winter')).toBeNull();
});

// ── Metadata ────────────────────────────────────────────────────────────────────────────────────────────

test('metadata prefers the SEO fields, falling back to name and description', async () => {
  servingCollections([
    row({
      seo_title: 'Winter, all of it',
      seo_description: 'Coats and boots',
      description: 'ignored',
    }),
  ]);
  const meta = await collectionMetadata('sto_1', 'winter');
  expect(meta.title).toBe('Winter, all of it');
  expect(meta.description).toBe('Coats and boots');
  expect(meta.alternates?.canonical).toBe('/collection/winter');
});

test('with no SEO override, the name and the description carry it', async () => {
  servingCollections([row({ description: 'Everything for the cold' })]);
  const meta = await collectionMetadata('sto_1', 'winter');
  expect(meta.title).toBe('Winter Essentials');
  expect(meta.description).toBe('Everything for the cold');
});

test('★ a collection that is not served gets EMPTY metadata — never the merchant’s internal naming', async () => {
  // The page is a 404. Titling it would put a retired (or deliberately unlisted) collection's name into a
  // crawler's index, which is the opposite of what `internal` means.
  servingCollections([]);
  expect(await collectionMetadata('sto_1', 'winter')).toEqual({});
});

// ── The store assortment ────────────────────────────────────────────────────────────────────────────────

test('★ the PLP asks the port for THIS store — the assortment is a parameter, never a filter applied after', async () => {
  // A collection belongs to the TENANT and a store serves the INTERSECTION with its own catalogue (decision
  // 8). `read.products` is store-scoped, so the whole guarantee is that the view passes through the store it
  // was rendered for. That sounds too small to test until you sabotage it: pinning a fixed store id here made
  // every host serve one store's assortment, and NOTHING went red — the case existed only for `servedCollection`
  // and metadata. Green with that fraud active means the guard was ABSENT, not weak, so here it is.
  const products = vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 });
  readClient.mockReturnValue({
    collections: vi.fn().mockResolvedValue({ items: [row()], page: 1, limit: 100, total: 1 }),
    products,
  });

  await CollectionView({
    base: HOST_BASE,
    store: 'sto_theirs',
    handle: 'winter',
    page: 1,
    state: parseFilterState({}),
  });

  expect(products).toHaveBeenCalled();
  for (const call of products.mock.calls) {
    expect(call[0], 'the PLP queried a store other than the one it is serving').toBe('sto_theirs');
    expect((call[1] as { collection?: string }).collection).toBe('winter');
  }
});
