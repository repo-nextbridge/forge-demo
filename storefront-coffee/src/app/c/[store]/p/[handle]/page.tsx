// PDP alias `/p/<handle>` — the EDGE-CACHEABLE entry. It exists for two reasons, and the second is the
// structural one: without a literal route here, `/p/<handle>` would fall into this tree's catch-all and be
// resolved as "category p / page p-handle" — a 404 where the alias used to work. A prefix routed into the
// cacheable tree must have a route in it (lib/edge-cache.ts says so next to the list).
//
// The behaviour is the dynamic entry's, unchanged: a categorized product 301s to its canonical category path
// (the handle is stable even if the category changes); an UNCATEGORIZED product has no category path, so
// `/p/<handle>` IS its canonical and it renders here; unknown/unpublished handle → 404.
//
// See `c/[store]/page.tsx` for why `revalidate` + `generateStaticParams` must both be here.

import { canonicalProductPath, primaryCategory } from '@forgecommerce/storefront-kit/catalog-path';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { storePermanentRedirect } from '@forgecommerce/storefront-kit/store-navigation';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pdpMetadata } from '@/templates/pdp/meta';
import { PdpCoffeeView } from '@/templates/pdp/PdpCoffeeView';

// 300s — the value of CATALOG_REVALIDATE_SECONDS (lib/edge-cache.ts), inlined because Next requires this
// export to be a statically analyzable literal. A guard asserts the two never drift.
export const revalidate = 300;

type Params = { store: string; handle: string };

export function generateStaticParams(): Params[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, handle } = await params;
  const product = await readClient().productByHandle(store, handle);
  if (!product) return {};
  return pdpMetadata(product);
}

export default async function CachedProductAliasPage({ params }: { params: Promise<Params> }) {
  const { store, handle } = await params;
  const product = await readClient().productByHandle(store, handle);
  if (!product) notFound();

  // Categorized → redirect to the canonical category-path URL. Uncategorized → render here.
  // MULTISTORE M1-β — the canonical 308 travels through the store-aware wrapper like every other navigation.
  // In THIS tree the base is HOST_BASE by construction, so the emitted URL is byte-identical to before; the
  // point is that the dynamic twin, where it is not, cannot express the move any other way.
  if (primaryCategory(product)) storePermanentRedirect(HOST_BASE, canonicalProductPath(product));
  // ★ THIS SHOP'S PRODUCT PAGE, in the host-shaped tree too — the dynamic twin
  // (`app/s/[store]/(storefront)/p/[handle]`) has always rendered it, and a shop whose product page depended
  // on WHICH of the two entries the shopper arrived through would be two shops.
  return <PdpCoffeeView store={store} base={HOST_BASE} product={product} />;
}
