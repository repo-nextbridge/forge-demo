// ★★ THE HANDOFF THE CUT CREATES — the mini-cart's half of "add → drawer → checkout".
//
// CHECKOUT-APP (C1) split one journey across two deployables. These two legs used to live inside
// `templates/checkout/checkout.e2e.test.tsx`, which is now a different app; they render the mini-cart, which
// stays HERE (the cut moves the checkout out, it does not move the cart affordance in). The other half —
// "and the checkout the CTA leads to places the order" — is the last test of that file.
//
// ⚠️ THE SEAM BETWEEN THE TWO IS NOW A URL, and a URL is the one thing a DOM test cannot follow. So this
// pins the href the vitrine hands over. `/checkout` is a clean in-store path built through `storeHref`, and
// under path routing on one host it is the OTHER container that answers it — which is exactly why the
// literal is asserted here rather than trusted.

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import {
  EMPTY_SNAPSHOT,
  type MinicartSnapshot,
} from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AddToCartForm } from './AddToCartForm';
import { MinicartDrawer } from './MinicartDrawer';
import { MinicartProvider } from './MinicartProvider';

const LINES: SummaryLine[] = [
  {
    line_id: 'ln_1',
    sku_id: 'sku_1',
    qty: 2,
    unit_amount: 5000,
    line_total: 10000,
    title: 'Tênis Esportivo',
    variant: 'Preto / 40',
    imageUrl: 'https://cdn.example/media/tenis.jpg',
  },
];

function minicartSnapshot(over: Partial<MinicartSnapshot> = {}): MinicartSnapshot {
  return {
    lines: LINES,
    totalizers: [
      { id: 'subtotal', name: 'Subtotal', amount: 10000 },
      { id: 'shipping', name: 'Frete', amount: 1980 },
    ],
    totalAmount: 11980,
    currency: 'BRL',
    count: 2,
    ...over,
  };
}

test('★ minicart: add → drawer opens with the rich item; adding again aggregates the qty', async () => {
  // The cart starts empty; each add makes readCart report a fuller cart (the kernel is the truth — we re-read).
  let snap = { ...EMPTY_SNAPSHOT } as MinicartSnapshot;
  const addLine = vi.fn(async () => {
    // First add → the LINES cart (qty 2). Second add → qty 3 (aggregation reflected by the re-read).
    snap =
      snap.count === 0
        ? minicartSnapshot()
        : minicartSnapshot({
            lines: [{ ...LINES[0], qty: 3, line_total: 15000 } as SummaryLine],
            count: 3,
          });
  });
  const actions = {
    readCart: vi.fn(async () => snap),
    addLine,
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <AddToCartForm action={vi.fn(async () => {})} skuId="sku_1" />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );

  // Add → drawer opens showing the rich line (photo/name/variant), and the CTA points into the checkout.
  // Await the CONTENT (a re-read line), not just the drawer container — the snapshot commits after the add.
  fireEvent.submit(screen.getByTestId('add-to-cart-form'));
  await screen.findByText('Tênis Esportivo');
  expect(screen.getByText('Preto / 40')).toBeTruthy();
  expect(screen.getByTestId('minicart-line-qty').textContent).toBe('2');
  expect(screen.getByTestId('minicart-checkout').getAttribute('href')).toBe('/checkout');

  // Add again → the re-read shows the aggregated qty (CHK-1 behavior reflected, not computed on the front).
  fireEvent.submit(screen.getByTestId('add-to-cart-form'));
  await waitFor(() => expect(screen.getByTestId('minicart-line-qty').textContent).toBe('3'));
  expect(addLine).toHaveBeenCalledTimes(2);
});

test('★ leg 1 of the cross-app journey: the drawer CTA hands the shopper to /checkout', async () => {
  const actions = {
    readCart: vi.fn(async () => minicartSnapshot()),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <AddToCartForm action={vi.fn(async () => {})} skuId="sku_1" />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  fireEvent.submit(screen.getByTestId('add-to-cart-form'));
  // Await the CTA itself (only rendered once the drawer is open AND the re-read is populated).
  const cta = await screen.findByTestId('minicart-checkout');
  expect(cta.getAttribute('href')).toBe('/checkout');
});
