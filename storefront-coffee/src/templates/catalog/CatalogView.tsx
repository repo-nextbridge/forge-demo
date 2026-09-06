// The catch-all's RENDER, lifted out of its route file (PERF-B) so the same implementation serves both trees:
// `s/[store]/(storefront)/[...catpath]` (dynamic — it reads `searchParams`: pagination and filters) and
// `c/[store]/[...catpath]` (edge-cacheable — it reads nothing per-visitor and therefore renders page 1
// unfiltered, which is what a clean URL and a crawler ask for). Next fixes cacheability per ROUTE FILE, so
// the two entries must be two files; they must never be two implementations, and a guard asserts both import
// from here.
//
// The ordered decision it renders is unchanged (lib/catch-all.ts, unit-tested): CATALOG → CMS PAGE → 404.
//   - a PRODUCT at its canonical category path `/<cat>/<handle>`, 301-correcting any non-canonical path;
//   - a category LIST (`/<cat>`); an institutional PAGE (`/<slug>`); or notFound().
//
// Nothing here may touch a dynamic API (cookies/headers): on the cacheable entry that is a runtime 500, not
// a degrade. The absolute URLs of the breadcrumb graph therefore come from the store's declared origin, not
// from the request Host — see lib/seo/store-origin.ts.

import { canonicalProductPath, crumbsForPath } from '@forgecommerce/storefront-kit/catalog-path';
import { readClient } from '@forgecommerce/storefront-kit/config';
import { productImageUrls } from '@forgecommerce/storefront-kit/media/seo';
import { storePermanentRedirect } from '@forgecommerce/storefront-kit/store-navigation';
import { type StoreBase, storeHref } from '@forgecommerce/storefront-kit/store-route';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/JsonLd';
import { ProductCard } from '@/components/ProductCard';
import { cardChrome } from '@/lib/cardChrome';
import { cardRatings } from '@/lib/cardRatings';
import { resolveCatchAll } from '@/lib/catch-all';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { type FilterState, parseFilterState, toQueryParams } from '@/lib/filters/filter-url';
import { accumLimit, buildSwatchImages } from '@/lib/filters/plp';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumb';
import { storeOrigin } from '@/lib/seo/store-origin';
import { pageMetadata } from '@/templates/cms/meta';
import { PageView } from '@/templates/cms/PageView';
import { ListTemplate } from '@/templates/list/template';
import { pdpMetadata } from '@/templates/pdp/meta';
import { PdpCoffeeView } from '@/templates/pdp/PdpCoffeeView';

// S7-SF-PLP — metadata resolves at "page 1" (accumLimit(1) = 20). The RENDER path accumulates: page N fetches
// accumLimit(N) items so the shelf shows pages 1..N at once (the "Carregar mais" model, lib/filters/plp.ts).
const META_LIMIT = accumLimit(1);

/** What the cacheable entry renders: the clean URL — page 1, no filters. Built through the same parser the
 * dynamic entry uses on `searchParams`, so "no filters" has one definition and cannot drift. */
export const CLEAN_VIEW: { page: number; state: FilterState } = {
  page: 1,
  state: parseFilterState({}),
};

export async function catalogMetadata(store: string, catpath: string[]): Promise<Metadata> {
  // Metadata does not depend on the list page — resolve at page 1 (reads are ISR-cached, shared with render).
  const r = await resolveCatchAll(readClient(), store, catpath, { page: 1, limit: META_LIMIT });
  switch (r.kind) {
    case 'product':
      return pdpMetadata(r.product);
    case 'page':
      return pageMetadata(r.page);
    case 'category': {
      const name =
        Object.values(r.catmap).find((c) => c.path === r.categoryPath)?.name ?? catpath.join(' / ');
      // RICH (S2): the category's SEO meta override the name/none defaults; absent → the current fallback.
      const rich = await readClient().categoryByPath(store, r.categoryPath);
      const title = rich?.meta_title ?? name;
      const description = rich?.meta_description ?? undefined;
      // S6-IMAGES — og:image = the category BANNER, falling back to the cover of the first product listed
      // (the page's own first image). Absolute urls, resolved by the kernel.
      const image = rich?.banner?.url ?? productImageUrls(r.list.items[0])[0];
      return {
        title,
        description,
        alternates: { canonical: `/${catpath.join('/')}` },
        openGraph: {
          title,
          ...(description ? { description } : {}),
          type: 'website',
          ...(image ? { images: [image] } : {}),
        },
      };
    }
    default:
      return {};
  }
}

export async function CatalogView({
  store,
  base,
  catpath,
  page,
  state,
}: {
  store: string;
  /** MULTISTORE M1-β — the store prefix of the current request. The two entries answer it differently and that
   * is the whole mechanism: the cacheable one passes HOST_BASE (its precondition), the dynamic one reads it. */
  base: StoreBase;
  catpath: string[];
  page: number;
  state: FilterState;
}) {
  // Accumulate: fetch pages 1..N as one page-1 slice of accumLimit(N) items (the "Carregar mais" model).
  const r = await resolveCatchAll(readClient(), store, catpath, {
    page: 1,
    limit: accumLimit(page),
    facets: true,
    filters: toQueryParams(state),
  });

  if (r.kind === 'product') {
    // Enforce the canonical category-path URL: any other path 301s to it (structural SEO).
    const canonical = canonicalProductPath(r.product);
    const current = `/${catpath.join('/')}`;
    if (current !== canonical) storePermanentRedirect(base, canonical);
    // ★★ THIS SHOP'S PRODUCT PAGE ANSWERS HERE TOO, AND THAT IS THE WHOLE POINT OF THE ARM.
    //
    // `p/[handle]` renders `PdpCoffeeView` and 308s to this canonical path whenever the product HAS a primary
    // category — so this branch is the one a shopper actually reaches. Every product in this shop is
    // categorised, which made the split "uncategorised → this shop's page, categorised → the reference page"
    // into "nobody ever sees this shop's page": `PdpCoffee`, `CoffeeBuyBox` and the whole `coffee.module.css`
    // shipped inside the image and drew nothing. Measured on the bench (2026-09-02): all six coffees, 308 to
    // the category path, ZERO `coffee_` classes in the HTML — the reference PDP wearing the theme's colours,
    // which is exactly what the fork exists not to be.
    //
    // ⚠️ THERE IS NO `sku` PROP ANY MORE, and its removal is part of the fix rather than tidying alongside
    // it. The reason `p/[handle]` already states: this shop's buy box opens on the merchant's starred SKU
    // and has no swatch grid and no PLP behind it, so nothing here mints a URL naming a SKU. A prop that
    // the only branch able to read it ignores is a wire that lies — and the next reader would have to
    // measure the page to find out. The cost is named in `sku-param-thread.test.tsx`.
    return <PdpCoffeeView store={store} base={base} product={r.product} />;
  }

  if (r.kind === 'page') {
    return <PageView page={r.page} base={base} store={store} />;
  }

  if (r.kind === 'category') {
    const { list, categoryPath, catmap } = r;
    const title =
      Object.values(catmap).find((c) => c.path === categoryPath)?.name ?? catpath.join(' / ');
    // ALREADY store-scoped: the filter/sort/"Carregar mais" links are all derived from this one path, so
    // scoping it once scopes every one of them.
    const basePath = storeHref(base, `/${catpath.join('/')}`);
    const crumbs = crumbsForPath(categoryPath, catmap).slice(0, -1); // last is the current page
    // RICH (S2): the category's rich content (banner + description). Null (no content / pre-RICH) → the header
    // renders bare, so the current PLP is a zero-regression pass.
    const category = await readClient().categoryByPath(store, categoryPath);

    // The shelf shows the accumulated set 1..N, so positions are just 1-based over list.items.
    const itemList = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: list.items.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.title,
        url: canonicalProductPath(p),
      })),
    };

    // SEO-FINISH — the BreadcrumbList for this category. Note it uses the FULL trail, not the `crumbs` above:
    // the visual breadcrumb drops the last element because the template renders the current page as its own
    // heading, but the structured trail must END on the current page (Google's rich-results doc — their example
    // ends on the page itself, and `item` on that last element is permitted). Absolute URLs from the STORE's
    // declared origin (PERF-B — this HTML is cached and shared across the store's hosts).
    const req = storeOrigin(store);
    const breadcrumb = req
      ? breadcrumbJsonLd(req.origin, crumbsForPath(categoryPath, catmap))
      : null;

    // The theme's ONE card, WITH store chrome + batch ratings read once per request (deduped by React.cache),
    // injected into the PLP shelf — the same "Frete grátis" tag + "ou Nx" line + rating stars the home shelves carry.
    const [chrome, ratings] = await Promise.all([cardChrome(store), cardRatings(store)]);

    return (
      <>
        <JsonLd data={itemList} />
        {breadcrumb ? <JsonLd data={breadcrumb} /> : null}
        <ListTemplate
          title={title}
          base={base}
          crumbs={crumbs}
          products={list.items}
          page={page}
          total={list.total}
          basePath={basePath}
          facets={list.facets}
          state={state}
          category={category}
          swatchImages={buildSwatchImages(list.items)}
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
          footerBanner={
            <ExtensionOutlet name="list.footer_banner" store={store} storeBase={base} />
          }
        />
      </>
    );
  }

  notFound();
}
