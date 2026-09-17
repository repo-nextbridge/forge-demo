// THE SHAPE THE SCREEN RECEIVES — the kernel's checkout view, narrowed to what a counter draws.
//
// ★ EVERY MONEY FIELD HERE IS THE KERNEL'S, FORMATTED AND NOT COMPUTED. The subtotal, the discount and the
// total come out of `read.checkout`'s own totalizers and `total_amount`; nothing in this file adds anything
// up. That is what makes "the coupon takes exactly 10%" and "the same coffee costs the same as in the online
// shop" facts rather than claims — and it is why `bag.test.ts` refuses a version of this file that sums.

import type {
  CheckoutView,
  OrderConfirmationView,
  ProductDoc,
} from '@forgeco/storefront-kit/read-client';
import { coverOf, mediaSrc } from '@forgeco/storefront-kit/media/src';
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

/**
 * ONE REDUCTION THE KERNEL APPLIED, named by the kernel and printed as the reduction it is.
 *
 * ★★ IT IS A LIST AND NOT A PAIR, AND THAT IS A MEASUREMENT. A counter order really does carry more than
 * one: read back from a placed order of the coffee store, the totalizers were
 * `discount:… "10% na primeira compra" -1560` AND `discount:… "Combo da manhã · R$ 3,00 OFF" -300` on the
 * same order. Collapsing them into one row keeps the arithmetic closing and puts ONE promotion's name over
 * TWO promotions' money — a screen saying something true about the total and false about why.
 */
export type BagDiscount = { title: string; amountLabel: string };

/**
 * ★★ A PROMOTION THE ENGINE COULD NOT JUDGE BECAUSE NOBODY HAS SAID WHO THEY ARE — its NAME, and nothing else.
 *
 * ── THE DEFECT, MEASURED. The review printed **R$ 153,00** and the QR charged **R$ 137,40**. Both numbers
 * were right: the review runs over a cart with no buyer on it, and "10% na primeira compra" cannot be judged
 * until `cart.set_buyer` — which this counter sends 43 ms before it closes the order. So the screen was not
 * wrong about the total; it was SILENT about the total still being open, and a silent provisional total
 * reads as a final one.
 *
 * ⚠️ THERE IS NO AMOUNT IN THIS TYPE AND THERE MUST NEVER BE ONE. `CartPricing.pending_identity` carries no
 * value on purpose: identifying may leave the promotion REJECTED (a returning customer earns no
 * first-purchase discount), so any figure shown here would be a promise the engine already refused to make.
 * The mapping below also drops the engine's `reason`, which is a verdict about an unknown person and says
 * nothing a customer at the glass can act on.
 */
export type BagPendingPromotion = { promotionId: string; label: string };

export type Bag = {
  cartId: string | null;
  lines: BagLine[];
  count: number;
  subtotalLabel: string;
  /** One row per discount the kernel actually applied. Empty when it applied none — never a row of zero. */
  discounts: BagDiscount[];
  totalLabel: string;
  /**
   * Promotions still waiting on an identity — see `BagPendingPromotion`. EMPTY means the screen says nothing,
   * and three different facts collapse into that one silence ON PURPOSE: the cart already has a buyer, the
   * engine named none, or the pinned port predates the field. A screen that guessed which of the three it was
   * would be inventing the promotion the port declined to name.
   */
  pendingIdentity: BagPendingPromotion[];
  couponCode: string | null;
};

/** The empty bag, so a screen with no cart yet renders the same component as one with a full basket. */
export const EMPTY_BAG: Bag = {
  cartId: null,
  lines: [],
  count: 0,
  subtotalLabel: money(0),
  discounts: [],
  totalLabel: money(0),
  pendingIdentity: [],
  couponCode: null,
};

/**
 * ★★ THE BAG OF AN ORDER THIS COUNTER COULD NOT READ BACK — money it DECLINES to state, never zero.
 *
 * `R$ 0,00` is not the honest answer to "the port did not describe this order": it is a PRICE, and a screen
 * that prints one it never read is the defect this whole file exists to prevent. The dash is drawable,
 * obviously not a total, and cannot be mistaken for a free order by the person standing at the glass.
 */
export const UNREADABLE_ORDER_BAG: Bag = {
  ...EMPTY_BAG,
  subtotalLabel: '—',
  totalLabel: '—',
};

/**
 * The kernel's totalizers, read for the three numbers the artboard prints.
 *
 * ⚠️ THE DISCOUNT RIDES IN `totalizers` AS `discount:<promotion_id>`, and that is deliberate upstream: it is
 * what keeps `total_amount` the kernel's own number and stops any front from ever summing a discount. So the
 * counter reads the line rather than multiplying by 0.9 — which is also the only version of this that stays
 * true when the promotion changes.
 */
function totals(view: Pick<CheckoutView, 'totalizers' | 'total_amount'>) {
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
    // Each one keeps ITS OWN name beside ITS OWN money, printed as the reduction it is whatever sign the
    // kernel used to say it. See `BagDiscount` for the order that made the list necessary.
    discounts: discounts.map((t) => ({ title: t.name, amountLabel: money(-Math.abs(t.amount)) })),
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
    discounts: t.discounts,
    totalLabel: money(t.total),
    // ★ THE FRONT KEEPS ITS OWN HALF OF THE FENCE. The kernel already empties `pending_identity` once a buyer
    // is on the cart, and this repeats it against `has_buyer` because the two facts arrive in the SAME
    // payload: with a buyer loaded those same refusals stop being "nobody was asked" and become verdicts
    // about a person the store knows, which a counter must not narrate back. A stale read or a future port
    // that widens the field therefore cannot turn this into a sentence about a named customer.
    pendingIdentity: view.has_buyer
      ? []
      : (view.pricing?.pending_identity ?? []).map((p) => ({
          promotionId: p.promotion_id,
          label: p.label,
        })),
    couponCode: coupon?.code ?? null,
  };
}

/**
 * ★★ THE BAG OF AN ORDER THAT ALREADY EXISTS — for the screen that comes back to a payment (C5, 05/09).
 *
 * A reload lands on a till whose CART is spent: `place_order` consumes the lines and the vessel comes back
 * empty. So a pix screen fed from `read.checkout` prints **Total a pagar R$ 0,00** over a live QR — a lie
 * about money, on the one screen where money is the whole point.
 *
 * ★★ AND IT IS NOT ONLY THE RECOVERY THAT NEEDS THIS. `payWith` reads the order through this function too,
 * for the same reason one step earlier: a customer who taps "Trocar forma de pagamento" and pays again
 * reaches the pay path a second time on that same spent cart, and the empty basket it answers with is what
 * put `R$ 0,00` on a live QR and an empty summary on a real receipt. One source, however many times anybody
 * pays.
 *
 * The order is its own answer: `read.order_confirmation` publishes the lines, the totalizers and
 * `total_amount` of what was actually placed. Same rule as `toBag` and the same reason: every number here is
 * the kernel's, formatted — nothing in this file adds anything up.
 *
 * ⚠️ `cartId` IS NULL AND THAT IS THE TRUTH, not a gap. There is no cart behind this bag any more, and a
 * screen that thought there was would try to write to one.
 *
 * ⚠️ The confirmation is PII-LIMITED by design, so it carries no photograph, no variant label and no line
 * ids — a line's identity here is its SKU, which is what the confirmation states. The summary reads as a
 * receipt rather than as a basket, which is what it is.
 */
export function bagOfOrder(order: OrderConfirmationView): Bag {
  const t = totals(order);
  const lines = order.lines.map((l) => ({
    lineId: l.sku_id,
    skuId: l.sku_id,
    name: l.title,
    variant: '',
    imageUrl: undefined,
    qty: l.qty,
    lineTotalLabel: money(l.line_total),
  }));
  return {
    cartId: null,
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotalLabel: money(t.subtotal),
    discounts: t.discounts,
    totalLabel: money(t.total),
    // ⛔ ALWAYS EMPTY, AND NOT FOR WANT OF A FIELD. A pending promotion is a question about a cart nobody has
    // claimed; an order was placed with its buyer attached and at a price the kernel settled. Whatever was
    // pending had its verdict before this existed, so the receipt has nothing open to announce — saying
    // "there is a discount waiting" over money already charged would be the one place it could not be true.
    pendingIdentity: [],
    // A coupon is a fact about a cart; the order carries its EFFECT (the discount totalizer above) and not
    // the code. Claiming one here would be inventing it.
    couponCode: null,
  };
}
