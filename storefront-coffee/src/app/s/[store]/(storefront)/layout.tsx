// The (storefront) route group's layout — the DEFAULT chrome for home / PLP / PDP / search, on the DYNAMIC
// tree (the one that may read cookies/searchParams: a filtered PLP, the search page, a gated store).
//
// The chrome itself lives in <StorefrontChrome> (components/StorefrontChrome.tsx) because PERF-B gave it a
// second host — `c/[store]/layout.tsx`, the edge-cacheable twin. One implementation, two layout files: Next
// fixes cacheability per route file, so the split is structural, and a guard asserts neither side grows its
// own chrome. Route groups don't change the URL — these pages still resolve at `/s/<store>/...`.

import { requestStoreBase } from '@forgecommerce/storefront-kit/store-route.server';
import type { ReactNode } from 'react';
import { StorefrontChrome } from '@/components/StorefrontChrome';

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  // MULTISTORE M1-β — the one request fact the chrome needs. Free here: every page in this group is
  // `force-dynamic` (the cacheable twin is `c/[store]`, which never asks).
  const base = await requestStoreBase(store);
  return (
    <StorefrontChrome store={store} base={base}>
      {children}
    </StorefrontChrome>
  );
}
