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
import { endSession, ensureCartId, readCheckout } from '@/lib/cart';
import { prepareForPayment } from '@/lib/counter-order';
import { readMenu } from '@/lib/menu';
import { PortRateLimited, totemCommand, totemRead } from '@/lib/port';
import { logPortRefusal } from '@/lib/refusal-log';
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

/**
 * Run a write, and turn the two failures a counter screen must be able to SAY into data rather than a crash.
 *
 * ★★ AND RECORD THE REFUSAL BEFORE TRANSLATING IT (A52, 2026-09-02). The screen's sentence — "Não foi
 * possível concluir. Chame um atendente." — is the right thing to show a customer and the wrong thing to be
 * the ONLY trace: this function used to catch every error, hand back the polite sentence and log nothing, so
 * a totem that refused every single add left a container whose whole log was `✓ Ready in 181ms`. The port had
 * been answering `validation_failed (cart not found)` all along, and nobody could see it. See
 * `lib/refusal-log.ts` for the rule and `app/actions.refusal-voice.test.ts` for the guard that keeps it.
 *
 * The rate-limited branch is logged too, and on purpose: a counter that spends its ten-a-minute budget is the
 * one failure an operator can actually act on while the queue is still standing there.
 */
async function withBag(
  write: () => Promise<unknown>,
  /** The action's name and the ids that locate the refusal. IDS ONLY — never a buyer's details. */
  where: { action: string } & Record<string, string | undefined>,
): Promise<BagResult> {
  const { action, ...context } = where;
  try {
    await write();
    return { ok: true, bag: await currentBag() };
  } catch (error) {
    logPortRefusal(action, context, error);
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
  return withBag(() => totemCommand().addLine(store.id, cartId, skuId, qty), {
    action: 'addItem',
    store: store.id,
    cart: cartId,
    sku: skuId,
  });
}

export async function changeQty(lineId: string, qty: number): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  if (qty <= 0)
    return withBag(() => totemCommand().removeLine(store.id, cartId, lineId), {
      action: 'changeQty(0 → remove)',
      store: store.id,
      cart: cartId,
      line: lineId,
    });
  return withBag(() => totemCommand().updateLine(store.id, cartId, lineId, qty), {
    action: 'changeQty',
    store: store.id,
    cart: cartId,
    line: lineId,
  });
}

export async function removeItem(lineId: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  return withBag(() => totemCommand().removeLine(store.id, cartId, lineId), {
    action: 'removeItem',
    store: store.id,
    cart: cartId,
    line: lineId,
  });
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
  // ⚠️ The code itself is NOT logged: a coupon a customer typed is the one string on this path that is
  // theirs, and a till's log is read over somebody's shoulder.
  return withBag(() => totemCommand().applyCoupon(store.id, cartId, trimmed), {
    action: 'applyCoupon',
    store: store.id,
    cart: cartId,
  });
}

export async function removeCoupon(code: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await ensureCartId();
  return withBag(() => totemCommand().removeCoupon(store.id, cartId, code), {
    action: 'removeCoupon',
    store: store.id,
    cart: cartId,
  });
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
    // The same voice as `withBag`, for the same reason: this is the LAST tap of an order, and a silent
    // refusal here is a customer standing at a screen that will not say what happened.
    logPortRefusal('payWith', { store: store.id, method }, error);
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

// ⚠️ `restartCart` USED TO LIVE HERE, and its removal is half of the A52 fix. Its doc comment called it "the
// recovery path when the pointer refers to a cart the kernel swept" — and NOTHING CALLED IT, in any file, at
// any time (grepped across the repository, 2026-09-02). So the app documented a recovery it did not have, and
// a browser holding an unusable pointer stayed broken for the whole life of the cookie. The recovery is now
// where it can never be forgotten: `ensureCartId` probes before it reuses (see `lib/cart.ts`).

/** The menu, re-read. Used by the screen when the counter store was not yet visible on the first render. */
export async function refreshMenu() {
  return readMenu();
}

/** One product, with its variation axes, for the modal. The kicker is the band the card was tapped in. */
export async function openProduct(handle: string, kicker: string) {
  return readProduct(handle, kicker);
}
