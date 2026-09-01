// The `storefront.product_structured_data` aggregator — what the PDP hands `productJsonLd` to enrich the
// Product graph with facts the catalog does not hold (today: an app's ratings and reviews).
//
// ⚠️ ONE CONTRIBUTOR SPEAKS, AND THAT IS A RULE RATHER THAN A SHORTCUT. `cardRatings` merges its contributions
// per key because a card's annotations are independent values. These are not: `aggregateRating` is an average
// OVER the set `review` lists, so taking the rating from one app and the reviews from another would publish a
// number computed over rows the page never shows — the exact defect this point was built to close, rebuilt
// inside the aggregator. So the LAST contributor with something to say answers, whole; the same "later entries
// win" direction `cardRatings` uses, applied to the fragment instead of to its keys.
//
// Everything degrades to `undefined` — no contributor on this instance's list, a contributor whose port is
// down, a product with no reviews — and the graph simply omits the fields, exactly as it did before the point
// existed.
import type { ProductStructuredData } from '@/lib/product-structured-data/contract';
import { composedProductStructuredData } from '@/lib/product-structured-data/generated/registry';

/**
 * The enrichment for one product, or `undefined` when nobody has anything to say.
 *
 * FULLY DEFENSIVE, PER CONTRIBUTOR: a contribution is somebody else's code, so one that throws costs its own
 * fragment and nothing else. The contract says a contributor must not throw for an ordinary absence (see it);
 * this catch is for the day one does anyway.
 */
export async function productStructuredData(
  store: string,
  productId: string,
): Promise<ProductStructuredData | undefined> {
  if (!store || !productId) return undefined;
  const contributed = await Promise.all(
    composedProductStructuredData.map(async ({ contribute }) => {
      try {
        return await contribute(store, productId);
      } catch {
        return null;
      }
    }),
  );
  const answered = contributed.filter((fragment): fragment is ProductStructuredData => !!fragment);
  return answered[answered.length - 1];
}
