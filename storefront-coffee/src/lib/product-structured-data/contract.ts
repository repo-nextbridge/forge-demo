// THE EXTENSION POINT `storefront.product_structured_data` — DECLARED BY THE CONSUMER (O3-D).
//
// The second consumer-declared point, and the same inversion `../card-annotations/contract` states: the SHAPE
// belongs to the point, the app implements it structurally and imports nothing from here, and the GENERATED
// registry next door is where a mismatch becomes a `tsc` error inside the storefront naming both the app's
// module and this contract.
//
// ★ WHAT IT IS FOR. `JsonLd.tsx` has said since it was written that "the structure emits the base graph
// (Product / ItemList / BreadcrumbList); content enrichment is the green zone (apps)" — and until this point
// existed there was no door for that enrichment to come through. Reviews are the first case and the reason:
// a rating is not a catalog fact, it lives in an app's own isolated data space, and `ProductDoc` carries no
// rating and never will. The storefront was reaching for one anyway, out of the app's whole-store card batch,
// which made the PDP hold TWO counts of the same thing.
//
// ⚠️ IT ACCEPTS TWO KEYS AND NOT AN ARBITRARY GRAPH, and that narrowness is the point. A contribution merges
// into a `Product` node the storefront authored — name, sku, offers, canonical image — and a contract typed as
// `Record<string, unknown>` would let an app rewrite the price the shopper is charged, in a document only a
// crawler reads. So the consumer names the fields it will accept; a third one is a deliberate edit here,
// exactly as widening `CardAnnotation` is.

/** The schema.org fields an app may add to a product's `Product` graph. Both optional: a contributor with a
 * rating but no listable reviews (or the other way round) is an ordinary state. */
export type ProductStructuredData = {
  /** A schema.org `AggregateRating` node. Absent = no rating to advertise; a count of zero is NOT a rating. */
  aggregateRating?: Record<string, unknown>;
  /** schema.org `Review` nodes — and ONLY the ones the rendered page actually contains. */
  review?: Record<string, unknown>[];
};

/**
 * What an app must export to contribute to this point: one product's enrichment, or `null` when it has
 * nothing to say.
 *
 * ⚠️ IT MUST NOT COMPUTE ITS ANSWER A SECOND TIME. Whatever the app also renders on this page — a reviews
 * section, a rating badge — has to come from the SAME read this returns, per request. Structured data is a
 * machine-readable claim about the document it sits in, and two reads of one store are two snapshots: the
 * page would show one number and claim another, and the only witness would be a Search Console report months
 * later. `extensions/reviews/product-reviews.ts` is the worked example (a `cache()` memo both halves stand on).
 *
 * It must never throw for an ordinary absence — no data, nothing installed, its own port down — and return
 * `null` instead. The aggregator catches anyway (a contributor is somebody else's code), but a contributor
 * that signals "nothing to say" by throwing turns a normal state into a swallowed error.
 */
export type ProductStructuredDataContribution = (
  store: string,
  productId: string,
) => Promise<ProductStructuredData | null>;
