// ★★ THE DRAWER'S HALF of "the closing counts the struck `de` of the line, not only the promotion".
//
// THE DEFECT: the mini-cart printed `1 × R$ 990,00` for a line the card and the PDP show as "de R$ 1.286,90".
// It was the ONE surface in the flow that dropped the merchant's struck price — so its closing was internally
// consistent and disagreed with the checkout's about the same cart.
//
// ★ CHECKOUT-APP (C1) — the checkout's arms are in
// `apps/checkout/src/lib/promo/savings-closes-the-account.test.tsx`; this is the surface THIS build renders.
// The arithmetic has one home (`promo/discount-lines`, in the kit) and both deployables import it.

import type { SummaryLine } from '@forgeco/storefront-kit/checkout/enrich';
import type { CartPricing, Totalizer } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MinicartDrawer } from '@/components/minicart/MinicartDrawer';
import { MinicartProvider, useMinicart } from '@/components/minicart/MinicartProvider';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const KEEN_WAS = 128690; // the merchant's compare_at on the Keen Targhee
const KEEN_NOW = 99000; // what it is sold for
const ADISTAR_WAS = 70000; // the Adistar at catalog price…
const ADISTAR_NOW = 63000; // …and after the item-class promotion (−10%)
const PROMO = ADISTAR_WAS - ADISTAR_NOW; // R$ 70,00 — the only thing the closing used to count
const _LISTED = KEEN_WAS - KEEN_NOW; // R$ 296,90 — struck on the line and counted by nobody

const LINES: SummaryLine[] = [
  {
    line_id: 'ln_keen',
    sku_id: 'sku_keen',
    qty: 1,
    unit_amount: KEEN_NOW,
    line_total: KEEN_NOW,
    title: 'Keen Targhee',
    compareAtAmount: KEEN_WAS,
  },
  {
    line_id: 'ln_adistar',
    sku_id: 'sku_adistar',
    qty: 1,
    unit_amount: ADISTAR_WAS,
    line_total: ADISTAR_WAS,
    title: 'Adistar 4',
  },
];

const TOTALIZERS: Totalizer[] = [
  { id: 'subtotal', name: 'Subtotal', amount: KEEN_NOW + ADISTAR_WAS },
  { id: 'discount:prom_adistar', name: '10% off Adistar', amount: -PROMO },
];

const PRICING: CartPricing = {
  discount_lines: [
    { id: 'discount:prom_adistar', name: '10% off Adistar', amount: -PROMO, class: 'item' },
  ],
  discount_total: PROMO,
  line_discounts: [
    {
      line_id: 'ln_keen',
      original_total: KEEN_NOW,
      item_total: KEEN_NOW,
      item_discount: 0,
      order_discount: 0,
      discounts: [],
    },
    {
      line_id: 'ln_adistar',
      original_total: ADISTAR_WAS,
      item_total: ADISTAR_NOW,
      item_discount: PROMO,
      order_discount: 0,
      discounts: [
        { promotion_id: 'prom_adistar', label: '10% off Adistar', amount: PROMO, class: 'item' },
      ],
    },
  ],
  items_total: KEEN_NOW + ADISTAR_NOW,
  shipping_gross: null,
  shipping_discount: 0,
  near_misses: [],
  applied_coupons: [],
  gift_lines: [],
};

const TOTAL = KEEN_NOW + ADISTAR_NOW;

/** `formatMoney` joins "R$" to the number with a NON-BREAKING space, so every read normalises it — a raw
 * `textContent` search for "R$ 1.286,90" misses a screen that is printing exactly that. */
const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\u00a0/g, ' ');
const money = (node: Element | null | undefined) => text(node).trim();

function Opener() {
  const { openDrawer } = useMinicart();
  return (
    <button type="button" data-testid="open" onClick={openDrawer}>
      open
    </button>
  );
}

/** The drawer over the SAME cart, opened the way the shopper opens it. */
async function drawer(): Promise<HTMLElement> {
  const readCart = vi.fn(async () => ({
    lines: LINES,
    totalizers: TOTALIZERS,
    totalAmount: TOTAL,
    currency: 'BRL',
    count: 2,
    pricing: PRICING,
  }));
  render(
    <MinicartProvider
      actions={{
        readCart,
        addLine: vi.fn(async () => {}),
        updateLine: vi.fn(async () => {}),
        removeLine: vi.fn(async () => {}),
      }}
    >
      <Opener />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(readCart).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId('open'));
  return await screen.findByTestId('minicart-drawer');
}

test('★★ …and the drawer tells the SAME story: the same struck price and the same closing', async () => {
  const mini = await drawer();
  // The drawer used to print `1 × R$ 990,00` for a line the card and the PDP show as "de R$ 1.286,90": it was
  // the one surface in the flow that dropped the merchant's "de" — so its closing was internally consistent
  // and disagreed with the checkout's about the same cart.
  expect(text(mini)).toContain('R$ 1.286,90');
  expect(money(mini.querySelector('[data-testid="minicart-savings"]'))).toBe('R$ 366,90');
});
