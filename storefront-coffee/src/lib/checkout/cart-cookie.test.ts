// ★★ THE CART SURVIVES THE WINDOW THAT OPENED IT — and what comes back is TODAY'S basket, not last week's.
//
// Two halves, and the second is the one that matters commercially.
//
// ① THE POINTER PERSISTS. `forge_cart` used to be written with no expiry at all, which is a SESSION cookie:
//    the QA measured `expires=-1` and lost the cart to every window close (s2b-5). All THREE writers are
//    asserted here — the guest add, the OTP login and the social callback — because two of them passed no
//    options whatsoever and Next only defaults `path`, so signing in also stripped `HttpOnly` off the pointer.
//
// ② THE AGED CART IS RE-PRICED, NOT HONOURED. Making a cart last days is only safe because the browser holds
//    a POINTER and never a basket: `cart_line` has no price column (tenant/0010) and `read.checkout` joins the
//    live `sku.amount` and re-runs the promotion engine on every read. The test that proves this slice is
//    therefore the cart REOPENED a week later against a catalog that moved underneath — a price that rose, a
//    product taken off the air — and the assertion is that the screen carries the kernel's CURRENT numbers and
//    the kernel's CURRENT verdicts. A cart that came back showing the price of the sitting that filled it
//    would be the defect this slice would have introduced.
//
// The cart the sweeper already destroyed is the third case, and it is proven next door
// (checkout-flow.test.ts, "ensureCart reuses an ACTIVE cart, mints fresh on a CONVERTED/unknown one"): a
// pointer that outlives its cart mints a new one instead of resurrecting anything.

import { enrichLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { jarSet, jarGet, createCart, addLine, readCart, readCheckout } = vi.hoisted(() => ({
  jarSet: vi.fn(),
  jarGet: vi.fn((_name: string): { value: string } | undefined => undefined),
  createCart: vi.fn(async () => ({ cart_id: 'cart_01M1' })),
  addLine: vi.fn(async () => {}),
  readCart: vi.fn(async (_store: string, _cartId: string): Promise<unknown> => null),
  readCheckout: vi.fn(async (_store: string, _cartId: string): Promise<unknown> => null),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: jarGet, set: jarSet, delete: vi.fn() }),
}));
vi.mock('@forgecommerce/storefront-kit/kernel-write-clients', () => ({
  commandClient: () => ({ createCart, addLine }),
  customerClient: () => ({}),
}));
vi.mock('@forgecommerce/storefront-kit/config', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readClient: () => ({ cart: readCart, checkout: readCheckout }),
}));

const DAYS = 24 * 60 * 60;

beforeEach(() => {
  vi.clearAllMocks();
  jarGet.mockReturnValue(undefined);
  readCart.mockResolvedValue(null);
});

afterEach(() => {
  delete process.env.FORGE_STOREFRONT_SECURE_COOKIE;
});

/** The attributes of the single `set` the call under test performed. */
function written(): { name: string; value: string; options: Record<string, unknown> } {
  expect(jarSet).toHaveBeenCalledTimes(1);
  const [name, value, options] = jarSet.mock.calls[0] as [string, string, Record<string, unknown>];
  return { name, value, options: options ?? {} };
}

// ── ① the pointer persists ───────────────────────────────────────────────────────────────────────────────

test('★★ the guest add writes a cart cookie that OUTLIVES the browser window (this is s2b-5)', async () => {
  const { CART_COOKIE, CART_COOKIE_MAX_AGE_SECONDS } = await import(
    '@forgecommerce/storefront-kit/cart-cookie'
  );
  const { addToCartAction } = await import('@/lib/cart-actions');

  await addToCartAction('demo', 'sku_1');

  const { name, options } = written();
  expect(name).toBe(CART_COOKIE);
  // The defect, named as an assertion: no maxAge and no expires IS a session cookie.
  expect(options.maxAge).toBe(CART_COOKIE_MAX_AGE_SECONDS);
  expect(options.maxAge).toBeGreaterThanOrEqual(2 * DAYS); // "days", the thing the shopper was promised
});

test('★ the window is a WEEK, and it is bounded — a cart pointer is not a permanent handle on a visitor', async () => {
  const { CART_COOKIE_MAX_AGE_SECONDS } = await import('@forgecommerce/storefront-kit/cart-cookie');
  expect(CART_COOKIE_MAX_AGE_SECONDS).toBe(7 * DAYS);
  // ⚠️ The privacy limit, as a test: this cookie may last days and may NOT last a season. The kernel's own
  // `cart_ttl_days` (90 by default) is a RETENTION number and deliberately not this one.
  expect(CART_COOKIE_MAX_AGE_SECONDS).toBeLessThan(30 * DAYS);
});

test('★ it stays server-only, first-party and same-site — persistence changed the LIFETIME, nothing else', async () => {
  const { addToCartAction } = await import('@/lib/cart-actions');
  await addToCartAction('demo', 'sku_1');

  const { options } = written();
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe('lax');
  expect(options.path).toBe('/');
});

test('★ Secure wherever the instance says it serves over HTTPS', async () => {
  process.env.FORGE_STOREFRONT_SECURE_COOKIE = '1';
  const { addToCartAction } = await import('@/lib/cart-actions');
  await addToCartAction('demo', 'sku_1');

  expect(written().options.secure).toBe(true);
});

test('★★ the cookie carries the cart ID AND NOTHING ELSE — no PII rides in the browser', async () => {
  const { addToCartAction } = await import('@/lib/cart-actions');
  createCart.mockResolvedValueOnce({ cart_id: 'cart_01M13589036FR7SHGSJT357WGP' });

  await addToCartAction('demo', 'sku_1');

  // A prefixed, sortable kernel id — the house's own id shape, and the only shape this cookie may hold. It
  // names no person, no address and no price; everything the screen shows is re-read through the port.
  expect(written().value).toMatch(/^cart_[0-9A-HJKMNP-TV-Z]+$/);
});

test('★★ SIGNING IN keeps the same attributes — the login path used to emit the pointer with none at all', async () => {
  const { CART_COOKIE, cartCookieOptions } = await import(
    '@forgecommerce/storefront-kit/cart-cookie'
  );
  const { applyLoginCartPolicy } = await import(
    '@forgecommerce/storefront-kit/checkout/login-cart-policy'
  );

  // The policy adopts the cart this account left live (branch 2), which is when the cookie gets rebound.
  const outcome = await applyLoginCartPolicy(
    {
      myCart: async () => ({ cart_id: 'cart_01ACCOUNT', lines: [] }),
      linkCart: async () => ({}),
      sessionCart: async () => ({ lines: [] }),
    },
    'demo',
    'cst_token',
    'cart_01OLD',
  );
  expect(outcome).toEqual({ cartId: 'cart_01ACCOUNT', branch: 'adopted' });

  // What the two login writers (account/actions.ts and the social callback) now hand Next, verbatim.
  const opts = cartCookieOptions();
  expect(opts).toEqual({
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * DAYS,
  });
  expect(CART_COOKIE).toBe('forge_cart');
});

// ── ② the aged cart, reopened ────────────────────────────────────────────────────────────────────────────

test('★★ A CART REOPENED A WEEK LATER shows the kernel’s prices of TODAY, never the ones it was filled at', async () => {
  const { CART_COOKIE } = await import('@forgecommerce/storefront-kit/cart-cookie');
  const { resolveState } = await import('@forgecommerce/storefront-kit/checkout/checkout-flow');

  // The sitting that filled the basket: two lines, 19990 and 70000.
  const filled = {
    cart_id: 'cart_01OLD',
    status: 'active',
    lines: [
      { line_id: 'ln_1', sku_id: 'sku_a', qty: 1, unit_amount: 19990, line_total: 19990 },
      { line_id: 'ln_2', sku_id: 'sku_b', qty: 1, unit_amount: 70000, line_total: 70000 },
    ],
    total_amount: 89990,
  };
  // A WEEK LATER, against the same cart id: the merchant raised one price and took the other product off the
  // air. The kernel answers with both facts (`unit_amount` re-read from the live sku; `sellable` from QA5 · A6).
  const today = {
    ...filled,
    lines: [
      { ...filled.lines[0], unit_amount: 24990, line_total: 24990 },
      { ...filled.lines[1], sellable: false },
    ],
    total_amount: 94990,
  };

  jarGet.mockImplementation((name: string) =>
    name === CART_COOKIE ? { value: 'cart_01OLD' } : undefined,
  );
  readCheckout.mockResolvedValue(today);

  const state = await resolveState({
    store: 'demo',
    commands: {} as never,
    reads: { checkout: (s: string, c: string) => readCheckout(s, c) } as never,
    cookies: { get: () => 'cart_01OLD', set: () => {}, delete: () => {} },
  });

  expect(state.phase).toBe('cart');
  if (state.phase !== 'cart') throw new Error('unreachable');
  const [risen, pulled] = state.checkout.lines;
  if (!risen || !pulled) throw new Error('the reopened cart lost its lines');

  // ★ The price the shopper comes back to is the CURRENT one. Nothing was carried over from the old sitting.
  expect(risen.unit_amount).toBe(24990);
  expect(state.checkout.total_amount).toBe(94990);
  expect(state.checkout.total_amount).not.toBe(filled.total_amount);

  // ★ And a product that went off the air while the cart waited is NAMED, never quietly sold: the kernel's
  // verdict is relayed to the screen as `unavailable` (and `place_order` refuses the same line).
  const index = new Map();
  expect(enrichLine(pulled, index).unavailable).toBe(true);
  expect(enrichLine(risen, index).unavailable).toBeUndefined();
});
