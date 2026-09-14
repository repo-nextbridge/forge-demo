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
import { cartForThisCustomer, endSession, ensureCartId, readCheckout } from '@/lib/cart';
import { couponRefusal } from '@/lib/coupon';
import { prepareForPayment } from '@/lib/counter-order';
import { readMenu } from '@/lib/menu';
import { PortRateLimited, totemCommand, totemRead } from '@/lib/port';
import { logPortRefusal } from '@/lib/refusal-log';
import { readProduct } from '@/lib/product';
import {
  chooseCounterMethod,
  type CounterMethod,
  initiateCounterPayment,
  type PosOutcome,
  recoverCounterPayment,
  simulateScan,
} from '@/lib/pos';
import { resolveTotemStore } from '@/lib/store';
import { type Bag, bagOfOrder, EMPTY_BAG, toBag, UNREADABLE_ORDER_BAG } from '@/lib/view';

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
  /**
   * ★★ THE CUSTOMER'S OWN MISTAKE, TOLD APART FROM OURS (s5-2, 03/09). A coupon that does not exist is not a
   * broken till, and the screen must not answer it with "chame um atendente" — the person who dropped a letter
   * needs to fix the letter. `refused` stays the SYSTEM voice; this one is the shopper's.
   */
  | { ok: false; kind: 'coupon'; message: string; bag: Bag }
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
  /**
   * ★ WHERE A CALLER GETS TO READ THE REFUSAL BEFORE IT IS FLATTENED (s5-2, 03/09).
   *
   * ⚠️ AND IT HAS TO BE HERE RATHER THAN AT THE CALL SITE, which is the trap this parameter exists to close:
   * the `refused` branch below keeps `error.message` and throws the rest of the error away, and the kernel's
   * reason lives in `details.reason`, not in the message. The kit's `CommandFailed` message reads
   * `command cart.apply_coupon failed: validation_failed (this coupon does not exist)` — the word
   * `coupon_not_found` is nowhere in it. A caller handed the flattened result can only guess, which is how a
   * customer's typo became "chame um atendente" in the first place.
   */
  refine?: (error: unknown) => { kind: 'coupon'; message: string } | null,
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
    const refined = refine?.(error) ?? null;
    if (refined) return { ok: false, ...refined, bag: await currentBag() };
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
  const cartId = await cartForThisCustomer();
  return withBag(() => totemCommand().addLine(store.id, cartId, skuId, qty), {
    action: 'addItem',
    store: store.id,
    cart: cartId,
    sku: skuId,
  });
}

export async function changeQty(lineId: string, qty: number): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await cartForThisCustomer();
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
  const cartId = await cartForThisCustomer();
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
  const cartId = await cartForThisCustomer();
  const trimmed = code.trim();
  if (!trimmed) return { ok: true, bag: await currentBag() };
  // ⚠️ The code itself is NOT logged: a coupon a customer typed is the one string on this path that is
  // theirs, and a till's log is read over somebody's shoulder.
  return withBag(
    () => totemCommand().applyCoupon(store.id, cartId, trimmed),
    { action: 'applyCoupon', store: store.id, cart: cartId },
    couponRefusal,
  );
}

export async function removeCoupon(code: string): Promise<BagResult> {
  const store = resolveTotemStore();
  const cartId = await cartForThisCustomer();
  return withBag(() => totemCommand().removeCoupon(store.id, cartId, code), {
    action: 'removeCoupon',
    store: store.id,
    cart: cartId,
  });
}

export type PayResult =
  | {
      ok: true;
      outcome: PosOutcome;
      /**
       * ★ THE ORDER'S ID TRAVELS TO THE SCREEN, and it is not a secret: `read.order_confirmation` and
       * `read.payment` are public, PII-limited reads keyed on exactly this, and the browser holding it is the
       * one that placed the order. It is what lets the glass hand the order back — see the counter's idle
       * clock, which parks a live payment instead of forgetting it.
       */
      orderId: string;
      orderNumber: number;
      buyerName: string;
      bag: Bag;
    }
  | { ok: false; kind: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; kind: 'refused'; message: string };

/**
 * NAME → ADDRESS → METHOD → ORDER → CHARGE, in the order the kernel measured as required.
 *
 * ★★★ AND WHAT COMES BACK IS THE **ORDER'S** MONEY, NEVER THE CART'S — the fix for a counter that closed a
 * real order for R$ 0,00 with a receipt listing nothing.
 *
 * ── THE DEFECT, MEASURED ON THE BENCH (order 212 of the counter store) ──────────────────────────────────
 * This used to capture `currentBag()` just before `place_order`, because placing consumes the cart's lines
 * and the vessel survives EMPTY. That reading is correct exactly once. A customer who taps "Trocar forma de
 * pagamento" on the QR screen and pays again arrives here a SECOND time on the same, now spent, cart — so
 * `currentBag()` answers an empty basket and the glass prints `TOTAL A PAGAR R$ 0,00` over a live QR and a
 * receipt with no items at all.
 *
 * ── AND THE KERNEL NEVER SAID ZERO. Read back from the bench's own database, that same order:
 *
 *     sales_order   number 212   total_amount 540   status paid
 *     payment_intent  amount 540   status approved   (ONE intent, ONE attempt)
 *
 * `payment.initiate` takes no amount — it charges the ORDER — so the second charge was right and only the
 * SCREEN was wrong. The rule the fix restates: a till may not say about the ORDER what it only knows about
 * ITSELF. `read.order_confirmation` publishes the lines, the totalizers and `total_amount` of what was
 * actually placed, which is the one source that stays true however many times this runs.
 */
export async function payWith(name: string, method: CounterMethod): Promise<PayResult> {
  const store = resolveTotemStore();
  try {
    // ⚠️ `ensureCartId`, AND EVERY OTHER WRITE IN THIS FILE USES `cartForThisCustomer` — the difference is
    // deliberate and is the pk9/d1 fix (04/09). This is the ONE path that must be allowed to reach a vessel
    // that has already landed an order: `place_order` is sent with the cart id as its idempotency key, so a
    // retry after a failed `payment.initiate` (the `rate_limited` branch below tells the customer to make
    // exactly that retry) gets its own order back instead of starting a second one. A NEW customer never
    // arrives here first — `readyToPay` demands a line in the bag — so the leniency cannot leak. The reason
    // in full is on `cartForThisCustomer` in lib/cart.ts.
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
    const { order_id } = await totemCommand().placeOrder(store.id, cartId, cartId);
    const outcome = await initiateCounterPayment(order_id, method);

    const confirmation = await totemRead().orderConfirmation(store.id, order_id);
    // ⚠️ A CONFIRMATION THE PORT WOULD NOT GIVE BACK IS LOUD, AND STILL NOT A REFUSAL. The order exists and
    // the charge is open by this line, so throwing here would strand a customer over a read; but the screen
    // must not invent the money either. It says so instead — see `UNREADABLE_ORDER_BAG`.
    if (!confirmation)
      console.error(
        `[totem] order ${order_id} was placed and charged, and read.order_confirmation did not answer — ` +
          'the screen will show no total rather than a made-up one',
      );
    return {
      ok: true,
      outcome,
      orderId: order_id,
      // ★ THE NUMBER ON THE GIANT CARD IS THE KERNEL'S PER-STORE SEQUENCE (`order.number`), not an id and not
      // anything this screen invented. It is what the barista will call out.
      orderNumber: confirmation?.number ?? 0,
      buyerName: name.trim(),
      bag: confirmation ? bagOfOrder(confirmation) : UNREADABLE_ORDER_BAG,
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

/**
 * ★★★ FINISH THE ORDER THIS BROWSER LEFT BEHIND — the recovery half of C5 (05/09).
 *
 * pk9 gave the attract panel a voice for an order left `awaiting_payment` by a reload; this gives it a way
 * out. Everything it needs is READ back from the port — the QR, the ref, the order's own money — so nothing
 * about a live payment has to survive in this process, in a cookie or in a URL. See
 * `recoverCounterPayment` for why it is a read and not `resume: true`.
 *
 * ⚠️ IT RUNS FROM A TAP AND FROM NOWHERE ELSE. It is a server ACTION, never a render: `page.tsx` may not
 * call it while drawing the attract panel. An idle kiosk re-renders, and a recovery on render would ask the
 * port about somebody else's order on every one of them.
 *
 * ⚠️ AND IT NEVER TOUCHES THE CART. The vessel behind the cookie is spent; this path reads an ORDER. A
 * recovery that also reset or created a cart would be answering a different question with somebody's money
 * on the glass.
 */
export type ResumeResult =
  | { ok: true; outcome: PosOutcome; orderId: string; orderNumber: number; buyerName: string; bag: Bag }
  | { ok: false; kind: 'rate_limited'; retryAfterSeconds: number }
  | { ok: false; kind: 'gone' }
  | { ok: false; kind: 'refused'; message: string };

export async function resumePreviousOrder(orderId: string): Promise<ResumeResult> {
  const store = resolveTotemStore();
  try {
    const outcome = await recoverCounterPayment(orderId);
    // `gone` is not a failure of this till. The order was paid while the screen was away, or the attempt
    // ended — either way there is nothing to put back on the glass, and saying so is different from saying
    // the counter broke. The screen answers the two with different sentences.
    if (!outcome) return { ok: false, kind: 'gone' };
    const confirmation = await totemRead().orderConfirmation(store.id, orderId);
    if (!confirmation) return { ok: false, kind: 'gone' };
    return {
      ok: true,
      outcome,
      orderId,
      orderNumber: confirmation.number,
      // ⚠️ THE CONFIRMATION IS PII-LIMITED AND CARRIES NO NAME, which is correct: the buyer's name is not a
      // public fact about an order id anybody could type. The card on the "pronto" screen prints the number,
      // which is what the barista calls out; an empty name draws nothing rather than inventing one.
      buyerName: '',
      // ★ THE ORDER'S OWN MONEY, not the spent cart's — see `bagOfOrder`. Reading the cart here would print
      // R$ 0,00 over a live QR.
      bag: bagOfOrder(confirmation),
    };
  } catch (error) {
    logPortRefusal('resumePreviousOrder', { store: store.id, order: orderId }, error);
    if (error instanceof PortRateLimited)
      return { ok: false, kind: 'rate_limited', retryAfterSeconds: error.retryAfterSeconds };
    return { ok: false, kind: 'refused', message: error instanceof Error ? error.message : 'unknown' };
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
