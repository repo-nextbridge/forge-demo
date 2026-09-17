// ★★ F2 — THE DEGRADATION, PROVED BY RENDER (the "defects only the render shows" ruler).
//
// The DoD of taking `reviews` out of the product is not "the build is green": it is that a shopper's product
// card still DRAWS, with no annotation on it. A typecheck cannot say that, and neither can asserting that
// `cardRatings()` returned `{}` — the interesting failure is downstream of the map, in the card that reads
// `ratings[product_id]`, where an absent key is `undefined` and `undefined.average` is a blank page.
//
// So this renders the REAL seam the whole point exists to feed: `injectRenderCard`, the theme function the
// GENERATED block registry calls with `await inject<Name>(props)`, which reads `cardRatings` and threads the
// annotation into the theme's own `<ProductCard rating={…}>`. Two renders, on purpose:
//
//   · ZERO contributors — the state of an instance whose composition list does not carry an annotating app —
//     and the card must render, with the rating row present and EMPTY (it is reserved, so the grid does not
//     dance when a neighbour has stars).
//   · ONE contributor, so the empty case is not green for the wrong reason. ⚠️ A test that only measured the
//     "after" would pass over a card that never renders a rating at all; measuring both is what makes the
//     empty render mean something.
//
// The registry is mocked because it is the composition BOUNDARY: what varies here is "does this image carry a
// contributor", and mocking the generated module is how both answers are reachable from one suite.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, within } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import type { CardAnnotations } from './contract';

const contribute = vi.fn<(store: string) => Promise<CardAnnotations>>();
/** Flipped per test: `[]` is the image with no annotating app, one entry is the image that carries one. */
const registry: { id: string; contribute: (store: string) => Promise<CardAnnotations> }[] = [];

vi.mock('@/lib/card-annotations/generated/registry', () => ({
  get composedCardAnnotations() {
    return registry;
  },
}));
// The card chrome is the OTHER thing the injection reads; it is not what this suite is about.
vi.mock('@/lib/cardChrome', () => ({
  cardChrome: async () => ({ freeShippingThreshold: null, maxInstallments: 1 }),
}));

const { injectRenderCard } = await import('@/lib/extensions/injections');

const product = makeProduct({ product_id: 'prod_1', title: 'Tênis Speed Elite' });

beforeEach(() => {
  registry.length = 0;
  contribute.mockReset();
});

/** Exactly what the generated block registry does: `await injectRenderCard(props)`, then call it per product. */
async function renderThroughTheSeam() {
  const renderCard = await injectRenderCard({ store: 'acme', storeBase: HOST_BASE });
  const { container } = render(renderCard(product as never));
  return { container, ...within(container) };
}

test('★★ ZERO contributors — the card RENDERS, with the rating row reserved and EMPTY', async () => {
  const { getByTestId } = await renderThroughTheSeam();

  // It drew at all — the failure this test exists for is a card that throws on `ratings[id].average`.
  expect(getByTestId('product-card')).toBeTruthy();
  expect(getByTestId('product-card').textContent).toContain('Tênis Speed Elite');
  // …and the annotation slot is there and blank: no stars, no "(0)", no gap that shifts the grid.
  expect(getByTestId('product-card-rating').textContent).toBe('');
});

test('★ ONE contributor — the SAME card carries its stars (so the empty render above means something)', async () => {
  contribute.mockResolvedValue({ prod_1: { average: 4.7, count: 128 } });
  registry.push({ id: 'an-app', contribute });

  const { getByTestId } = await renderThroughTheSeam();

  expect(getByTestId('product-card').textContent).toContain('Tênis Speed Elite');
  expect(getByTestId('product-card-rating').textContent).toMatch(/128/);
  expect(contribute).toHaveBeenCalledWith('acme');
});

test('★ a contributor that says nothing about THIS product leaves its card unannotated, not broken', async () => {
  // The ordinary case on a real storefront: the app is installed and the product simply has no reviews. An
  // UNRATED product is ABSENT from the batch — never `{ average: 0, count: 0 }` — so this is the path every
  // grid takes for most of its cards.
  contribute.mockResolvedValue({ prod_other: { average: 5, count: 2 } });
  registry.push({ id: 'an-app', contribute });

  const { getByTestId } = await renderThroughTheSeam();

  expect(getByTestId('product-card').textContent).toContain('Tênis Speed Elite');
  expect(getByTestId('product-card-rating').textContent).toBe('');
});
