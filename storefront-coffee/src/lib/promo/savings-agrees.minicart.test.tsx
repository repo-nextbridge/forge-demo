// ★★ r25a-2, THE VITRINE'S HALF — the mini-cart drawer closes on the same number the checkout does.
//
// THE DEFECT, as the bench measured it: one cart, two screens, two different "Você economizou". The desktop
// column counted the struck `de` of a line AND the promotion (R$ 59,90 + R$ 10,00 = R$ 69,90); the phone
// counted only the promotion. Both were internally consistent and they disagreed about the same cart.
//
// ★ CHECKOUT-APP (C1) SPLIT THIS PROOF ACROSS TWO DEPLOYABLES, and this is the arm that renders in THIS
// build. The checkout's two surfaces (the column and its phone drawer) are asserted in
// `apps/checkout/src/lib/promo/savings-agrees-across-viewports.test.tsx`, whose tree sweep — "every surface
// that prints the sentence is asserted somewhere" — now reads BOTH trees, so a fourth surface born on either
// side of the cut still has to be enlisted.
//
// ⚠️ AND THE TWO HALVES CANNOT DRIFT APART, for a reason stronger than these tests: the sentence has ONE
// producer. `promo/discount-lines.ts` computes it and it lives in the kit, which both deployables import.
// What is asserted here is that this build's surface actually prints what that producer says.

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { CartPricing, Totalizer } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MinicartDrawer } from '@/components/minicart/MinicartDrawer';
import { MinicartProvider, useMinicart } from '@/components/minicart/MinicartProvider';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

// The bench's cart, in cents.
const PREDATOR_WAS = 25990; // the merchant's compare_at
const PREDATOR_NOW = 20000; // what it is sold for
const NIKE_LIST = 10000; // catalog price…
const NIKE_NOW = 9000; // …after "Semana do Cliente" (−10%)
const PROMO = NIKE_LIST - NIKE_NOW; // R$ 10,00 — all the phone was counting
const LISTED = PREDATOR_WAS - PREDATOR_NOW; // R$ 59,90 — the struck "de" the phone dropped
const SAVINGS = 'R$ 69,90'; // LISTED + PROMO, the number every surface has to close on

const LINES: SummaryLine[] = [
  {
    line_id: 'ln_predator',
    sku_id: 'sku_predator',
    qty: 1,
    unit_amount: PREDATOR_NOW,
    line_total: PREDATOR_NOW,
    title: 'adidas Kids Club Predator',
    variant: '28 / Vermelho',
    compareAtAmount: PREDATOR_WAS,
  },
  {
    line_id: 'ln_nike',
    sku_id: 'sku_nike',
    qty: 1,
    unit_amount: NIKE_LIST,
    line_total: NIKE_LIST,
    title: 'Nike Everyday',
  },
];

const TOTALIZERS: Totalizer[] = [
  { id: 'subtotal', name: 'Subtotal', amount: PREDATOR_NOW + NIKE_LIST },
  { id: 'discount:prom_semana', name: 'Semana do Cliente', amount: -PROMO },
];

const PRICING: CartPricing = {
  discount_lines: [
    { id: 'discount:prom_semana', name: 'Semana do Cliente', amount: -PROMO, class: 'item' },
  ],
  discount_total: PROMO,
  line_discounts: [
    {
      line_id: 'ln_predator',
      original_total: PREDATOR_NOW,
      item_total: PREDATOR_NOW,
      item_discount: 0,
      order_discount: 0,
      discounts: [],
    },
    {
      line_id: 'ln_nike',
      original_total: NIKE_LIST,
      item_total: NIKE_NOW,
      item_discount: PROMO,
      order_discount: 0,
      discounts: [
        { promotion_id: 'prom_semana', label: 'Semana do Cliente', amount: PROMO, class: 'item' },
      ],
    },
  ],
  items_total: PREDATOR_NOW + NIKE_NOW,
  shipping_gross: null,
  shipping_discount: 0,
  near_misses: [],
  applied_coupons: [],
  gift_lines: [],
};

const TOTAL = PREDATOR_NOW + NIKE_NOW;

/** `formatMoney` glues "R$" to the number with a NON-BREAKING space; every read normalises it. Written as the
 * escape and not as the character, so a copy of this file cannot lose it to an editor and silently stop
 * normalising anything. */
const text = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\u00A0/g, ' ');
const money = (node: Element | null | undefined) => text(node).trim();

function Opener() {
  const { openDrawer } = useMinicart();
  return (
    <button type="button" data-testid="open" onClick={openDrawer}>
      open
    </button>
  );
}

/** The mini-cart over the bench's cart — the surface this build owns. */
async function minicart(): Promise<HTMLElement> {
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

test('★ the minicart tells the same story about the same cart', async () => {
  const mini = await minicart();
  expect(text(mini)).toContain('R$ 259,90');
  expect(money(mini.querySelector('[data-testid="minicart-savings"]'))).toBe(SAVINGS);
  // The bench's own sum, restated where it is asserted: 59,90 (the struck "de") + 10,00 (the promotion).
  expect(LISTED + PROMO).toBe(6990);
});
