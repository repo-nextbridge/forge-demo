// THE CARD ANNOTATIONS a ProductCard needs and the product doc does NOT carry — today, the store's per-product
// rating summaries. This is the many-cards sibling of the PDP block: a `React.cache()` memo keyed by store, so a
// page with several shelves + a PLP grid does ONE batch read shared across every card instead of a fetch per
// card (no N+1). The card gets its stars from `ratings[product_id]`; a product with no reviews is ABSENT from
// the map, so its card shows no stars.
//
// ★ F2 — IT NO LONGER IMPORTS THE APP, AND THAT IS THE WHOLE SLICE. This file used to say
// `import { fetchRatingSummaries, type RatingSummary } from '@forgecommerce/ext-reviews/ratings'` — the last
// LIBRARY weld in the tree, and the reason `reviews` could not be taken out of the product: the call and the
// type both left with the app. Now the storefront declares the extension POINT and the shape it accepts
// (`./card-annotations/contract`), the app implements it structurally and DECLARES that it does (its own
// package.json, `forge.wiring.contributions`), and `pnpm codegen` writes the registry this aggregates. Nothing
// here knows an app's name.
//
// Everything degrades to an empty map — no contributor on this instance's list, a contributor whose port is
// down, a store with no reviews — and the cards simply omit the stars, exactly as before this wiring existed.
import { cache } from 'react';
import type { CardAnnotations } from '@/lib/card-annotations/contract';
import { composedCardAnnotations } from '@/lib/card-annotations/generated/registry';

/** product_id -> its annotation (average + count). A product absent from the map has no reviews. */
export type CardRatings = CardAnnotations;

/**
 * The store's card annotations — memoized per request (deduped across every card on the page). One batch read
 * per contributor, never per card.
 *
 * FULLY DEFENSIVE, PER CONTRIBUTOR: a contribution is somebody else's code, so one that throws costs its own
 * annotations and nothing else — the other contributors' still arrive. The contract says a contributor must
 * not throw for an ordinary absence (see it); this catch is for the day one does anyway.
 *
 * Later entries win on a key collision, which is the only rule that can be stated while the annotation is a
 * single value. The day `CardAnnotation` becomes a record of fields, this merge becomes a per-field one and
 * every contribution has to recompile against the wider shape — the contract says so where it is declared.
 */
export const cardRatings = cache(async (store: string): Promise<CardRatings> => {
  if (!store) return {};
  const contributed = await Promise.all(
    composedCardAnnotations.map(async ({ contribute }) => {
      try {
        return await contribute(store);
      } catch {
        return {};
      }
    }),
  );
  return Object.assign({}, ...contributed) as CardRatings;
});
