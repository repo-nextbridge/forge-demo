// The brand PLP (S5-BRAND) — a dedicated `/b/<slug>` route (a literal segment Next matches before the
// catch-all, so a brand slug can never be shadowed by a CMS page, and vice-versa: the kernel reserves 'b').
// Lists the products of one brand with the same facet sidebar as a category PLP. The route slug pins the brand
// (the read is always filtered to it); other axes (option/cf/price/sort) ride the URL like everywhere else.
//
// Dynamic: reads searchParams (pagination/filters). Port reads stay ISR-cached. Unknown/archived slug → 404.

import { canonicalProductPath } from '@forgecommerce/storefront-kit/catalog-path';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { storeHref } from '@forgecommerce/storefront-kit/store-route';
import { requestStoreBase } from '@forgecommerce/storefront-kit/store-route.server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { cardChrome } from '@/lib/cardChrome';
import { cardRatings } from '@/lib/cardRatings';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { parseFilterState, toQueryParams } from '@/lib/filters/filter-url';
import { accumulateList, buildSwatchImages } from '@/lib/filters/plp';
import { ListTemplate } from '@/templates/list/template';

export const dynamic = 'force-dynamic';

type Params = { store: string; slug: string };
type Search = { [key: string]: string | string[] | undefined };

function pageNum(search: Search): number {
  const raw = Array.isArray(search.page) ? search.page[0] : search.page;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Resolve an ACTIVE brand by slug from the store's brand map, or null (unknown/archived). `logo_url` is the
 * logo's absolute address, resolved by the READ PORT (S6-IMAGES) — the theme never joins a media ref itself. */
async function activeBrand(
  store: string,
  slug: string,
): Promise<{ name: string; slug: string; logo_url?: string } | null> {
  const map = await readClient().brands(store);
  const brand = map ? Object.values(map).find((b) => b.slug === slug) : undefined;
  if (brand?.status !== 'active') return null;
  return {
    name: brand.name,
    slug: brand.slug,
    ...(brand.logo_url ? { logo_url: brand.logo_url } : {}),
  };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { store, slug } = await params;
  const brand = await activeBrand(store, slug);
  if (!brand) return {};
  const description = `Produtos da marca ${brand.name}.`;
  return {
    title: brand.name,
    description,
    alternates: { canonical: `/b/${slug}` },
    // S6-IMAGES — og:image = the brand LOGO (absolute, from the port). No logo → no image, never a broken one.
    openGraph: {
      title: brand.name,
      description,
      type: 'website',
      ...(brand.logo_url ? { images: [brand.logo_url] } : {}),
    },
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { store, slug } = await params;
  const search = await searchParams;
  const brand = await activeBrand(store, slug);
  if (!brand) notFound();

  const page = pageNum(search);
  const rawState = parseFilterState(search);
  // The route pins the brand; drop any query `brand` so the slug is the single source, and reflect it in the
  // state so the sidebar/chips highlight it.
  const state = { ...rawState, brand: slug };
  // Accumulate the "Carregar mais" pages 1..N by paging the port in 20s (accumulateList) so a big brand is fully
  // browsable (no 100 ceiling).
  const brandFilters = toQueryParams({ ...rawState, brand: undefined });
  const list = await accumulateList(
    (p, l, withFacets) =>
      readClient().products(store, {
        brand: slug,
        page: p,
        limit: l,
        facets: withFacets,
        filters: brandFilters,
      }),
    page,
  );
  const data = list ?? { items: [], page: 1, limit: 0, total: 0, facets: undefined };

  // The shelf shows the accumulated set 1..N, so positions are just 1-based over data.items.
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
  const base = await requestStoreBase(store);

  return (
    <>
      <JsonLd data={itemList} />
      <ListTemplate
        title={brand.name}
        base={base}
        // PRE-S7-STOREFRONT-DEBT — the logo was resolved and then dropped: it fed the og:image and nothing else.
        // Now the page draws it too (a brand with no logo renders exactly as it did before).
        brand={brand}
        crumbs={[{ label: 'Início', path: '/' }]}
        products={data.items}
        page={page}
        total={data.total}
        // ALREADY store-scoped: every filter, sort and "Carregar mais" link is derived from this one path.
        basePath={storeHref(base, `/b/${slug}`)}
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
