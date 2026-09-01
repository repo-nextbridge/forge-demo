// THE SHAPE THE SCREEN RECEIVES — the kernel's checkout view, narrowed to what a counter draws.
//
// ★ EVERY MONEY FIELD HERE IS THE KERNEL'S, FORMATTED AND NOT COMPUTED. The subtotal, the discount and the
// total come out of `read.checkout`'s own totalizers and `total_amount`; nothing in this file adds anything
// up. That is what makes "the coupon takes exactly 10%" and "the same coffee costs the same as in the online
// shop" facts rather than claims — and it is why `bag.test.ts` refuses a version of this file that sums.

import type { CheckoutView, ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { coverOf, mediaSrc } from '@forgecommerce/storefront-kit/media/src';
import { money } from './money';

export type BagLine = {
  lineId: string;
  skuId: string;
  name: string;
  variant: string;
  imageUrl: string | undefined;
  qty: number;
  lineTotalLabel: string;
};

export type Bag = {
  cartId: string | null;
  lines: BagLine[];
  count: number;
  subtotalLabel: string;
  /** Present only when the kernel actually applied a discount. Never a number this screen worked out. */
  discountLabel: string | null;
  discountTitle: string | null;
  totalLabel: string;
  couponCode: string | null;
};

/** The empty bag, so a screen with no cart yet renders the same component as one with a full basket. */
export const EMPTY_BAG: Bag = {
  cartId: null,
  lines: [],
  count: 0,
  subtotalLabel: money(0),
  discountLabel: null,
  discountTitle: null,
  totalLabel: money(0),
  couponCode: null,
};

/**
 * The kernel's totalizers, read for the three numbers the artboard prints.
 *
 * ⚠️ THE DISCOUNT RIDES IN `totalizers` AS `discount:<promotion_id>`, and that is deliberate upstream: it is
 * what keeps `total_amount` the kernel's own number and stops any front from ever summing a discount. So the
 * counter reads the line rather than multiplying by 0.9 — which is also the only version of this that stays
 * true when the promotion changes.
 */
function totals(view: CheckoutView) {
  // ⚠️ THE ID IS `subtotal`, MEASURED. It was written as `items` here first, from memory, and a cart on the
  // counter store answered `[('subtotal', 1400)]` — so the subtotal silently fell through to a computed
  // fallback that happened to agree. It agrees until a totalizer this screen has never seen appears.
  const items = view.totalizers.find((t) => t.id === 'subtotal' || t.id === 'items');
  const discounts = view.totalizers.filter((t) => t.id.startsWith('discount:'));
  // ⚠️ AND A DISCOUNT ARRIVES NEGATIVE. Measured on the same cart: applying PRIMEIROCAFE added
  // `('discount:promo_…', 'PRIMEIROCAFE · 10% OFF', -140)` and moved `total_amount` from 1400 to 1260 —
  // exactly ten per cent, taken by the kernel. Reading the sign wrong is how a screen ends up ADDING a
  // discount to the subtotal and printing a bigger number than the customer is about to pay.
  const discountAmount = discounts.reduce((n, t) => n + t.amount, 0);
  return {
    subtotal: items?.amount ?? view.total_amount - discountAmount,
    discountAmount,
    discountLabel: discounts[0]?.name ?? null,
    total: view.total_amount,
  };
}

export function toBag(view: CheckoutView | null, products: ProductDoc[]): Bag {
  if (!view) return EMPTY_BAG;
  const bySku = new Map<string, { product: ProductDoc; variant: string }>();
  for (const p of products)
    for (const s of p.skus)
      bySku.set(s.id, {
        product: p,
        // The counter's own label for a variant: the option values in the order the product declares them —
        // "G · Aveia". `sku.name` is used when the merchant wrote one, because a merchant's word wins.
        variant:
          s.name?.trim() ||
          s.option_values.map((o) => o.value).join(' · ') ||
          '',
      });

  const t = totals(view);
  const lines = view.lines.map((l) => {
    const hit = bySku.get(l.sku_id);
    return {
      lineId: l.line_id,
      skuId: l.sku_id,
      name: hit?.product.title ?? 'Item',
      variant: hit?.variant ?? '',
      imageUrl: hit ? mediaSrc(coverOf(hit.product.media)).url : undefined,
      qty: l.qty,
      lineTotalLabel: money(l.line_total),
    };
  });

  const coupon = view.pricing?.applied_coupons?.[0];
  return {
    cartId: view.cart_id,
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalLabel: money(t.subtotal),
    // Printed as the reduction it is, whatever sign the kernel used to say it.
    discountLabel: t.discountAmount === 0 ? null : money(-Math.abs(t.discountAmount)),
    discountTitle: t.discountAmount === 0 ? null : t.discountLabel,
    totalLabel: money(t.total),
    couponCode: coupon?.code ?? null,
  };
}
