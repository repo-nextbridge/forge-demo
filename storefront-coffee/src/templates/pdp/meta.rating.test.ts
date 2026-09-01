// SEO-FINISH — `aggregateRating` in the Product graph. The stars have been on the PDP since S7, but only in the
// browser: the aggregate lives in the reviews extension's own data space, `BuyboxRating` receives it through a
// client-side CustomEvent, and the JSON-LD (rendered on the server) never saw it. So the crawler was told
// nothing about ratings the shopper could see — the exact gap a rich result is for.
//
// ★ THE FIELD IS OMITTED WHEN THERE ARE NO REVIEWS, and this file has to bite in BOTH directions to mean
// anything. A test that only checks the absence would pass just as happily if the emission were deleted
// outright — it would be watching a field that never appears and calling that correct. So: present when there
// are reviews, absent when there are not, and both proven. Zero is not a rating; a rich result advertising 0.0
// stars is worse than one advertising none.
//
// ★ O3-D — WHAT CHANGED HERE IS WHERE THE DECISION LIVES, NOT WHETHER IT IS MADE. `productJsonLd` used to
// receive `{ average, count }` and decide for itself that a count of zero is not a rating. It now receives the
// fragment ALREADY SHAPED, from the app that holds the rows, through `storefront.product_structured_data` —
// so the "zero is not a rating" rule moved to `extensions/reviews/seo.ts` (proven in its own file, both
// directions) and what this function owes is narrower and still worth pinning: it merges the two fields the
// contract names, it omits what the contributor did not send, and it lets nothing else through.

import { expect, test } from 'vitest';
import type { ProductStructuredData } from '@/lib/product-structured-data/contract';
import { makeProduct } from '@/test/fixtures';
import { productJsonLd } from './meta';

const rated = (graph: Record<string, unknown>) =>
  graph.aggregateRating as Record<string, unknown> | undefined;

/** The fragment as a contributor sends it — the shape the point declares, never a rating tuple. */
const fragment = (average: number, count: number): ProductStructuredData => ({
  aggregateRating: { '@type': 'AggregateRating', ratingValue: average, reviewCount: count },
});

// ---- ★ present, and correct ---------------------------------------------------------------------

test('★ reviews on the product → aggregateRating carries the average and the count', () => {
  const graph = productJsonLd(makeProduct(), fragment(4.5, 12));
  expect(rated(graph)).toEqual({
    '@type': 'AggregateRating',
    ratingValue: 4.5,
    reviewCount: 12,
  });
  // It rides INSIDE the Product graph — a sibling of offers, not a separate node.
  expect(graph['@type']).toBe('Product');
});

test('a single review is still a rating (the boundary is zero, not "enough reviews")', () => {
  expect(rated(productJsonLd(makeProduct(), fragment(3, 1)))).toEqual({
    '@type': 'AggregateRating',
    ratingValue: 3,
    reviewCount: 1,
  });
});

// ---- ★ absent, in every way the absence can arrive -----------------------------------------------

test('★ a contributor with nothing to say → the key is ABSENT, never a 0-star rich result', () => {
  // How "no rating" arrives at this function once the app owns the rule: a fragment without the key.
  expect(productJsonLd(makeProduct(), {})).not.toHaveProperty('aggregateRating');
  expect(productJsonLd(makeProduct(), { review: [] })).not.toHaveProperty('aggregateRating');
});

test('★ O3-D — the Review list rides along, and an EMPTY one is an absent key rather than an empty claim', () => {
  const nodes = [{ '@type': 'Review', reviewBody: 'bom' }];
  expect(productJsonLd(makeProduct(), { review: nodes }).review).toEqual(nodes);
  expect(productJsonLd(makeProduct(), { review: [] })).not.toHaveProperty('review');
});

test('★ O3-D — a contributor reaches the two declared fields and NOTHING else of the Product', () => {
  // The contract types this away; the merge has to enforce it too, because a contributor is somebody else's
  // code and the graph it lands in carries the price the shopper is charged.
  const hostile = {
    aggregateRating: { '@type': 'AggregateRating', ratingValue: 5, reviewCount: 1 },
    offers: { '@type': 'Offer', price: '0.01' },
    name: 'Outro produto',
  } as unknown as ProductStructuredData;
  const graph = productJsonLd(makeProduct(), hostile);
  expect(graph.name).toBe(makeProduct().title);
  expect((graph.offers as { price: string }).price).toBe('79.90');
});

test('no rating argument at all (reviews app not installed / port down) → the key is ABSENT', () => {
  expect(productJsonLd(makeProduct())).not.toHaveProperty('aggregateRating');
  expect(productJsonLd(makeProduct(), undefined)).not.toHaveProperty('aggregateRating');
});

test('the rest of the Product graph is untouched by the rating being present or absent', () => {
  const withRating = productJsonLd(makeProduct(), fragment(4.5, 12));
  const without = productJsonLd(makeProduct());
  const { aggregateRating, ...rest } = withRating;
  void aggregateRating;
  expect(rest).toEqual(without);
});
