// The counter, server-rendered once and then driven by taps.
//
// ⚠️ `dynamic = 'force-dynamic'` IS THE HONEST SETTING FOR A TILL, and it is the opposite of what a catalogue
// page wants. Every render of this page reads the cart behind an httpOnly cookie and the live catalogue; a
// cached one would greet a customer with the previous customer's basket, which is the single failure this
// whole slice is built to prevent.

import { readCheckout } from '@/lib/cart';
import { readMenu } from '@/lib/menu';
import { totemRead } from '@/lib/port';
import { resolveTotemStore } from '@/lib/store';
import { EMPTY_BAG, toBag } from '@/lib/view';
import { Totem } from '@/components/Totem';

export const dynamic = 'force-dynamic';

/** How long the screen waits before deciding the customer walked away. Seconds; see compose.override.yml. */
function idleSeconds(): number {
  const n = Number(process.env.FORGE_TOTEM_IDLE_SECONDS);
  return Number.isFinite(n) && n > 0 ? n : 90;
}

export default async function CounterPage() {
  const [menu, view] = await Promise.all([readMenu(), readCheckout()]);

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

  return <Totem initialMenu={menu} initialBag={bag} idleSeconds={idleSeconds()} />;
}
