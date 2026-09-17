// The clean-path catch-all — the DYNAMIC entry. ONE catch-all resolves, in order, CATALOG → CMS PAGE → 404;
// the ordered decision is the pure `resolveCatchAll` (lib/catch-all.ts) and the render is the shared
// <CatalogView> (templates/catalog/CatalogView.tsx), which the edge-cacheable twin (`c/[store]/[...catpath]`)
// mounts too. This file's only job is to turn `searchParams` into the view's inputs.
//
// FORCE-DYNAMIC, and it stays: this route is the one that READS the query — pagination (`?page=`) and the
// filter axes. Next's route cache is keyed by PATH, so a cached route would answer `?page=2` with page 1;
// reading searchParams is therefore incompatible with caching by construction, not by configuration.
// PERF-B routes the requests that DON'T carry a meaningful query to the twin instead (lib/edge-cache.ts), so
// the clean URL a crawler and most shoppers ask for is served from the edge and only the filtered/paginated
// tail reaches this file. Port reads stay ISR-cached on both sides.

import { requestStoreBase } from '@forgeco/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { parseFilterState } from '@/lib/filters/filter-url';
import { CatalogView, catalogMetadata } from '@/templates/catalog/CatalogView';

export const dynamic = 'force-dynamic';

type Params = { store: string; catpath: string[] };
type Search = { [key: string]: string | string[] | undefined };

function pageNum(search: Search): number {
  const raw = Array.isArray(search.page) ? search.page[0] : search.page;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, catpath } = await params;
  return catalogMetadata(store, catpath);
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { store, catpath } = await params;
  const search = await searchParams;
  return (
    <CatalogView
      store={store}
      base={await requestStoreBase(store)}
      catpath={catpath}
      page={pageNum(search)}
      state={parseFilterState(search)}
      // ★ QA16 USED TO PASS `?sku=` HERE, and it is gone rather than voided: the product branch of
      // `CatalogView` now renders THIS shop's page, whose buy box owns its own selection, so the parameter
      // had no reader left. `page` and the filters still belong to this entry for the original reason —
      // they change the rendered page, so only the tree that may read a query can answer them.
    />
  );
}
