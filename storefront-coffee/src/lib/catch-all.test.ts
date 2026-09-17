// The catch-all resolution ORDER (CMS-1): platform routes are handled by Next before this resolver; here we
// prove CATALOG → PAGE → 404, with the DoD collision case (a page slug that also matches a product handle or
// a category loses to the catalog). Pure reads are stubbed — no port, no Next.

import type {
  CategoryMap,
  PageDoc,
  ProductDoc,
  ReadList,
} from '@forgeco/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { type CatchAllReads, resolveCatchAll } from './catch-all';

const product = (handle: string) => ({ handle, title: `P ${handle}` }) as unknown as ProductDoc;
const pageDoc = (slug: string): PageDoc => ({
  slug,
  title: `Page ${slug}`,
  template_key: 'faq',
  meta_title: null,
  meta_description: null,
});
const emptyList: ReadList<ProductDoc> = { items: [], page: 1, limit: 24, total: 0 };
const OPTS = { page: 1, limit: 24 };

/** Build a reads stub — everything null/empty by default; override the relevant ones per test. */
function reads(over: Partial<CatchAllReads>): CatchAllReads {
  return {
    productByHandle: async () => null,
    products: async () => emptyList,
    categories: async () => ({}) as CategoryMap,
    pageBySlug: async () => null,
    ...over,
  };
}

test('★ catalog wins: a slug that is ALSO a product handle resolves to the product, not the page', async () => {
  const r = await resolveCatchAll(
    reads({
      productByHandle: async (_s, h) => (h === 'shoe' ? product('shoe') : null),
      pageBySlug: async () => pageDoc('shoe'), // a page with the same slug exists — it must lose
    }),
    'A',
    ['shoe'],
    OPTS,
  );
  expect(r.kind).toBe('product');
});

test('★ catalog wins: a slug that is a real category resolves to the list, not the page', async () => {
  const catmap: CategoryMap = { c1: { name: 'Shoes', path: 'shoes' } };
  const r = await resolveCatchAll(
    reads({
      categories: async () => catmap,
      pageBySlug: async () => pageDoc('shoes'), // same-slug page loses to the real category
    }),
    'A',
    ['shoes'],
    OPTS,
  );
  expect(r.kind).toBe('category');
});

test('★ a single-segment slug that is neither product nor category resolves to the CMS page', async () => {
  const r = await resolveCatchAll(
    reads({ pageBySlug: async (_s, slug) => (slug === 'about' ? pageDoc('about') : null) }),
    'A',
    ['about'],
    OPTS,
  );
  expect(r.kind).toBe('page');
  if (r.kind === 'page') expect(r.page.slug).toBe('about');
});

test('a single-segment path matching nothing is a 404 (not an empty category list)', async () => {
  const r = await resolveCatchAll(reads({}), 'A', ['nope'], OPTS);
  expect(r.kind).toBe('not_found');
});

test('a page is a single segment only — a multi-segment path never resolves to a page', async () => {
  const r = await resolveCatchAll(
    reads({ pageBySlug: async () => pageDoc('deep') }), // even if a page existed, it is not attempted
    'A',
    ['a', 'b'],
    OPTS,
  );
  expect(r.kind).toBe('not_found');
});

test('an empty real category still renders its list (category exists in the catmap)', async () => {
  const catmap: CategoryMap = { c1: { name: 'Empty', path: 'empty' } };
  const r = await resolveCatchAll(reads({ categories: async () => catmap }), 'A', ['empty'], OPTS);
  expect(r.kind).toBe('category');
  if (r.kind === 'category') expect(r.list.items).toHaveLength(0);
});

// ---- CAT-STATUS-GAP: a category that exists is not the same as a category that is SERVED -----------
// The resolver is the gate: `not_found` here is the `notFound()` of [...catpath]/page.tsx, i.e. a real HTTP
// 404 (measured on the bench: 200 before the fix, 404 after — no redirect either way).

test('an ACTIVE category still resolves to its list — the happy path is untouched', async () => {
  const catmap: CategoryMap = { c1: { name: 'Shoes', path: 'shoes', status: 'active' } };
  const r = await resolveCatchAll(reads({ categories: async () => catmap }), 'A', ['shoes'], OPTS);
  expect(r.kind).toBe('category');
});

test('★ an INACTIVE category is a 404, not a list — it is in the map, it is not served', async () => {
  const catmap: CategoryMap = { c1: { name: 'Shoes', path: 'shoes', status: 'inactive' } };
  const r = await resolveCatchAll(reads({ categories: async () => catmap }), 'A', ['shoes'], OPTS);
  expect(r.kind).toBe('not_found');
});

test('★★ a category with NO status resolves — the old cached blob must not blank the store', async () => {
  // The one that matters: `read.categories` is served from a Redis blob cached before `status` existed, so
  // for up to an hour after the deploy every entry arrives without the field. Reading that as "inactive"
  // would 404 the entire navigation of every store, silently. This test is what forbids it.
  const catmap: CategoryMap = { c1: { name: 'Shoes', path: 'shoes' } };
  const r = await resolveCatchAll(reads({ categories: async () => catmap }), 'A', ['shoes'], OPTS);
  expect(r.kind).toBe('category');
});

test('an inactive category does not shadow a real CMS page on the same slug', async () => {
  // An inactive category is not a category, so resolution CONTINUES (CATALOG → PAGE → 404). A published page
  // with that slug is a resource that exists and wins — the collision rule only ever protected a category
  // that is actually served.
  const catmap: CategoryMap = { c1: { name: 'Shoes', path: 'shoes', status: 'inactive' } };
  const r = await resolveCatchAll(
    reads({ categories: async () => catmap, pageBySlug: async () => pageDoc('shoes') }),
    'A',
    ['shoes'],
    OPTS,
  );
  expect(r.kind).toBe('page');
});
