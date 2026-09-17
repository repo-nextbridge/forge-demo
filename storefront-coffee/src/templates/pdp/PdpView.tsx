// PdpView — the shared async render for a resolved product (used by the canonical category-path route and
// the /p/<handle> alias, on BOTH trees: the dynamic one and the edge-cacheable twin). Fetches the category
// map (for breadcrumb names), composes the PDP template, and emits the Product JSON-LD. No DB: it only calls
// the read port via the client.
//
// PERF-B — IT READS NO COOKIE AND NO HEADER, deliberately. This view is the body of the most cached page in
// the store, and on a cacheable route a dynamic API is not a degrade but a runtime 500. The two it used to
// call are gone: the persisted CEP is now fetched by the CepBox itself after hydration (a Server Action,
// like the minicart's seed), and the breadcrumb's absolute origin comes from configuration for the store
// (storeOrigin) instead of the request Host — one cached HTML is served to every host that resolves here.

import {
  canonicalProductPath,
  crumbsForPath,
  primaryCategory,
} from '@forgeco/storefront-kit/catalog-path';
import { readClient } from '@forgeco/storefront-kit/config';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { SKU_PARAM } from '@forgeco/storefront-kit/sku-url';
import type { StoreBase } from '@forgeco/storefront-kit/store-route';
import { IdentityPriceOverlay } from '@/components/IdentityPriceOverlay';
import { JsonLd } from '@/components/JsonLd';
import { cardChrome } from '@/lib/cardChrome';
import { addManyToCartAction } from '@/lib/cart-actions';
import { ExtensionOutlet } from '@/lib/extensions/ExtensionOutlet';
import { productStructuredData } from '@/lib/productStructuredData';
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumb';
import { storeOrigin } from '@/lib/seo/store-origin';
import { productJsonLd } from './meta';
import { PdpTemplate } from './template';

export async function PdpView({
  store,
  base,
  product,
  sku,
}: {
  store: string;
  base: StoreBase;
  product: ProductDoc;
  /** ★ QA16 — the `?sku=` of the request, handed straight to the template so the served HTML is the named
   * variant. Only the DYNAMIC entries pass it: this view is also the body of the edge-cached twin, and a
   * cached route cannot read a query (lib/edge-cache.ts) — so there `sku` is simply absent and the default
   * variant renders, exactly as before. */
  sku?: string;
}) {
  const primary = primaryCategory(product);
  const catmap = primary ? ((await readClient().categories(store)) ?? {}) : {};
  const crumbs = primary ? crumbsForPath(primary.path, catmap) : [];

  // Store chrome (the buybox's "Frete grátis" tag + "ou Nx" line) — the SAME React.cache memo the cards use, so
  // it is one shipping_summary + one payment_methods read per request, deduped across every card on the page.
  const chrome = await cardChrome(store);

  // A store-bound "add these SKUs to the cart" action, handed to the PDP's extension blocks (e.g. the
  // recommendations "bundle") so they drive the real forge_cart flow. bind → a serializable Server Action.
  const addToCart = addManyToCartAction.bind(null, store);
  // ★ SUB-S2 — THE VARIANT THIS HTML IS ABOUT, handed to the blocks through the query prop that already exists
  // for exactly this ("a block is not a page, so it has no searchParams of its own"). A block that adds to the
  // cart has to know WHICH sku, and `?sku=` is the page's own answer — the same value the buybox rendered.
  // ⚠️ Absent on the edge-cached twin, which cannot read a query at all: there `sku` is undefined and a block
  // falls back to the product's default variant, exactly as the buybox does.
  const slotSku = sku ? { [SKU_PARAM]: sku } : undefined;

  // ★ O3-D — the schema.org enrichment for the Product graph: the rating and the reviews, from the app that
  // holds them, through `storefront.product_structured_data`. It replaces a read of `cardRatings` — the app's
  // whole-store CARD batch — which was a second count of what the reviews section on this very page already
  // shows, from a second port read under a second cache entry. The contributor answers from the SAME
  // per-request read its block renders, so the page has one aggregate and the crawler is told that one.
  // No contributing app / port down / a product with no reviews → `undefined`, and the graph omits both
  // fields exactly as before.
  const enrichment = await productStructuredData(store, product.product_id);

  // SEO-FINISH — the BreadcrumbList the JsonLd header has promised since it was written. The trail is the
  // primary category's (the same one the canonical URL is built from), with the product itself as the last
  // item — per Google's rich-results doc. Uncategorized product → no trail → no graph (null), never an empty
  // BreadcrumbList. Absolute URLs come from the STORE's declared origin (PERF-B: this HTML is cached and
  // shared across every host that resolves to the store, so the request's own Host must not be baked in);
  // an instance that declared none simply emits no breadcrumb graph, never a wrong domain.
  const req = storeOrigin(store);
  const breadcrumb = req
    ? breadcrumbJsonLd(req.origin, [
        ...crumbs,
        { label: product.title, path: canonicalProductPath(product) },
      ])
    : null;

  return (
    <>
      <JsonLd data={productJsonLd(product, enrichment)} />
      {breadcrumb ? <JsonLd data={breadcrumb} /> : null}
      {/* CUST-CLUSTER wave 4 — renders nothing; fills the price anchors for a signed-in shopper. */}
      <IdentityPriceOverlay />
      <PdpTemplate
        product={product}
        crumbs={crumbs}
        store={store}
        base={base}
        freeShippingThreshold={chrome.freeShippingThreshold}
        maxInstallments={chrome.maxInstallments}
        initialSku={sku}
        // Neither `initialCep` nor `availability`: both are per-moment values that the buybox now asks for
        // itself after hydration (the cart's CEP through a Server Action, the stock through /api/availability).
        // The props survive on the template for hosts that already hold them — the preview gallery's fixtures.
        // Body slots, in render order after the hero: reviews (below_gallery) → cross-sell "compre junto"
        // (below_buybox) → "related" shelf (below_cross_sell). The description tabs render after all three.
        belowGallery={
          <ExtensionOutlet
            name="pdp.below_gallery"
            store={store}
            storeBase={base}
            productId={product.product_id}
            handle={product.handle}
            addToCart={addToCart}
            query={slotSku}
          />
        }
        belowBuybox={
          <ExtensionOutlet
            name="pdp.below_buybox"
            store={store}
            storeBase={base}
            productId={product.product_id}
            handle={product.handle}
            addToCart={addToCart}
            query={slotSku}
          />
        }
        belowCrossSell={
          <ExtensionOutlet
            name="pdp.below_cross_sell"
            store={store}
            storeBase={base}
            productId={product.product_id}
            handle={product.handle}
            addToCart={addToCart}
            query={slotSku}
          />
        }
      />
    </>
  );
}
