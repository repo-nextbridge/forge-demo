// THE THEME SEAM the generated block registry pulls from (A1 · ONDA 3).
//
// A block that SHOWS PRODUCTS does not draw the card: the theme does, and hands it in (`renderCard`,
// `renderBundle`). That inversion is what keeps the app free of a `@forge/storefront` import — the app owns
// the pairs, the order and the query; the storefront owns how a product looks. It used to live inside the
// hand-written registry, one bespoke closure per block. It lives here because the registry is GENERATED now,
// and a generator cannot write a closure that reaches into the theme.
//
// ★ THE APP DECLARES WHAT IT WANTS, NEVER WHERE IT COMES FROM. A block names its injections in its own
// package.json (`forge.wiring.blocks.<id>.inject: ["renderCard"]`); the generated registry turns each name
// into `inject<PascalCase(name)>(props)` and calls it. So an app asking for something no surface provides is a
// COMPILE error in the generated file, naming the missing injection — not a block that renders wrong at 3am.
//
// ⚠️ The product types below are STRUCTURAL COPIES of what the blocks declare, deliberately not imported from
// them: this module must not know an app's name (the composition guard forbids it), and an injection that
// imported one app's type would silently become that app's injection. If a block's shape ever drifts from
// these, the generated registry stops compiling at the call site — which is the whole point of generating it.

import { mediaOptimized } from '@forgeco/storefront-kit/media/src';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import type { StoreBase } from '@forgeco/storefront-kit/store-route';
import type { ReactNode } from 'react';
import { BundlePairQuoted } from '@/components/BundlePairQuoted';
import { ProductCard } from '@/components/ProductCard';
import { cardChrome } from '@/lib/cardChrome';
import { cardRatings } from '@/lib/cardRatings';

/** What a block hands back for the theme to render as a card. Structural: `product_id` plus whatever the read
 * port returned — the card resolves the rest itself. */
export type InjectableProduct = { product_id: string; [key: string]: unknown };
/** The bundle's half: a product WITH its skus, because the "add both" needs something to add. */
export type InjectableBundleProduct = InjectableProduct & { skus: { id: string }[] };

/** The subset of the block props an injection may read. Kept explicit so an injection cannot quietly start
 * depending on a prop only some slots set. */
type InjectionContext = {
  store: string;
  storeBase: StoreBase;
  addToCart?: (skuIds: string[]) => Promise<void>;
};

/**
 * The theme's product card. Reads the store-level card chrome + the batch ratings ONCE (both deduped by
 * React.cache) and threads them into every card, so the card stays a sync component while its "Frete grátis"
 * tag, installment line and rating stars all come from real data. Ratings are keyed by product_id (absent → no
 * stars), and the card links inside the store the shopper is browsing (`storeBase`), never the one the Host
 * happens to resolve.
 */
export async function injectRenderCard(
  props: InjectionContext,
): Promise<(product: InjectableProduct) => ReactNode> {
  const [chrome, ratings] = await Promise.all([cardChrome(props.store), cardRatings(props.store)]);
  return (p) => (
    <ProductCard
      product={p as ProductDoc}
      base={props.storeBase}
      freeShippingThreshold={chrome.freeShippingThreshold}
      maxInstallments={chrome.maxInstallments}
      rating={ratings[p.product_id]}
    />
  );
}

/**
 * The theme's compact BUNDLE — the two products, the variant squares, the summed price and the "add both"
 * that opens the minicart. The app owns the curated pair; the buying UI is the theme's.
 *
 * PROMO — the quote is asked ON THE SERVER by BundlePairQuoted (an async node this sync seam may return), so
 * the first paint is already right and travels inside the cached HTML.
 */
export async function injectRenderBundle(
  props: InjectionContext,
): Promise<(base: InjectableBundleProduct, paired: InjectableBundleProduct) => ReactNode> {
  const chrome = await cardChrome(props.store);
  return (base, paired) => (
    <BundlePairQuoted
      store={props.store}
      base={base as unknown as ProductDoc}
      paired={paired as unknown as ProductDoc}
      optimized={mediaOptimized()}
      maxInstallments={chrome.maxInstallments}
      addToCart={props.addToCart}
    />
  );
}
