// The collection landing — the EDGE-CACHEABLE entry (the render is shared: templates/collection/CollectionView).
//
// It renders CLEAN_VIEW — page 1, no filters — and that is not a simplification: Next's route cache is keyed by
// PATH, so this HTML answers every query string the URL might carry. Anything that must vary by query
// (`?page=2`, a filter) is routed to the dynamic twin instead (lib/edge-cache.ts).
//
// `revalidate` + `generateStaticParams` must BOTH be here: a route with a dynamic segment is cacheable only
// with the second one (LAW 1 of edge-cache.guard.test.ts — `revalidate` alone leaves Next serving it fully
// dynamically with `private, no-store`, whatever the export says). The list is empty on purpose: nothing is
// prerendered at build time, the entries are filled on first request and then cached.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { Metadata } from 'next';
import {
  CLEAN_VIEW,
  CollectionView,
  collectionMetadata,
} from '@/templates/collection/CollectionView';

// 300s — the value of CATALOG_REVALIDATE_SECONDS (lib/edge-cache.ts), inlined because Next requires this
// export to be a statically analyzable literal. A guard asserts the two never drift.
export const revalidate = 300;

type Params = { store: string; handle: string };

export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, handle } = await params;
  return collectionMetadata(store, handle);
}

export default async function CachedCollectionPage({ params }: { params: Promise<Params> }) {
  const { store, handle } = await params;
  return (
    <CollectionView
      store={store}
      base={HOST_BASE}
      handle={handle}
      page={CLEAN_VIEW.page}
      state={CLEAN_VIEW.state}
    />
  );
}
