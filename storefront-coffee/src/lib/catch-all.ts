// The catch-all resolver — the ONE place `/s/<store>/<...segments>` decides what a clean path is. Pure and
// injectable (the reads are passed in) so the resolution ORDER is unit-testable without booting Next.
//
// Resolution order (docs/conventions/front-composition.md): PLATFORM routes win first — they are literal
// segments (`/search`, `/checkout`, `/p/<handle>`) that Next matches BEFORE this catch-all, so they never
// reach here. Within the catch-all the order is CATALOG → PAGE → 404:
//   1. a PRODUCT whose handle is the last segment (the most specific catalog match);
//   2. a real CATEGORY the store SERVES (its path is in the category map AND it is browsable) — the list
//      renders even when empty; a deactivated category is not served and falls through;
//   3. a CMS PAGE by slug — a SINGLE-segment slug only (institutional pages are flat), which also keeps deep
//      category paths unambiguous; a page whose slug collides with a product handle or a category loses to the
//      catalog by this very order (the DoD collision case);
//   4. otherwise 404.
// Note this makes an unknown path a real 404 (not an empty category list) — the catalog branch matches only a
// category that actually exists, so garbage falls through to the page lookup and then to notFound().

import { segmentsToLtree } from '@forgeco/storefront-kit/catalog-path';
import { isCategoryBrowsable } from '@forgeco/storefront-kit/category-visibility';
import type {
  CatalogList,
  CategoryMap,
  PageDoc,
  ProductDoc,
  ReadClient,
} from '@forgeco/storefront-kit/read-client';
import { accumulateList, PLP_PAGE_SIZE } from '@/lib/filters/plp';

/** The reads the resolver needs — a structural subset of ReadClient, so a test can pass a small stub. */
export type CatchAllReads = Pick<
  ReadClient,
  'productByHandle' | 'products' | 'categories' | 'pageBySlug'
>;

export type CatchAllResolution =
  | { kind: 'product'; product: ProductDoc }
  | { kind: 'category'; categoryPath: string; list: CatalogList; catmap: CategoryMap }
  | { kind: 'page'; page: PageDoc }
  | { kind: 'not_found' };

export async function resolveCatchAll(
  reads: CatchAllReads,
  store: string,
  catpath: string[],
  opts: {
    page: number;
    limit: number;
    sort?: string;
    facets?: boolean;
    filters?: Record<string, string>;
  },
): Promise<CatchAllResolution> {
  // 1. CATALOG — a product whose handle is the last segment.
  const handle = catpath[catpath.length - 1];
  if (handle) {
    const product = await reads.productByHandle(store, handle);
    if (product) return { kind: 'product', product };
  }

  // 2. CATALOG — a category that ACTUALLY exists (its ltree path is in the store's category map) AND that the
  //    store SERVES. A real category renders its list even when empty; a non-category path must not swallow the
  //    segment. CAT-STATUS-GAP: existing is not the same as being served — a category deactivated in the admin
  //    is in the map and must still 404 here, or it goes on being browsed and indexed. This resolver is the
  //    GATE: everything that links to a category asks the same predicate, so the links follow the gate.
  const categoryPath = segmentsToLtree(catpath);
  const catmap = (await reads.categories(store)) ?? {};
  const isCategory = Object.values(catmap).some(
    (c) => c.path === categoryPath && isCategoryBrowsable(c),
  );
  if (isCategory) {
    // The render passes limit = accumLimit(N) = N·20 (page stays 1). Recover N and page the port in 20s so a big
    // category (959 in tênis) is fully browsable — a single > 100 call would trip the port's limit ceiling.
    // Metadata's limit 20 → N=1 (one page). facets/total come from the first port page.
    const uiPage = Math.max(1, Math.round(opts.limit / PLP_PAGE_SIZE));
    const list = (await accumulateList(
      (p, l, withFacets) =>
        reads.products(store, {
          category: categoryPath,
          page: p,
          limit: l,
          sort: opts.sort,
          facets: withFacets ? opts.facets : false,
          filters: opts.filters,
        }),
      uiPage,
    )) ?? { items: [], page: 1, limit: 0, total: 0 };
    return { kind: 'category', categoryPath, list, catmap };
  }

  // 3. CMS PAGE — a single-segment slug only.
  if (catpath.length === 1) {
    const slug = catpath[0];
    if (slug) {
      const page = await reads.pageBySlug(store, slug);
      if (page) return { kind: 'page', page };
    }
  }

  // 4. Nothing matched.
  return { kind: 'not_found' };
}
