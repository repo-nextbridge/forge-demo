// ★★ WHICH CART EACH ACTION ASKS FOR — the wiring half of the pk9/d1 fix, and the half a rename can undo.
//
// `lib/cart.ts` exports two doors and they are NOT interchangeable:
//
//   · `cartForThisCustomer()` — for a write that BUILDS A BASKET. Refuses a vessel that already landed an
//     order, because that vessel is the previous customer's and reaching it is what made the counter charge
//     R$ 38,61 for R$ 115,83 of coffee (measured; see cart.ts).
//   · `ensureCartId()` — for the PAY path only. Must be allowed to reach a landed vessel, because the cart id
//     is the idempotency key that gives a retry its own order back.
//
// `cart.test.ts` proves the two doors behave differently. This file proves each action walks through the
// right one — the thing that stays true only as long as nobody "unifies" them. It watches the CALL, not the
// import: the actions run for real against a fake cart module and the counters say which door opened.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cartForThisCustomer = vi.fn(async () => 'cart_BASKET');
const ensureCartId = vi.fn(async () => 'cart_PAY');

const checkout = vi.fn().mockResolvedValue(null);
const placeOrder = vi.fn(async () => ({ order_id: 'ord_new' }));

vi.mock('@/lib/port', () => ({
  PortRateLimited: class extends Error {},
  totemCommand: () => ({
    addLine: vi.fn(),
    updateLine: vi.fn(),
    removeLine: vi.fn(),
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
    placeOrder,
  }),
  totemRead: () => ({
    checkout,
    productsBySkus: vi.fn().mockResolvedValue([]),
    orderConfirmation: vi.fn().mockResolvedValue({ number: 42 }),
  }),
}));
vi.mock('@/lib/store', () => ({
  resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }),
}));
vi.mock('@/lib/cart', () => ({
  cartForThisCustomer,
  ensureCartId,
  currentCartId: vi.fn().mockResolvedValue('cart_PAY'),
  startFresh: vi.fn().mockResolvedValue('cart_PAY'),
  endSession: vi.fn().mockResolvedValue(undefined),
  readCheckout: () => checkout(),
}));
vi.mock('@/lib/counter-order', () => ({
  prepareForPayment: vi.fn(async () => ({ ok: true, pickupPointName: 'Balcão' })),
}));
vi.mock('@/lib/pos', () => ({
  chooseCounterMethod: vi.fn(async () => undefined),
  initiateCounterPayment: vi.fn(async () => ({ kind: 'settled' })),
  simulateScan: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { addItem, applyCoupon, changeQty, payWith, removeCoupon, removeItem } = await import(
  './actions'
);

beforeEach(() => {
  cartForThisCustomer.mockClear();
  ensureCartId.mockClear();
  placeOrder.mockClear();
});

describe('every write that builds a basket goes through the door that refuses a landed vessel', () => {
  const basketWrites: [string, () => Promise<unknown>][] = [
    ['addItem', () => addItem('sku_1', 1)],
    ['changeQty', () => changeQty('cl_1', 2)],
    ['changeQty(0 → remove)', () => changeQty('cl_1', 0)],
    ['removeItem', () => removeItem('cl_1')],
    ['applyCoupon', () => applyCoupon('PRIMEIROCAFE')],
    ['removeCoupon', () => removeCoupon('PRIMEIROCAFE')],
  ];

  for (const [name, run] of basketWrites) {
    it(`${name} asks for cartForThisCustomer, never the lenient door`, async () => {
      await run();
      expect(cartForThisCustomer).toHaveBeenCalledTimes(1);
      expect(ensureCartId).not.toHaveBeenCalled();
    });
  }
});

describe('the pay path keeps its leniency — the retry a customer is told to make', () => {
  it('payWith asks for ensureCartId, so a placed-but-unpaid order can still be settled', async () => {
    await payWith('Renan', 'card');
    expect(ensureCartId).toHaveBeenCalledTimes(1);
    expect(cartForThisCustomer).not.toHaveBeenCalled();
  });

  it('★ and it places the order against THAT cart, with the cart id as the idempotency key', async () => {
    await payWith('Renan', 'card');
    // The third argument is the idempotency key (kit: placeOrder(store, cartId, idempotencyKey)). It being
    // the cart id is what makes the retry return the same order — and is exactly why a NEW customer must
    // never arrive here on the previous customer's cart.
    expect(placeOrder).toHaveBeenCalledWith('sto_test', 'cart_PAY', 'cart_PAY');
  });
});
