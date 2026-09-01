// ★★ THE MONEY GUARD: every number on the counter is the KERNEL'S, and none of them is arithmetic done here.
//
// Two acceptance criteria of this slice rest entirely on that one property:
//   · the coupon takes EXACTLY 10% — because the kernel took it, not because this app multiplied by 0.9;
//   · a coffee costs the same at the counter as it does in the online shop — same SKU, one price, read live.
//
// A screen that sums its own lines passes both by accident on a good day and lies on the day a promotion,
// a rounding rule or a price change makes the two disagree. So the test does not check that the total is
// "right" — it checks that the total is the one the kernel SENT, by feeding a view whose `total_amount`
// deliberately disagrees with the lines.
import { describe, expect, it } from 'vitest';
import type { CheckoutView } from '@forgecommerce/storefront-kit/read-client';
import { toBag } from './view';

const view = (over: Partial<CheckoutView> = {}): CheckoutView =>
  ({
    cart_id: 'cart_01ABC',
    store_id: 'sto_test',
    currency: 'BRL',
    status: 'active',
    identity_state: 'guest',
    buyer_masked: null,
    shipping_masked: null,
    has_buyer: false,
    has_shipping_address: false,
    shipping_method_id: null,
    shipping_method_label: null,
    shipping_delivery_min_days: null,
    shipping_delivery_max_days: null,
    payment_method: null,
    lines: [{ line_id: 'cl_1', sku_id: 'sku_1', qty: 2, unit_amount: 1300, line_total: 2600 }],
    totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 2600 }],
    total_amount: 2600,
    ...over,
  }) as CheckoutView;

const doc = {
  product_id: 'p1',
  title: 'Cappuccino',
  description: '',
  handle: 'cappuccino',
  status: 'active',
  metadata: null,
  options: [],
  skus: [
    {
      id: 'sku_1',
      code: 'c1',
      amount: 1300,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: null,
      option_values: [
        { option_id: 'o1', option_name: 'Tamanho', value_id: 'v1', value: 'G' },
        { option_id: 'o2', option_name: 'Leite', value_id: 'v2', value: 'Aveia' },
      ],
      media: [],
    },
  ],
  categories: [],
  media: [],
} as never;

describe('the bag repeats the kernel', () => {
  it('★ takes the TOTAL from `total_amount`, even when it disagrees with the lines', () => {
    // A cart the kernel says costs R$ 20,00 while its one line reads R$ 26,00. Only a screen that computes
    // its own total can get this "right" — and getting it right here is the bug.
    const bag = toBag(view({ total_amount: 2000 }), [doc]);
    expect(bag.totalLabel).toBe('R$ 20,00');
  });

  it('★ takes the SUBTOTAL from the `subtotal` totalizer, not from the lines', () => {
    const bag = toBag(view({ totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 9900 }] }), [doc]);
    expect(bag.subtotalLabel).toBe('R$ 99,00');
  });

  it('★ shows a discount ONLY when the kernel sent a discount line, and shows the kernel’s number', () => {
    const bag = toBag(
      view({
        totalizers: [
          { id: 'subtotal', name: 'Subtotal', amount: 2600 },
          // The shape the counter store really answers with — measured, sign included.
          { id: 'discount:promo_01M1EYSS8WJX187H8EP44W6N8T', name: 'PRIMEIROCAFE · 10% OFF', amount: -260 },
        ],
        total_amount: 2340,
      }),
      [doc],
    );
    expect(bag.discountLabel).toBe('−R$ 2,60');
    expect(bag.discountTitle).toBe('PRIMEIROCAFE · 10% OFF');
    expect(bag.totalLabel).toBe('R$ 23,40');
  });

  it('shows no discount row at all when the kernel applied none', () => {
    const bag = toBag(view(), [doc]);
    expect(bag.discountLabel).toBeNull();
    expect(bag.discountTitle).toBeNull();
  });

  it('takes each line’s money from `line_total`, never from qty × unit', () => {
    const bag = toBag(
      view({ lines: [{ line_id: 'cl_1', sku_id: 'sku_1', qty: 2, unit_amount: 1300, line_total: 1900 }] }),
      [doc],
    );
    expect(bag.lines[0]?.lineTotalLabel).toBe('R$ 19,00');
  });

  it('labels a variant from the sku’s own option values, in the order the product declares them', () => {
    const bag = toBag(view(), [doc]);
    expect(bag.lines[0]?.variant).toBe('G · Aveia');
    expect(bag.lines[0]?.name).toBe('Cappuccino');
  });

  it('an empty view is an empty bag, not a crash', () => {
    expect(toBag(null, []).count).toBe(0);
  });
});
