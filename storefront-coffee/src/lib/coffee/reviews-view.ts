// THE REVIEW WALL'S DATA — the second of the two dynamic pieces the design marked with a hole, and the whole
// of what this shop does to what the reviews app hands it.
//
// ── WHAT THE APP SERVES, MEASURED ────────────────────────────────────────────────────────────────────────
// `fetchPublishedReviews` (`@forgeco/ext-reviews/reviews`, exported by D2-E3) returns ROWS, not a
// component: `{ id, product_id, rating, body, author, origin, status, created_at }`. That is deliberately
// less than the artboard draws, and the two gaps are handled here rather than papered over:
//
//   · THE PRODUCT NAME. The card says "Marina S. · Alvorada"; the row carries `product_id`. The home has
//     already read the six coffees to draw its cards, so the title is a JOIN this page can do for free —
//     and a review of a product this page did not load simply shows no product name, rather than an id.
//   · THE BREWING METHOD ("V60", "Prensa francesa"). The PDP artboard prints it beside the author and the
//     app's model has no such field — not missing from the read, ABSENT from the model. Nothing here
//     invents one. The PDP uses `origin` instead, which is a fact the app actually derives.
//
// ⚠️ `rating` IS NULLABLE AND THAT IS THE APP'S OWN CONTRACT, not an edge case: the field is declared with
// no `required`, so a row may carry no stars at all. A card that defaulted it to five would be inventing a
// score in the shop's favour; a card that defaulted it to zero would be inventing one against the merchant.
// It draws no dots.

import type { Review } from '@forgeco/ext-reviews/reviews';

/** The scale the dots draw. The app's own, repeated here because a storefront may not import its internals. */
export const STAR_MAX = 5;

export type WallReview = {
  id: string;
  body: string;
  author: string;
  /** The two initials in the disc. Derived from the author's own name — never stored. */
  initials: string;
  /** The filled dots, or null when the reviewer gave no score. */
  stars: number | null;
  /** The coffee this is about, when the page knows it. */
  productTitle?: string;
  /**
   * ★ THE TRUST MARK, AND IT IS `origin` RATHER THAN A RAW COLUMN. The app DERIVES this: it reads its
   * `verified` flag together with the order the review was checked against, which is the same rule the
   * merchant's own moderation queue applies. A review flagged verified with no order behind it is NOT
   * verified — that is the app's decision, and this page inherits it instead of re-deciding.
   *
   * It is what the PDP shows where the artboard printed a BREWING METHOD ("V60", "Prensa francesa"): that
   * field does not exist in the app's model — not absent from the read, absent from the MODEL — and a fork
   * that invented one would be storing a fact nobody can maintain. `origin` is the trust signal the design
   * wanted that line to carry, and it is one the app actually has.
   */
  verified: boolean;
};

/**
 * The initials the avatar disc shows.
 *
 * A review is signed the way a person signs — "Marina S.", "Ana L.", sometimes one word. So: the first
 * letter of the first two words that have one, uppercased. A name with a single word gives ONE letter, which
 * is correct and is what the disc should show; anything unparseable gives none and the disc is empty rather
 * than holding a stray character.
 */
export function initialsOf(author: string): string {
  return author
    .split(/\s+/)
    .filter((word) => /\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => [...word].find((ch) => /\p{L}/u.test(ch)) ?? '')
    .join('')
    .toUpperCase();
}

/** The dots a row draws: the app's rating clamped to the scale, or null when it gave none. */
export function starsOf(rating: number | null): number | null {
  if (rating === null || !Number.isFinite(rating)) return null;
  return Math.max(0, Math.min(STAR_MAX, Math.round(rating)));
}

/**
 * The wall's cards, with the product names joined in from what the page already loaded.
 *
 * `titles` is a plain id→title map, so a caller that has no catalogue at hand (the PDP, which is about ONE
 * product and prints no product name) passes nothing and gets cards without it.
 */
export function wallReviews(
  reviews: readonly Review[],
  titles: Readonly<Record<string, string>> = {},
): WallReview[] {
  return reviews.map((review) => ({
    id: review.id,
    body: review.body,
    author: review.author,
    initials: initialsOf(review.author),
    stars: starsOf(review.rating),
    productTitle: titles[review.product_id],
    verified: review.origin === 'verified',
  }));
}

/**
 * The store-wide rating the design prints above the wall ("4,9 de 5 · 1.284 avaliações").
 *
 * ⚠️ IT IS A WEIGHTED MEAN AND NOT A MEAN OF MEANS. The app serves an average PER PRODUCT; averaging those
 * six numbers would give every coffee equal say, so one bag with a single 5-star review would count as much
 * as the house blend with four hundred. Each product's average is weighted by its own count, which is the
 * same number a single query over all the rows would produce.
 *
 * Returns null when nothing has been reviewed — the caller then draws no rating line, rather than "0,0 de 5".
 */
export function storeRating(
  summaries: Readonly<Record<string, { average: number; count: number }>>,
): { average: number; count: number } | null {
  let total = 0;
  let weighted = 0;
  for (const { average, count } of Object.values(summaries)) {
    if (!Number.isFinite(average) || !Number.isFinite(count) || count <= 0) continue;
    total += count;
    weighted += average * count;
  }
  if (total === 0) return null;
  return { average: Math.round((weighted / total) * 10) / 10, count: total };
}
