// THE COUNTER'S BASKET — a pointer in a cookie, a basket in the kernel, and a reset between customers.
//
// ★ NOTHING ABOUT THE BASKET IS HELD IN THIS PROCESS. The browser holds a cart id (the kit's `forge_cart`,
// httpOnly, with the kit's own attributes); the kernel holds the lines, the prices, the promotions and the
// total. Every screen re-reads `read.checkout`, which joins the LIVE sku amount and re-runs the promotion
// engine on each call. That is what makes two of this slice's acceptance criteria facts instead of
// arithmetic: the coupon takes exactly 10% because the kernel took it, and a coffee costs the same here as
// it does in the online shop because it is the same SKU read from the same place.
//
// ★★ THE RESET BETWEEN CUSTOMERS IS THE POINT OF A KIOSK, AND IT IS THE POINTER THAT IS DESTROYED, not the
// basket. Deleting the cookie is the whole mechanism: the next person to touch the screen has no cart id, so
// their first "Adicionar" mints a fresh cart. The abandoned one is left to the kernel's own sweeper
// (`cart_ttl_days`), which is the component whose job that is — a screen that tidied the database would be
// doing housekeeping with a customer waiting, and would still leave a row behind on a power cut.
//
// ⚠️ THE COOKIE IS httpOnly, SO ONLY A SERVER ACTION CAN CLEAR IT. That is not an inconvenience, it is the
// reason the reset can be trusted: nothing the idle screen does in the browser can leave the pointer behind.

import { CART_COOKIE, cartCookieOptions } from '@forgecommerce/storefront-kit/cart-cookie';
import type { CheckoutView } from '@forgecommerce/storefront-kit/read-client';
import { cookies } from 'next/headers';
import { totemCommand, totemRead } from './port';
import { resolveTotemStore } from './store';

/** The cart id this browser is holding, or undefined when nobody has started an order. */
export async function currentCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value || undefined;
}

/** The cart id to write to, minting one if this is the first touch of a new customer. */
export async function ensureCartId(): Promise<string> {
  return (await currentCartId()) ?? (await startFresh());
}

/** Mint a new cart and point this browser at it. Also the recovery path for a pointer gone stale. */
export async function startFresh(): Promise<string> {
  const store = resolveTotemStore();
  const { cart_id } = await totemCommand().createCart(store.id);
  (await cookies()).set(CART_COOKIE, cart_id, cartCookieOptions());
  return cart_id;
}

/**
 * END OF ONE CUSTOMER'S SESSION — what the attract screen falls back to.
 *
 * Destroys the POINTER, which is the only thing that could leak from one person to the next. Idempotent: a
 * screen that resets twice (a timeout firing as somebody walks away) is not a special case.
 */
export async function endSession(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}

/** The live orderForm view of this browser's cart, or null when there is no cart to read. */
export async function readCheckout(): Promise<CheckoutView | null> {
  const cartId = await currentCartId();
  if (!cartId) return null;
  const store = resolveTotemStore();
  return totemRead().checkout(store.id, cartId);
}
