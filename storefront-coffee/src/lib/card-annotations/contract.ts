// THE EXTENSION POINT `storefront.card_annotations` — DECLARED BY THE CONSUMER (F2).
//
// ★ THE CONTRACT BELONGS TO THE POINT, NEVER TO THE APP, and that sentence is the whole slice. Until now the
// storefront got its card stars by importing the app's LIBRARY by name (`cardRatings.ts` →
// `@forgeco/ext-reviews/ratings`) and taking the TYPE from the same import. That is the dependency
// inversion the wrong way round, and it is why `reviews` could not be taken out of the product: removing the
// app removed the function AND the shape the caller was written against, in two different files.
//
// So the shape lives HERE, in the consumer that reads it, and an app implements it by STRUCTURAL typing — it
// imports nothing from the storefront (no cycle, and an app must stay installable from npm into somebody
// else's front). It is the exact mirror of `../extensions/injections.tsx`, which states the inverse rule for
// what the surface hands the app: "the app declares WHAT it wants, never WHERE it comes from".
//
// ⚠️ WHO CHECKS THAT AN APP ACTUALLY FITS. Not this file and not a guard: the GENERATED registry next door
// (`./generated/registry.ts`, written by `pnpm codegen` from `extensions/composition.base.json`) types every
// entry as `CardAnnotationsContribution`. An app whose export has the wrong shape is therefore a `tsc` error
// inside the storefront, naming the app's module and this contract — the failure arrives at build time, in
// the consumer, without anybody remembering to look. Nothing mirrors this by hand; the mirror is the codegen
// and the drift-check is what watches it.
//
// ⚠️ AND WIDENING IT IS A DELIBERATE EDIT, WHICH IS THE POINT. Today a card carries exactly one annotation —
// the rating summary — so that is what `CardAnnotation` is. The day a second one arrives (a badge, a stock
// label) this type becomes a record of optional fields, and EVERY contribution stops compiling until it says
// which field it fills. That is not a trap, it is the mechanism announcing itself: a contract that could
// absorb a second annotation silently would be a contract that never checked the first one.

/** What ONE product's card carries beyond its product doc. v1: the rating summary (see the note above). */
export type CardAnnotation = {
  /** The average star rating, 0..5 — the card renders it as fractional fill. */
  average: number;
  /** How many reviews the average counts. A product with none is ABSENT from the batch, never `count: 0`. */
  count: number;
};

/** product_id → its annotation. A product absent from the map is UNANNOTATED and its card shows nothing —
 * the same absence the storefront already degrades to when no contributing app is installed. */
export type CardAnnotations = Record<string, CardAnnotation>;

/**
 * What an app must export to contribute to this point.
 *
 * ONE call for the whole visible set, never one per card: a page with several shelves plus a grid asks once
 * (the aggregator memoizes per request), so a contributor may read its own store in a single batch. The
 * optional `productIds` narrows the KEYS the contributor returns to the visible set; a contributor that
 * ignores it is still correct, only less frugal.
 *
 * It must never throw for an ordinary absence — no data, nothing installed, its own port down — and return an
 * empty map instead. The aggregator catches anyway (a contributor is somebody else's code), but a contributor
 * that signals "nothing to say" by throwing turns a normal state into a swallowed error.
 */
export type CardAnnotationsContribution = (
  store: string,
  productIds?: readonly string[],
) => Promise<CardAnnotations>;
