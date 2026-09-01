// The clean-path catch-all — the EDGE-CACHEABLE entry (the render is shared: templates/catalog/CatalogView).
// It serves the PDP at its canonical path, the category list, and the institutional CMS page, for requests
// the middleware judged cache-safe: no meaningful query string, no gate on the store.
//
// It renders CLEAN_VIEW — page 1, no filters — and that is not a simplification, it is the only honest thing
// a cached route can render: Next's route cache is keyed by PATH, so this HTML answers every query string
// the URL might carry. Anything that must vary by query (`?page=2`, a filter, `?q=`) is routed to the dynamic
// entry instead (lib/edge-cache.ts).
//
// See `c/[store]/page.tsx` for why `revalidate` + `generateStaticParams` must both be here.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { Metadata } from 'next';
import { CatalogView, CLEAN_VIEW, catalogMetadata } from '@/templates/catalog/CatalogView';

// 300s — the value of CATALOG_REVALIDATE_SECONDS (lib/edge-cache.ts), inlined because Next requires this
// export to be a statically analyzable literal. A guard asserts the two never drift.
export const revalidate = 300;

type Params = { store: string; catpath: string[] };

export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, catpath } = await params;
  return catalogMetadata(store, catpath);
}

export default async function CachedCatalogPage({ params }: { params: Promise<Params> }) {
  const { store, catpath } = await params;
  return (
    <CatalogView
      store={store}
      base={HOST_BASE}
      catpath={catpath}
      page={CLEAN_VIEW.page}
      state={CLEAN_VIEW.state}
    />
  );
}
