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

/**
 * ★★ IS THE POINTER THIS BROWSER IS HOLDING STILL A CART OF THIS COUNTER? — the question A52 was the answer to.
 *
 * ── THE DEFECT, MEASURED (2026-09-02) ─────────────────────────────────────────────────────────────────────
 *
 * "não consigo add nenhum sku no totem". `ensureCartId` used to trust the cookie blindly, so a `forge_cart`
 * that named a cart this store cannot see made EVERY add fail, FOREVER, for that browser — the pointer was
 * never rewritten and nothing ever probed it. Reproduced against the live counter through its own server
 * action, with a pointer the counter does not own:
 *
 *     addItem(sku_…, 1) with Cookie: forge_cart=<a cart of the COFFEE SHOP>
 *     → {"ok":false,"kind":"refused","message":"command cart.add_line failed: validation_failed (cart not found)"}
 *
 * ── AND THE POINTER REALLY DOES ARRIVE FROM THE OTHER SHOP, because COOKIES IGNORE THE PORT (RFC 6265 §8.5).
 * On the bench the coffee vitrine and this totem are the SAME HOST on two ports, and `forge_cart` is a
 * FROZEN name shared by every Forge front (`storefront-kit/cookies.ts`). So a customer who browsed the shop
 * and then walked up to the counter handed the till the shop's cart id. A cart the kernel swept, or one left
 * by a previous seed of this box, produces the same dead end.
 *
 * ── WHY A PROBE AND NOT A RETRY. The kit's own `ensureCart` (checkout-flow.ts) already answers this exact
 * question for the reference storefront — reuse the cookie only while it names an ACTIVE cart, otherwise mint
 * and rebind — and this is that rule, not a second one. Retrying a refused write would have to decide which
 * commands are safe to send twice, and two of this app's path are capped at ten a minute.
 *
 * ⚠️ A READ BLIP MUST NOT THROW AWAY A LIVE BASKET, so a probe that FAILS reuses the pointer. The common case
 * is a healthy cart; losing a customer's order because one read timed out would be a worse defect than the
 * one this closes.
 *
 * ★★ AND IT READS `read.checkout`, NOT `read.cart`, BECAUSE `status` ALONE CANNOT ANSWER IT (pk9/d1, 04/09).
 * The kernel's cart SURVIVES its own order — "the vessel does NOT die here: the order consumes its lines and
 * the vessel keeps identity/buyer/address for the next voyage" (packages/core/src/commands/checkout.ts) — so
 * a cart that has already become an order reads back `status: "active"` with zero lines. Measured against the
 * live counter, seconds after a completed order:
 *
 *     GET /v1/read/cart?…      → {"status":"active","lines":[]}                     ← says nothing
 *     GET /v1/read/checkout?…  → {"status":"active","lines":[],
 *                                 "last_order_id":"ord_…","last_order_at":"…"}      ← says everything
 *
 * `last_order_id` is the only published fact that tells a landed vessel from a fresh one, and the kit's own
 * `CartView` says so in prose. One read answers both questions, so the probe moved rather than doubled.
 */
async function probePointer(
  cartId: string,
): Promise<{ writable: boolean; landedOrderId: string | null } | null> {
  const store = resolveTotemStore();
  try {
    const view = await totemRead().checkout(store.id, cartId);
    // `null` is the port answering 404 — this store does not have that cart (foreign, swept, or from an
    // older box). Any status but `active` is a cart that `cart.add_line` would refuse anyway.
    if (view === null || view.status !== 'active') return { writable: false, landedOrderId: null };
    return { writable: true, landedOrderId: view.last_order_id ?? null };
  } catch {
    // The read blip. `null` means "the port did not answer", which is NOT the same as "the pointer is bad".
    return null;
  }
}

/**
 * The cart id to write to, minting one if this is the first touch of a new customer — or if the pointer this
 * browser brought is not a cart this counter can write to. See `probePointer`.
 *
 * ⚠️ IT DELIBERATELY ACCEPTS A VESSEL THAT HAS ALREADY LANDED AN ORDER, and `cartForThisCustomer` below is
 * the one that does not. The difference is the whole of the pk9/d1 fix — read it there before changing either.
 */
export async function ensureCartId(): Promise<string> {
  const existing = await currentCartId();
  if (!existing) return startFresh();
  const probe = await probePointer(existing);
  if (probe === null || probe.writable) return existing;
  // The one line that says a customer's pointer was discarded. Without it this recovery is invisible, and
  // an invisible recovery is how the NEXT version of A52 gets debugged from scratch.
  console.error(
    `[totem] discarding a cart pointer this counter cannot write to (cart=${existing}) — minting a fresh cart`,
  );
  return startFresh();
}

/**
 * ★★ THE CART A CUSTOMER IS PUTTING ITEMS INTO — never the previous customer's spent vessel (pk9/d1, 04/09).
 *
 * ── THE REPORTED DEFECT, AND THE MEASUREMENT ──────────────────────────────────────────────────────────────
 *
 * An order taken all the way to the end and then a plain page RELOAD: a second order can be started but not
 * finished — it reaches the payment step and errors there. The till's own container log, from that session,
 * five times over:
 *
 *     [totem] payWith refused by the port — payment.initiate · validation_failed: order not payable
 *
 * A RELOAD is the one way out of this flow that never reaches `resetCounter`: the cookie is httpOnly and
 * survives, the React state does not, so the screen comes back on the attract panel holding the pointer of a
 * cart that has ALREADY become an order. Reproduced end to end against the live counter:
 *
 *     cart.add_line   on the landed vessel                        → 200   (the kernel allows it: new voyage)
 *     checkout.place_order, idempotency-key = the CART id         → 200, and the OLD order_id
 *     payment.initiate on that order                              → 400 validation_failed
 *                                                                   {"message":"order not payable",
 *                                                                    "details":{"status":"paid"}}
 *
 * ── ⚠️ AND THE REFUSAL IS THE HARMLESS HALF. The port only says "not payable" when the first order was
 * actually PAID. When it was placed and NOT paid — a customer who reloaded while the pix QR was on the glass —
 * `payment.initiate` answers 200 and charges the WRONG ORDER. Measured, same box, same minute:
 *
 *     customer 1: one coffee   → order #223, total 3861, pending_payment
 *     customer 2 (after the reload): three coffees, and read.checkout says total_amount 11583
 *     tap "Pagar" → place_order replays #223 → payment_intent pay_…DE86Q4 amount 3861
 *
 * R$ 115,83 on the glass, R$ 38,61 charged, three coffees handed over against an order that says one, and
 * customer 2's lines still sitting in the cart having never become an order at all.
 *
 * ── WHY THE IDEMPOTENCY KEY IS NOT THE THING TO FIX. `payWith` sends the cart id as `idempotency-key`, and
 * the kernel stores those forever, keyed by (tenant, key), with no command name and no TTL
 * (`command_idempotency`, PK on two columns). So the SAME cart can only ever produce ONE order through this
 * till. That is correct for what the key is FOR — a retry after `payment.initiate` failed has to get its order
 * back, which is exactly the `rate_limited` branch of `payWith` telling a customer to try again in N seconds.
 * What is wrong is reaching that key with a NEW customer's basket. So the vessel is what gets refused, at the
 * moment a new basket starts, and `ensureCartId` stays lenient for the pay path.
 *
 * ★ THE PAY PATH CAN NEVER BE THE FIRST WRITE OF A VOYAGE — the screen's own `readyToPay` demands
 * `bag.count > 0`, so an item was added first, and this function already ran. That is what makes the split
 * safe rather than merely convenient.
 */
export async function cartForThisCustomer(): Promise<string> {
  const existing = await currentCartId();
  if (!existing) return startFresh();
  const probe = await probePointer(existing);
  if (probe === null) return existing; // the read blip: never throw away a live basket over one timeout
  if (probe.writable && probe.landedOrderId === null) return existing;
  console.error(
    probe.landedOrderId
      ? `[totem] the cart pointer this browser brought has already landed order ${probe.landedOrderId} ` +
          `(cart=${existing}) — that session ended; minting a fresh cart for the next customer`
      : `[totem] discarding a cart pointer this counter cannot write to (cart=${existing}) — minting a fresh cart`,
  );
  return startFresh();
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
