// ★★ QA21 · G1C-7, THE VITRINE'S HALF — the mini-cart prints the promotion's shopper-facing label.
//
// THE DEFECT: a boné carrying "Boné -15%" showed R$ 200,00 struck and R$ 170,00 beside it, and nothing else —
// no text node, no `title`, no `aria-*` carrying the label the promotion editor promises appears "no carrinho,
// no checkout e no pedido". The admin was promising something in the storefront's name.
//
// ★ CHECKOUT-APP (C1) SPLIT THE PROOF. The two checkout surfaces are asserted in
// `apps/checkout/src/lib/promo/line-label.test.tsx`; this is the cart the shopper opens in THIS build. The
// label is computed once, by `promo/discount-lines` in the kit, and both deployables import it — so what each
// side owes is that its own surface actually prints it.

import type { CartPricing } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { MinicartDrawer } from '@/components/minicart/MinicartDrawer';
import type { MinicartActions } from '@/components/minicart/MinicartProvider';
import { MinicartProvider, useMinicart } from '@/components/minicart/MinicartProvider';

const LINE = {
  line_id: 'ln_1',
  sku_id: 'sku_1',
  qty: 1,
  unit_amount: 20_000,
  line_total: 17_000,
  title: 'adidas Golf Hydrophobic 2.0 Tour Hat',
};

/** The staging cart: one boné, one automatic ITEM promotion, plus an ORDER-class coupon that keeps its own
 * row in the totals — the pair that tells the two narrations apart. */
const pricing: CartPricing = {
  discount_lines: [
    { id: 'discount:prom_item', name: 'Boné -15%', amount: -3_000, class: 'item' },
    { id: 'discount:prom_order', name: 'Vale R$ 25', amount: -2_500, class: 'order' },
  ],
  discount_total: 5_500,
  line_discounts: [
    {
      line_id: 'ln_1',
      original_total: 20_000,
      item_total: 17_000,
      item_discount: 3_000,
      order_discount: 2_500,
      discounts: [
        { promotion_id: 'prom_item', label: 'Boné -15%', amount: 3_000, class: 'item' },
        { promotion_id: 'prom_order', label: 'Vale R$ 25', amount: 2_500, class: 'order' },
      ],
    },
  ],
  items_total: 17_000,
  shipping_gross: null,
  shipping_discount: 0,
  near_misses: [],
  applied_coupons: [],
  gift_lines: [],
};

function Opener() {
  const { openDrawer } = useMinicart();
  return (
    <button type="button" data-testid="open" onClick={openDrawer}>
      open
    </button>
  );
}

test('★ the minicart names the promotion on the line, so one product tells one story', async () => {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => ({
      lines: [LINE],
      totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 20_000 }],
      totalAmount: 14_500,
      currency: 'BRL',
      count: 1,
      pricing,
    })),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
  render(
    <MinicartProvider actions={actions}>
      <Opener />
      <MinicartDrawer base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(actions.readCart).toHaveBeenCalled());
  fireEvent.click(screen.getByTestId('open'));
  await screen.findByTestId('minicart-drawer');
  expect(screen.getAllByTestId('line-promo-label').map((el) => el.textContent)).toEqual([
    'Boné -15%',
  ]);
});
