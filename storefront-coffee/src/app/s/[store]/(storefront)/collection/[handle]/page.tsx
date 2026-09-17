// The collection landing — the DYNAMIC entry. Its only job is to turn `searchParams` into the shared view's
// inputs; the render is templates/collection/CollectionView, which the cacheable twin mounts too.
//
// FORCE-DYNAMIC, and it stays: this route is the one that READS the query — pagination (`?page=`) and the
// filter axes. Next's route cache is keyed by PATH, so a cached route would answer `?page=2` with page 1;
// reading searchParams is therefore incompatible with caching by construction, not by configuration. PERF-B
// routes the requests that DON'T carry a meaningful query to the twin, so the clean URL a crawler and most
// shoppers ask for is served from the edge and only the filtered/paginated tail reaches this file.

import { requestStoreBase } from '@forgeco/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { parseFilterState } from '@/lib/filters/filter-url';
import { CollectionView, collectionMetadata } from '@/templates/collection/CollectionView';

export const dynamic = 'force-dynamic';

type Params = { store: string; handle: string };
type Search = { [key: string]: string | string[] | undefined };

function pageNum(search: Search): number {
  const raw = Array.isArray(search.page) ? search.page[0] : search.page;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, handle } = await params;
  return collectionMetadata(store, handle);
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { store, handle } = await params;
  const search = await searchParams;
  return (
    <CollectionView
      store={store}
      base={await requestStoreBase(store)}
      handle={handle}
      page={pageNum(search)}
      state={parseFilterState(search)}
    />
  );
}
