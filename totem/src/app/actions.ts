'use server';

// EVERY WRITE THE COUNTER MAKES, IN ONE FILE — and every one of them returns the KERNEL'S fresh view of the
// basket, never a patch the browser applies to a copy it was keeping.
//
// ★ WHY THE ACTIONS RETURN STATE INSTEAD OF REVALIDATING. A till has to feel instant and must never flash:
// `router.refresh()` re-renders the whole tree and, on a screen that is one full-bleed panel, that reads as a
// blink between taps. So each action does its write, re-reads `read.checkout`, and hands back the bag. The
// screen swaps one object. Nothing about price, discount or total is ever computed on the client — the
// numbers in the returned bag are the kernel's own, formatted.
//
// ⚠️ THE TWO ORACLE-CAPPED COMMANDS ARE THE REASON SOME OF THIS LOOKS DEFENSIVE. `cart.set_buyer` and
// `cart.apply_coupon` are capped at ten a minute per store+IP, and one totem is one address — so an action
// that fires twice for one tap is not waste, it is somebody's order refused. Measured; see `port.ts`.

import { revalidatePath } from 'next/cache';
import { endSession, ensureCartId, readCheckout, startFresh } from '@/lib/cart';
import { prepareForPayment } from '@/lib/counter-order';
import { readMenu } from '@/lib/menu';
import { PortRateLimited, totemCommand, totemRead } from '@/lib/port';
import { readProduct } from '@/lib/product';
import { chooseCounterMethod, type CounterMethod, initiateCounterPayment, type PosOutcome, simulateScan } from '@/lib/pos';
import { resolveTotemStore } from '@/lib/store';
import { type Bag, EMPTY_BAG, toBag } from '@/lib/view';

/** Re-read the bag from the kernel, joining the product docs the lines need for a name and a photograph. */
async function currentBag(): Promise<Bag> {
  const view = await readCheckout();
  if (!view || view.lines.length === 0) return view ? { ...EMPTY_BAG, cartId: view.cart_id } : EMPTY_BAG;
  const store = resolveTotemStore();
  const docs = await totemRead().productsBySkus(
    store.id,
    view.lines.map((l) => l.sku_id),
  );
  return toBag(view, docs ?? []);
}

export type BagResult =
  | { ok: true; bag: Bag }
  /** The port refused for going too fast. `retryAfterSeconds` is the port's own number, never a guess. */
  | { ok: false; kind: 'rate_limited'; retryAfterSeconds: number; bag: Bag }
  | { ok: false; kind: 'refused'; message: string; bag: Bag };

/** Run a write, and turn the two failures a counter screen must be able to SAY into data rather than a crash. */
async function withBag(write: () => Promise<unknown>): Promise<BagResult> {
  try {
    await write();
    return { ok: true, bag: await currentBag() };
  } catch (error) {
    if (error instanceof PortRateLimited)
      return {
        ok: false,
        kind: 'rate_limited',
        retryAfterSeconds: error.retryAfterSeconds,
        bag: await currentBag(),
      };
    return {
      ok: false,
      kind: 'refused',
      message: error instanceof Error ? error.message : 'unknown',
      bag: await currentBag(),
    };
  }
}

export async function addItem(skuId: string, qty: number): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  return withBag(() => totemCommand().addLine(store.id, cartId, skuId, qty));
}

export async function changeQty(lineId: string, qty: number): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  if (qty <= 0) return withBag(() => totemCommand().removeLine(store.id, cartId, lineId));
  return withBag(() => totemCommand().updateLine(store.id, cartId, lineId, qty));
}

export async function removeItem(lineId: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  return withBag(() => totemCommand().removeLine(store.id, cartId, lineId));
}

/**
 * THE COUPON — one of the two capped commands, and the one a customer can tap repeatedly.
 *
 * ⚠️ THE SCREEN CALLS THIS ONCE PER CART AND NEVER ON A RE-RENDER. Ten attempts a minute is the whole
 * counter's budget, so a coupon field that re-submitted on every keystroke or every screen change would take
 * the till down for a minute with nobody doing anything wrong.
 */
export async function applyCoupon(code: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  const trimmed = code.trim();
  if (!trimmed) return { ok: true, bag: await currentBag() };
  return withBag(() => totemCommand().applyCoupon(store.id, cartId, trimmed));
}

export async function removeCoupon(code: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  return withBag(() => totemCommand().removeCoupon(store.id, cartId, code));
}

export type PayResult =
  | { ok: true; outcome: PosOutcome; orderNumber: number; buyerName: string; bag: Bag }
  | { ok: false; kind: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; kind: 'refused'; message: string };

/**
 * NAME → ADDRESS → METHOD → ORDER → CHARGE, in the order the kernel measured as required.
 *
 * The bag is captured BEFORE `place_order` on purpose: placing an order consumes the cart's lines (the vessel
 * survives, empty), so the confirmation screen's summary has to be read while there is still something to
 * read. That is the same reason the kernel publishes `last_order_id` — see the kit's CheckoutView.
 */
export async function payWith(name: string, method: CounterMethod): Promise<PayResult> {
  const store = resolveTotemStore();
  try {
    const cartId = await ensureCartId();
    const prepared = await prepareForPayment(cartId, name);
    if (!prepared.ok)
      return {
        ok: false,
        kind: 'refused',
        message:
          'esta loja não tem retirada configurada — o balcão não consegue fechar o pedido sem um ponto de retirada',
      };

    await chooseCounterMethod(cartId, method);
    const bag = await currentBag();
    const { order_id } = await totemCommand().placeOrder(store.id, cartId, cartId);
    const outcome = await initiateCounterPayment(order_id, method);

    const confirmation = await totemRead().orderConfirmation(store.id, order_id);
    return {
      ok: true,
      outcome,
      // ★ THE NUMBER ON THE GIANT CARD IS THE KERNEL'S PER-STORE SEQUENCE (`order.number`), not an id and not
      // anything this screen invented. It is what the barista will call out.
      orderNumber: confirmation?.number ?? 0,
      buyerName: name.trim(),
      bag,
    };
  } catch (error) {
    if (error instanceof PortRateLimited)
      return { ok: false, kind: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
    return {
      ok: false,
      kind: 'refused',
      message: error instanceof Error ? error.message : 'unknown',
    };
  }
}

/** The prototype's "toque no QR para simular". Success is 200 AND `ok:true` — see `pos.ts`. */
export async function simulatePixPayment(providerRef: string): Promise<{ paid: boolean; reason?: string }> {
  return simulateScan(providerRef);
}

/**
 * ★★ THE RESET BETWEEN CUSTOMERS. Destroys the cart POINTER, so the next person starts empty.
 *
 * `revalidatePath('/')` is deliberate here and nowhere else: this is the one moment the whole screen SHOULD
 * be rebuilt from scratch, because the point is that nothing of the previous customer survives — including
 * anything Next was holding for the route.
 */
export async function resetCounter(): Promise<{ bag: Bag }> {
  await endSession();
  revalidatePath('/');
  return { bag: EMPTY_BAG };
}

/** A fresh cart on demand — the recovery path when the pointer refers to a cart the kernel swept. */
export async function restartCart(): Promise<BagResult> {
  await startFresh();
  return { ok: true, bag: await currentBag() };
}

/** The menu, re-read. Used by the screen when the counter store was not yet visible on the first render. */
export async function refreshMenu() {
  return readMenu();
}

/** One product, with its variation axes, for the modal. The kicker is the band the card was tapped in. */
export async function openProduct(handle: string, kicker: string) {
  return readProduct(handle, kicker);
}
