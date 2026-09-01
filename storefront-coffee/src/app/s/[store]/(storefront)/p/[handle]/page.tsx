// PDP alias `/p/<handle>` (store-scoped via middleware). The canonical product URL is the primary-category
// path; this short, category-independent alias 301-redirects there (handle is stable even if the category
// changes). An UNCATEGORIZED product has no category path, so it renders here and `/p/<handle>` IS its
// canonical. Unknown/unpublished handle → 404.
//
// 301 hook for handle CHANGES (old slug -> new) is a separate redirect that needs a redirect source (a
// write command) which does not exist yet — documented seam; until then an unknown handle is a clean 404.
//
// DYNAMIC, not ISR: even the 301-to-canonical path reads the product (readClient) to compute its category
// path, and that read resolves the store from the request host — headers() on a statically-built page is
// Next's "static to dynamic" 500. force-dynamic builds it dynamic, so both the redirect and the uncategorized
// render happen per request.

import { canonicalProductPath, primaryCategory } from '@forgecommerce/storefront-kit/catalog-path';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { skuParamFromSearch } from '@forgecommerce/storefront-kit/sku-url';
import { storePermanentRedirect } from '@forgecommerce/storefront-kit/store-navigation';
import { requestStoreBase } from '@forgecommerce/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pdpMetadata } from '@/templates/pdp/meta';
import { PdpCoffeeView } from '@/templates/pdp/PdpCoffeeView';

// No generateStaticParams: its mere presence marks the route SSG (● in the build), which force-dynamic does
// NOT override — and an SSG page that calls headers() at request time is the "static to dynamic" 500. Dropping
// it lets force-dynamic make the route truly dynamic (ƒ).
export const dynamic = 'force-dynamic';

type Params = { store: string; handle: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, handle } = await params;
  const product = await readClient().productByHandle(store, handle);
  if (!product) return {};
  return pdpMetadata(product);
}

export default async function ProductAliasPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { store, handle } = await params;
  const product = await readClient().productByHandle(store, handle);
  if (!product) notFound();

  // Categorized → redirect to the canonical category-path URL. Uncategorized → render here.
  //
  // MULTISTORE M1-β — this is achado MT3-A1: the 308 was `permanentRedirect(canonicalProductPath(product))`,
  // a bare clean path, so under `/s/<store>` it dropped the store. The consequence was not cosmetic — a
  // product exclusive to one store 404'd through its own canonical URL, and a product carried by two stores
  // silently switched store on the way to its PDP.
  const base = await requestStoreBase(store);
  if (primaryCategory(product)) storePermanentRedirect(base, canonicalProductPath(product));
  // ★ QA16 — an UNCATEGORIZED product has no canonical category path, so this file IS its PDP: the `?sku=`
  // deep link has to be honoured here too, or exactly those products stay unbuyable without JS.
  // ★ THIS SHOP'S OWN PRODUCT PAGE. The `?sku=` deep link the reference PDP honours is not read here: this
  // page's buy box opens on the merchant's starred SKU (or the first of each axis) and the shopper picks
  // from there. A link that names a SKU is a link a shop with a PLP and a swatch grid mints; this shop has
  // neither, and honouring a parameter nothing produces would be a promise with no source.
  void searchParams;
  return <PdpCoffeeView store={store} base={base} product={product} />;
}
