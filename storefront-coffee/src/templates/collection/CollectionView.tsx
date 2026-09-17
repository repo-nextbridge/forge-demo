// The collection PLP's RENDER, lifted out of its route files so ONE implementation serves both trees —
// `c/[store]/collection/[handle]` (edge-cacheable: reads nothing per-visitor, so it renders page 1 unfiltered,
// which is what a clean URL and a crawler ask for) and `s/[store]/(storefront)/collection/[handle]` (dynamic:
// it reads `searchParams` for pagination and the filter axes). Next fixes cacheability per ROUTE FILE, so the
// two entries must be two files; they must never be two implementations. The same shape `CatalogView` set.
//
// ★ WHAT IS SERVED IS THE KERNEL'S ANSWER, NOT A PREDICATE COPIED HERE. `read.collections` returns only the
// collections a store SERVES: `internal` has no URL by construction (decision 5), archived is retired
// (decision 9), and outside the schedule is not served (decision 4). So the 404 below is "the port did not
// list it" — there is no `if (visibility === 'internal')` in this file, and there must never be one. The
// sitemap resolves the same way, from the same read, which is what keeps it from advertising a URL that
// answers 404. (The sitemap's own header records what a second copy of a predicate cost with categories.)
//
// Nothing here may touch a dynamic API (cookies/headers): on the cacheable entry that is a runtime 500, not a
// degrade — LAW 2 of `edge-cache.guard.test.ts`.

import { canonicalProductPath } from '@forgeco/storefront-kit/catalog-path';
import { readClient } from '@forgeco/storefront-kit/config';
import type { CollectionSummary } from '@forgeco/storefront-kit/read-client';
import { type StoreBase, storeHref } from '@forgeco/storefront-kit/store-route';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { cardChrome } from '@/lib/cardChrome';
import { cardRatings } from '@/lib/cardRatings';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { type FilterState, parseFilterState, toQueryParams } from '@/lib/filters/filter-url';
import { accumulateList, buildSwatchImages } from '@/lib/filters/plp';
import { ListTemplate } from '@/templates/list/template';

/** What the cacheable entry renders: the clean URL — page 1, no filters. Built through the same parser the
 * dynamic entry runs on `searchParams`, so "no filters" has ONE definition and cannot drift. */
export const CLEAN_VIEW: { page: number; state: FilterState } = {
  page: 1,
  state: parseFilterState({}),
};

/** The public path of a collection landing. SINGULAR, and in English — the sibling segments this theme already
 * serves are `/p/<handle>` and `/b/<slug>`, both naming the ONE thing the page is. `/collections/x` would read
 * as "the list of collections, item x", which is a different page and does not exist. */
export const collectionPath = (handle: string): string => `/collection/${handle}`;

/**
 * The collection a store serves, by handle — or null.
 *
 * It reads the store's served list rather than a by-handle read, because that read is the one the kernel
 * filters (and the one the sitemap walks). The list is paginated, so this walks it: a store with more
 * collections than one page must not have its later landings 404 for a reason no one can see.
 */
export async function servedCollection(
  store: string,
  handle: string,
): Promise<CollectionSummary | null> {
  const PAGE = 100;
  const MAX_PAGES = 20;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await readClient().collections(store, { page, limit: PAGE });
    const items = list?.items ?? [];
    const hit = items.find((c) => c.handle === handle);
    if (hit) return hit;
    if (items.length === 0 || items.length < PAGE) return null;
  }
  return null;
}

export async function collectionMetadata(store: string, handle: string): Promise<Metadata> {
  const collection = await servedCollection(store, handle);
  // A collection the store does not serve gets NO metadata — the page it belongs to is a 404, and titling a
  // 404 with the merchant's internal naming would leak it into a crawler's index.
  if (!collection) return {};
  const title = collection.seo_title ?? collection.name;
  const description = collection.seo_description ?? collection.description ?? undefined;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: collectionPath(handle) },
    openGraph: { title, ...(description ? { description } : {}), type: 'website' },
  };
}

export async function CollectionView({
  store,
  base,
  handle,
  page,
  state,
}: {
  store: string;
  base: StoreBase;
  handle: string;
  page: number;
  state: FilterState;
}) {
  const collection = await servedCollection(store, handle);
  if (!collection) notFound();

  // Accumulate the "Carregar mais" pages 1..N by paging the port in 20s, the model every PLP here follows.
  //
  // ★ THE STORE ASSORTMENT IS THE PORT'S JOB, and this is where it shows: `read.products` is store-scoped, so
  // a product in the collection that this store does not carry is simply not in the answer. A collection
  // belongs to the TENANT and a store serves the INTERSECTION (decision 8) — expressed as one parameter,
  // never as a filter this template applies afterwards.
  const filters = toQueryParams(state);
  const list = await accumulateList(
    (p, l, withFacets) =>
      readClient().products(store, {
        collection: handle,
        page: p,
        limit: l,
        facets: withFacets,
        filters,
      }),
    page,
  );
  const data = list ?? { items: [], page: 1, limit: 0, total: 0, facets: undefined };

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: data.items.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.title,
      url: canonicalProductPath(p),
    })),
  };

  const [chrome, ratings] = await Promise.all([cardChrome(store), cardRatings(store)]);

  return (
    <>
      <JsonLd data={itemList} />
      <ListTemplate
        title={collection.name}
        description={collection.description}
        base={base}
        crumbs={[{ label: 'Início', path: '/' }]}
        products={data.items}
        page={page}
        total={data.total}
        basePath={storeHref(base, collectionPath(handle))}
        facets={data.facets}
        state={state}
        swatchImages={buildSwatchImages(data.items)}
        renderCard={(p) => (
          <ProductCard
            product={p}
            base={base}
            freeShippingThreshold={chrome.freeShippingThreshold}
            maxInstallments={chrome.maxInstallments}
            rating={ratings[p.product_id]}
          />
        )}
        aboveShelf={<ExtensionOutlet name="list.above_shelf" store={store} storeBase={base} />}
        belowShelf={<ExtensionOutlet name="list.below_shelf" store={store} storeBase={base} />}
        footerBanner={<ExtensionOutlet name="list.footer_banner" store={store} storeBase={base} />}
      />
    </>
  );
}
