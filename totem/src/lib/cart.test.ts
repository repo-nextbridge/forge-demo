// ★★ THE POINTER THIS BROWSER BROUGHT, AND WHETHER THIS COUNTER MAY WRITE TO IT — the A52 fix, measured.
//
// The reproduction that produced this file, against the LIVE counter through its own server action:
//
//     addItem(sku_…, 1) with Cookie: forge_cart=<a cart created on the COFFEE SHOP's store>
//     → {"ok":false,"kind":"refused","message":"command cart.add_line failed: validation_failed (cart not found)"}
//
// and the same answer for a cart id from a previous seed of the box. It never recovered, because the cookie
// was reused unconditionally and nothing rewrote it. On the bench the shop and the totem are the same HOST on
// two ports, and cookies ignore the port (RFC 6265 §8.5) — so the shop's `forge_cart` really is what the till
// receives.
//
// ★★ AND THE SECOND HALF OF THE FILE IS pk9/d1 (04/09): THE POINTER OF A CART THAT ALREADY BECAME AN ORDER.
// The kernel's cart survives its own landing as an ACTIVE, EMPTY vessel, so `status` cannot tell one from a
// basket nobody has filled yet — `last_order_id` is the only fact that can. A reload is the one exit from the
// counter's flow that never reaches `resetCounter`, so the next customer inherits that pointer, and the till
// answered them (measured, live counter):
//
//     cart.add_line on the landed vessel                     → 200
//     checkout.place_order, idempotency-key = the CART id    → 200, and the PREVIOUS order_id
//     payment.initiate on it                                 → 400 validation_failed "order not payable"
//                                                              {"status":"paid"}
//
// …and, when the previous order had NOT been paid, → 200 and a charge for the WRONG amount: R$ 115,83 on the
// glass, `payment_intent.amount` 3861. See `cartForThisCustomer` in cart.ts for the whole measurement.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const jar = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) as string } : undefined),
  set: (name: string, value: string) => void jar.set(name, value),
  delete: (name: string) => void jar.delete(name),
};

vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

/** The probe reads `read.checkout` — the only projection that publishes `last_order_id`. See cart.ts. */
const readCheckout = vi.fn();
const createCart = vi.fn(async () => ({ cart_id: 'cart_MINTED' }));
vi.mock('./port', () => ({
  totemRead: () => ({ checkout: readCheckout, cart: vi.fn() }),
  totemCommand: () => ({ createCart }),
}));
vi.mock('./store', () => ({ resolveTotemStore: () => ({ id: 'sto_balcao', handle: 'balcao' }) }));

const { cartForThisCustomer, ensureCartId } = await import('./cart');

/** A live basket: this counter's cart, still open, no voyage behind it. */
const live = {
  cart_id: 'cart_OWN',
  store_id: 'sto_balcao',
  status: 'active',
  lines: [],
  last_order_id: null,
  last_order_at: null,
};

/**
 * ★ THE SHAPE THE DEFECT WEARS, AND IT IS WHY THIS FIXTURE IS NOT A MISTAKE: `status` really is `active` and
 * `lines` really is empty. Copied from the live port's answer seconds after a completed counter order.
 */
const landed = {
  ...live,
  last_order_id: 'ord_PREVIOUS',
  last_order_at: '2026-09-04T17:43:27.350Z',
};

beforeEach(() => {
  jar.clear();
  readCheckout.mockReset();
  createCart.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ensureCartId — the cart the CURRENT voyage writes to', () => {
  it('mints when there is no pointer at all — the first touch of a new customer', async () => {
    expect(await ensureCartId()).toBe('cart_MINTED');
    expect(readCheckout).not.toHaveBeenCalled();
    expect(jar.get('forge_cart')).toBe('cart_MINTED');
  });

  it('reuses a pointer that names an ACTIVE cart of THIS counter — one basket per customer, still', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockResolvedValue(live);

    expect(await ensureCartId()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it("★ A52 — discards the pointer the port does not recognise (the coffee shop's cart, a swept cart, an old seed)", async () => {
    jar.set('forge_cart', 'cart_FROM_THE_SHOP');
    readCheckout.mockResolvedValue(null); // read.checkout scoped to this store answers 404 → the kit returns null

    expect(await ensureCartId()).toBe('cart_MINTED');
    // …and REBINDS the cookie, which is what makes the recovery permanent instead of once per tap.
    expect(jar.get('forge_cart')).toBe('cart_MINTED');
    expect(readCheckout).toHaveBeenCalledWith('sto_balcao', 'cart_FROM_THE_SHOP');
  });

  it('discards a cart this counter owns but may no longer write to (any status but active)', async () => {
    jar.set('forge_cart', 'cart_OLD');
    readCheckout.mockResolvedValue({ ...live, cart_id: 'cart_OLD', status: 'converted' });

    expect(await ensureCartId()).toBe('cart_MINTED');
  });

  it('⚠️ a READ BLIP must not throw away a live basket: an unanswered probe reuses the pointer', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockRejectedValue(new Error('the port did not answer'));

    expect(await ensureCartId()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it('says out loud that it threw a pointer away — an invisible recovery is the next A52', async () => {
    jar.set('forge_cart', 'cart_FROM_THE_SHOP');
    readCheckout.mockResolvedValue(null);
    const said: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(
      (...a: unknown[]) => void said.push(a.map(String).join(' ')),
    );

    await ensureCartId();

    expect(said.join('\n')).toContain('cart_FROM_THE_SHOP');
  });

  /**
   * ★★ THE LENIENCY THAT MUST SURVIVE — the retry a customer is TOLD to make.
   *
   * `payWith` places the order and then initiates the charge; when the second half fails (the port's ten-a-
   * minute cap is the branch that says "tente de novo em N segundos"), the order already exists. That retry
   * has to reach the SAME vessel, because the cart id is the idempotency key that gets that same order back.
   * Minting here would leave a placed order nobody can pay and a customer told to try again.
   */
  it('★ REUSES a vessel that has already landed an order — that is the pay retry, not a new customer', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockResolvedValue(landed);

    expect(await ensureCartId()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });
});

describe('cartForThisCustomer — the cart a NEW basket goes into (pk9/d1)', () => {
  it('reuses a live basket: an order in progress is not interrupted between taps', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockResolvedValue(live);

    expect(await cartForThisCustomer()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it('★★ MINTS when the pointer names a vessel that ALREADY LANDED AN ORDER — the reported reload', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockResolvedValue(landed);

    expect(await cartForThisCustomer()).toBe('cart_MINTED');
    // The cookie is REBOUND, so the second customer's whole order — buyer, address, idempotency key — is
    // theirs. Leaving the pointer behind is what charged the previous order's amount.
    expect(jar.get('forge_cart')).toBe('cart_MINTED');
  });

  it('★★ and `status` alone would have said nothing: the landed vessel reads back ACTIVE and EMPTY', async () => {
    // The guard for the guard. If this fixture ever stops being `active` with no lines, the defect it stands
    // for has changed shape and the fix above is no longer proven by it.
    expect(landed.status).toBe('active');
    expect(landed.lines).toHaveLength(0);
    expect(landed.last_order_id).not.toBeNull();
  });

  it('names the landed order in the log — the operator has to know the previous order was registered', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockResolvedValue(landed);
    const said: string[] = [];
    vi.spyOn(console, 'error').mockImplementation(
      (...a: unknown[]) => void said.push(a.map(String).join(' ')),
    );

    await cartForThisCustomer();

    expect(said.join('\n')).toContain('ord_PREVIOUS');
  });

  it('⚠️ a READ BLIP still reuses the pointer here too — one timeout must not empty a live basket', async () => {
    jar.set('forge_cart', 'cart_OWN');
    readCheckout.mockRejectedValue(new Error('the port did not answer'));

    expect(await cartForThisCustomer()).toBe('cart_OWN');
    expect(createCart).not.toHaveBeenCalled();
  });

  it('mints on a foreign or swept pointer, exactly as A52 requires', async () => {
    jar.set('forge_cart', 'cart_FROM_THE_SHOP');
    readCheckout.mockResolvedValue(null);

    expect(await cartForThisCustomer()).toBe('cart_MINTED');
  });
});
