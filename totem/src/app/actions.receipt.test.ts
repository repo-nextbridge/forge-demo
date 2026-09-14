// ★★★ WHAT THE COUNTER MAY SAY ABOUT MONEY AFTER AN ORDER EXISTS — and it is the ORDER'S money, always.
//
// ── THE DEFECT, MEASURED AT A COUNTER AND THEN IN THE DATABASE ──────────────────────────────────────────
//
// A customer on the QR screen taps "Trocar forma de pagamento", chooses Pix again and taps "Pagar". The glass
// answers with the SAME order — and `TOTAL A PAGAR R$ 0,00`. Touching the QR then confirms it: "Pagamento
// confirmado", a RESUMO DO PEDIDO with no items in it, "Total pago · Pix R$ 0,00", and the counter calls the
// number. From the queue it reads as an order handed over for free.
//
// ── AND THE KERNEL NEVER SAID ZERO. Read back from the bench's own tables, that same order:
//
//     sales_order     number 212   total_amount 540   status paid
//     payment_intent  amount 540   status approved    ← ONE intent, ONE attempt, for the whole episode
//
// `payment.initiate` takes no amount; it charges the ORDER. So the second charge was correct and only the
// SCREEN was wrong — which is what makes this a defect of this repository and not a question for the port.
//
// ── THE CAUSE, IN ONE LINE. `payWith` captured the CART's bag just before `place_order`. Placing consumes
// the cart's lines and leaves the vessel alive and empty, so the second trip through this function read an
// empty basket and printed it as the price of a real order.
//
// ⇒ THE RULE THESE CASES HOLD: a till may not state about the ORDER what it only knows about ITSELF. The
// receipt and the QR both read `read.order_confirmation`, which stays true however many times anybody pays.
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The cart behind the cookie — the SAME one on both trips, which is what makes the second one the test. */
const CART = 'cart_01SPENT';
const ORDER = 'ord_01M2GNN047XGHWTZSSDX3R5YSC';

/** The lines the customer actually put in the basket, and their money. */
const orderLines = [{ sku_id: 'sku_pao', title: 'Pão de queijo', qty: 1, line_total: 600 }];

/**
 * ★ THE ORDER AS `read.order_confirmation` PUBLISHES IT — shape and numbers taken from the bench row above:
 * one line at 600, a promotion of −60, `total_amount` 540.
 */
const confirmation = {
  number: 212,
  display_status: 'awaiting_payment',
  lines: orderLines,
  totalizers: [
    { id: 'subtotal', name: 'Subtotal', amount: 600 },
    { id: 'discount:promo_01M2G05JXYJGGR8TWRTZ1GZVR7', name: '10% na primeira compra', amount: -60 },
    { id: 'shipping', name: 'Shipping', amount: 0 },
  ],
  total_amount: 540,
};

/**
 * ⚠️ THE CART IS ALREADY SPENT ON BOTH TRIPS, AND THAT IS THE POINT. `place_order` consumed its lines; the
 * vessel survives with identity and no basket. A screen fed from here prints R$ 0,00.
 */
const spentCheckout = {
  cart_id: CART,
  status: 'active',
  lines: [],
  totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 0 }],
  total_amount: 0,
  last_order_id: ORDER,
};

const orderConfirmation = vi.fn();
const placeOrder = vi.fn(async () => ({ order_id: ORDER }));
const initiateCounterPayment = vi.fn(async () => ({
  kind: 'pix_pending',
  copyPaste: '00020126',
  providerRef: 'pospix_abc',
  expiresInSeconds: 900,
}));

vi.mock('@/lib/port', () => ({
  PortRateLimited: class extends Error {},
  totemCommand: () => ({ placeOrder }),
  totemRead: () => ({
    checkout: vi.fn().mockResolvedValue(spentCheckout),
    productsBySkus: vi.fn().mockResolvedValue([]),
    orderConfirmation,
  }),
}));
vi.mock('@/lib/store', () => ({ resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }) }));
vi.mock('@/lib/cart', () => ({
  cartForThisCustomer: vi.fn(async () => CART),
  ensureCartId: vi.fn(async () => CART),
  currentCartId: vi.fn(async () => CART),
  startFresh: vi.fn(async () => CART),
  endSession: vi.fn(async () => undefined),
  readCheckout: vi.fn(async () => spentCheckout),
}));
vi.mock('@/lib/counter-order', () => ({
  prepareForPayment: vi.fn(async () => ({ ok: true, pickupPointName: 'Balcão' })),
}));
vi.mock('@/lib/pos', () => ({
  chooseCounterMethod: vi.fn(async () => undefined),
  initiateCounterPayment: (...a: unknown[]) => initiateCounterPayment(...(a as [])),
  recoverCounterPayment: vi.fn(),
  simulateScan: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { payWith } = await import('./actions');

beforeEach(() => {
  vi.clearAllMocks();
  orderConfirmation.mockResolvedValue(confirmation);
  placeOrder.mockResolvedValue({ order_id: ORDER });
});

describe('paying a second time never charges less than the order', () => {
  it('★★★ the second “Pagar” on a spent cart states the ORDER’s total, not the empty basket’s', async () => {
    const first = await payWith('IVO', 'pix');
    const second = await payWith('IVO', 'pix');
    expect(first.ok && second.ok).toBe(true);
    if (!second.ok) throw new Error('the second attempt was refused');

    // ⛔ WITH THE DEFECT THIS READ `R$ 0,00`, because the bag came from the cart that the first trip spent.
    expect(second.bag.totalLabel).toBe('R$ 5,40');
    expect(second.bag.totalLabel).not.toBe('R$ 0,00');
  });

  it('★★ and it is the SAME order, so the till is not opening a second charge', async () => {
    await payWith('IVO', 'pix');
    await payWith('IVO', 'pix');
    // The cart id is the idempotency key; the kernel replays one order for it. Measured on the bench: one
    // intent and one attempt existed for the whole episode.
    expect(placeOrder).toHaveBeenNthCalledWith(1, 'sto_test', CART, CART);
    expect(placeOrder).toHaveBeenNthCalledWith(2, 'sto_test', CART, CART);
    const second = await payWith('IVO', 'pix');
    expect(second.ok && second.orderId).toBe(ORDER);
  });

  it('★★ the receipt of that second attempt lists what was bought — an empty summary is the same lie', async () => {
    await payWith('IVO', 'pix');
    const second = await payWith('IVO', 'pix');
    if (!second.ok) throw new Error('the second attempt was refused');
    expect(second.bag.lines).toHaveLength(1);
    expect(second.bag.lines[0]?.name).toBe('Pão de queijo');
    expect(second.bag.count).toBe(1);
  });

  it('⛔ and NOTHING on the pay path reads the cart for money any more', async () => {
    // The spent cart answers `total_amount: 0`. If any of the three numbers below could still come from it,
    // one of them would be R$ 0,00.
    const r = await payWith('IVO', 'pix');
    if (!r.ok) throw new Error('refused');
    expect([r.bag.subtotalLabel, r.bag.totalLabel]).toEqual(['R$ 6,00', 'R$ 5,40']);
  });
});

describe('the receipt adds up', () => {
  it('★★ carries the kernel’s own discount rows, so lines − discounts = the total paid', async () => {
    const r = await payWith('IVO', 'pix');
    if (!r.ok) throw new Error('refused');
    // ⛔ THE DEFECT: lines at full price, a smaller total, and nothing between them to explain the gap.
    expect(r.bag.discounts).toEqual([
      { title: '10% na primeira compra', amountLabel: '−R$ 0,60' },
    ]);
    expect(r.bag.subtotalLabel).toBe('R$ 6,00');
    expect(r.bag.totalLabel).toBe('R$ 5,40');
  });

  it('★ and a shipping totalizer is not mistaken for a discount', async () => {
    const r = await payWith('IVO', 'pix');
    if (!r.ok) throw new Error('refused');
    expect(r.bag.discounts.map((d) => d.title)).not.toContain('Shipping');
  });
});

describe('an order the port would not describe', () => {
  it('★★ shows no total rather than a made-up one — `R$ 0,00` is a PRICE, and it never read one', async () => {
    orderConfirmation.mockResolvedValue(null);
    const r = await payWith('IVO', 'pix');
    if (!r.ok) throw new Error('refused');
    expect(r.bag.totalLabel).not.toBe('R$ 0,00');
    expect(r.bag.totalLabel).toBe('—');
    // ⚠️ AND IT IS STILL NOT A REFUSAL: the order is placed and the charge is open by then, so the screen
    // keeps the number and the QR it can still settle.
    expect(r.orderId).toBe(ORDER);
    expect(r.outcome.kind).toBe('pix_pending');
  });
});
