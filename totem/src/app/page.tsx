// The counter, server-rendered once and then driven by taps.
//
// ⚠️ `dynamic = 'force-dynamic'` IS THE HONEST SETTING FOR A TILL, and it is the opposite of what a catalogue
// page wants. Every render of this page reads the cart behind an httpOnly cookie and the live catalogue; a
// cached one would greet a customer with the previous customer's basket, which is the single failure this
// whole slice is built to prevent.

import type { CheckoutView } from '@forgecommerce/storefront-kit/read-client';
import { readCheckout } from '@/lib/cart';
import { readMenu } from '@/lib/menu';
import { totemRead } from '@/lib/port';
import { resolveTotemStore } from '@/lib/store';
import { EMPTY_BAG, toBag } from '@/lib/view';
import { type PreviousOrder, Totem } from '@/components/Totem';

export const dynamic = 'force-dynamic';

/** How long the screen waits before deciding the customer walked away. Seconds; see compose.override.yml. */
function idleSeconds(): number {
  const n = Number(process.env.FORGE_TOTEM_IDLE_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

/**
 * ★★ WHAT HAPPENED TO THE ORDER THIS BROWSER ALREADY PLACED — the voice half of pk9/d1 (04/09).
 *
 * A RELOAD is the one exit from the counter's flow that never reaches `resetCounter`: the cookie is httpOnly
 * and survives it, the screen's state does not. So a render whose cart carries `last_order_id` is a browser
 * coming back after a session that ended, and the person standing there has one question — "foi registrado?".
 * The till used to answer it by silently reusing that cart and refusing at the last tap (`payment.initiate` →
 * `400 order not payable`). `cartForThisCustomer` (lib/cart.ts) is what stops the reuse; this is what stops
 * the silence.
 *
 * ⚠️ THE STATE IS READ, NEVER ASSUMED. "Placed" and "paid" are two different answers and only one of them
 * means somebody should be called: an order left `awaiting_payment` by a reload over the pix QR is a real
 * order with no way to settle it from this screen. So the display status comes from the port
 * (`read.order_confirmation`), and a read that fails says nothing rather than guessing.
 */
async function previousOrderOf(view: CheckoutView | null): Promise<PreviousOrder | null> {
  if (!view?.last_order_id) return null;
  const store = resolveTotemStore();
  try {
    const confirmation = await totemRead().orderConfirmation(store.id, view.last_order_id);
    if (!confirmation) return null;
    return {
      number: confirmation.number,
      awaitingPayment: confirmation.display_status === 'awaiting_payment',
    };
  } catch {
    return null;
  }
}

export default async function CounterPage() {
  const [menu, view] = await Promise.all([readMenu(), readCheckout()]);
  const previousOrder = await previousOrderOf(view);

  let bag = EMPTY_BAG;
  if (view && view.lines.length > 0) {
    const store = resolveTotemStore();
    const docs = await totemRead().productsBySkus(
      store.id,
      view.lines.map((l) => l.sku_id),
    );
    bag = toBag(view, docs ?? []);
  } else if (view) {
    bag = { ...EMPTY_BAG, cartId: view.cart_id };
  }

  return (
    <Totem
      initialMenu={menu}
      initialBag={bag}
      idleSeconds={idleSeconds()}
      previousOrder={previousOrder}
    />
  );
}
