// The search page (store-scoped). SSR of the result page: `/search?q=` renders on the server, so the
// result is linkable/shareable and the HTML carries the products. Filters/sort ride the URL (GET-first, no JS
// needed). A curated redirect from the port short-circuits to navigation. All search intelligence lives in the
// port; this is a view over read.search.
//
// FORCE-DYNAMIC (hotfix #120): the page reads `searchParams`, so it MUST be dynamic — a `revalidate`/ISR or a
// `generateStaticParams` triggers DYNAMIC_SERVER_USAGE (500) at request time. `dynamic = 'force-dynamic'` and
// NO revalidate / no generateStaticParams is the required shape for any searchParams-reading route.
//
// SEO: noindex,follow — internal search is the "search results in search results" anti-pattern (infinite
// low-value ?q= URLs dilute crawl budget / risk thin-content), so it leaves the index while product and
// category pages stay indexable. `follow` keeps the result links crawlable. See front-composition.md.

import { browsableCategories } from '@forgeco/storefront-kit/category-visibility';
import { readClient } from '@forgeco/storefront-kit/config';
import type { CatalogList } from '@forgeco/storefront-kit/read-client';
import { storeRedirect } from '@forgeco/storefront-kit/store-navigation';
import { requestStoreBase } from '@forgeco/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/ProductCard';
import { cardChrome } from '@/lib/cardChrome';
import { cardRatings } from '@/lib/cardRatings';
import { parseFilterState, toQueryParams } from '@/lib/filters/filter-url';
import { accumulateList, buildSwatchImages, PLP_PAGE_SIZE } from '@/lib/filters/plp';
import { SearchTemplate } from '@/templates/search/template';

export const dynamic = 'force-dynamic';

type Params = { store: string };
type Search = { [key: string]: string | string[] | undefined };

function queryOf(search: Search): string {
  const raw = Array.isArray(search.q) ? search.q[0] : search.q;
  return (raw ?? '').toString();
}

function pageNum(search: Search): number {
  const raw = Array.isArray(search.page) ? search.page[0] : search.page;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const q = queryOf(await searchParams).trim();
  return {
    title: q ? `Busca: ${q}` : 'Busca',
    robots: { index: false, follow: true },
    ...(q ? { alternates: { canonical: `/search?q=${encodeURIComponent(q)}` } } : {}),
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { store } = await params;
  const base = await requestStoreBase(store);
  const search = await searchParams;
  const q = queryOf(search);
  const page = pageNum(search);
  const trimmed = q.trim();
  const state = parseFilterState(search);

  const client = readClient();
  // Accumulate the "Carregar mais" pages 1..N by paging the port in 20s (accumulateList) so a big result set is
  // fully browsable (no 100 ceiling). With a term → textual search. WITHOUT a term → SEARCH-ALL: list the whole
  // catalog with the same filters + facets (client.products with no `category` = every product), so a facet-only
  // URL like `/search?cf.genero=Masculino` (the header's gender links) shows results + a working filter sidebar.
  const filters = toQueryParams(state);
  let list: CatalogList | null;
  if (trimmed) {
    // Textual search may return a curated {redirect} on page 1 (SEARCH-4) — fetch it first to peek, then
    // accumulate pages 2..N onto it. Only the textual search redirects; the search-all (products) never does.
    const first = await client.search(store, trimmed, {
      page: 1,
      limit: PLP_PAGE_SIZE,
      facets: true,
      filters,
    });
    const redirectTo = (first as { redirect?: string } | null)?.redirect;
    // MULTISTORE M1-β — a curated search redirect is navigation INSIDE the store: the port answers with the
    // storefront's own clean path, and the store context of the request is applied here.
    if (redirectTo) storeRedirect(base, redirectTo);
    list = await accumulateList(
      (p, l, withFacets) =>
        client.search(store, trimmed, { page: p, limit: l, facets: withFacets, filters }),
      page,
      first as CatalogList | null,
    );
  } else {
    list = await accumulateList(
      (p, l, withFacets) =>
        client.products(store, { page: p, limit: l, facets: withFacets, filters }),
      page,
    );
  }

  // Empty-state suggestions: only fetch when there is nothing to show (categories + newest). The suggestions
  // are LINKS, so they are filtered at this boundary (CAT-STATUS-GAP) — a dead-end search must not offer a
  // category the resolver 404s. Filtering here keeps SearchSuggestions purely presentational.
  const empty = trimmed !== '' && (list?.total ?? 0) === 0;
  const catmap = empty ? browsableCategories((await client.categories(store)) ?? {}) : {};
  const suggestions = empty
    ? ((await client.products(store, { sort: 'newest', limit: 8 }))?.items ?? [])
    : [];

  // The theme's ONE card WITH store chrome + batch ratings, injected into the PLP shelf (deduped by React.cache
  // per request — one shipping/payment read + one batch ratings read shared across every card).
  const [chrome, ratings] = await Promise.all([cardChrome(store), cardRatings(store)]);
  const products = list?.items ?? [];

  return (
    <SearchTemplate
      q={q}
      base={base}
      products={products}
      page={page}
      total={list?.total ?? 0}
      facets={list?.facets}
      state={state}
      catmap={catmap}
      suggestions={suggestions}
      swatchImages={buildSwatchImages(products)}
      renderCard={(p) => (
        <ProductCard
          product={p}
          base={base}
          freeShippingThreshold={chrome.freeShippingThreshold}
          maxInstallments={chrome.maxInstallments}
          rating={ratings[p.product_id]}
        />
      )}
    />
  );
}
