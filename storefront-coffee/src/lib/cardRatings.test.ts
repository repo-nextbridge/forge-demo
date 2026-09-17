// cardRatings is the per-request memo the card sites (shelves, PLP grids, recommendations) call to get the
// store's card annotations in ONE batch read per contributor. It must aggregate whatever the COMPOSED registry
// carries, degrade to {} (no stars) on any contributor failure, and never call a contributor for an empty store.
//
// ★ F2 — WHAT IS MOCKED IS THE GENERATED REGISTRY, NOT AN APP. This suite used to `vi.mock`
// '@forgeco/ext-reviews/ratings', which named an app in the storefront's own tests — the same weld the
// production file carried. The seam under test is now the composition point: the registry is the boundary, and
// mocking it is how the aggregation rules (0..n contributors, one that throws, an empty store) get exercised
// without depending on which apps this instance's list happens to carry. The real contribution is unit-tested
// where it lives (extensions/reviews/ratings.test.ts) and typed against the contract by the generated file.

import { afterEach, expect, test, vi } from 'vitest';

const first = vi.fn();
const second = vi.fn();
vi.mock('@/lib/card-annotations/generated/registry', () => ({
  composedCardAnnotations: [
    { id: 'first-app', contribute: (...args: unknown[]) => first(...args) },
    { id: 'second-app', contribute: (...args: unknown[]) => second(...args) },
  ],
}));

// Imported AFTER the mock is registered (vi.mock is hoisted, but keep the intent explicit).
const { cardRatings } = await import('./cardRatings');

afterEach(() => vi.clearAllMocks());

test('every contributor is asked for the store, and their annotations MERGE', async () => {
  first.mockResolvedValue({ prod_1: { average: 4.5, count: 32 } });
  second.mockResolvedValue({ prod_2: { average: 3, count: 4 } });
  expect(await cardRatings('acme')).toEqual({
    prod_1: { average: 4.5, count: 32 },
    prod_2: { average: 3, count: 4 },
  });
  expect(first).toHaveBeenCalledWith('acme');
  expect(second).toHaveBeenCalledWith('acme');
});

test('an empty store id short-circuits — no contributor is called at all', async () => {
  expect(await cardRatings('')).toEqual({});
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
});

test('a THROWING contributor costs only its own annotations — the others still arrive', async () => {
  // The isolation is the point: a contribution is somebody else's code, and one bad app may not blank every
  // card on the page. Before F2 there was exactly one caller and one try/catch, so this case did not exist.
  first.mockRejectedValue(new Error('down'));
  second.mockResolvedValue({ prod_2: { average: 5, count: 9 } });
  expect(await cardRatings('store-err')).toEqual({ prod_2: { average: 5, count: 9 } });
});

test('every contributor down → {} (every card shows no stars)', async () => {
  first.mockRejectedValue(new Error('down'));
  second.mockRejectedValue(new Error('down'));
  expect(await cardRatings('store-all-down')).toEqual({});
});
