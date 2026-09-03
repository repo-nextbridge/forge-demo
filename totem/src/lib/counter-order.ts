// GETTING A COUNTER CART READY TO PAY — the four writes `checkout.place_order` demands, and why each one is
// there. Every line of this file was measured against the isolated bench on 2026-09-01 before it was written.
//
// ★★ THE SEQUENCE, AS MEASURED:
//
//     cart.create → cart.add_line → cart.set_buyer → cart.set_delivery → cart.set_pickup_location
//     → cart.set_payment_method → checkout.place_order
//
// and `place_order` refuses anything less, by name: `{"missing":["buyer","shipping_method","payment_method"]}`
// plus `shipping_address` when that is absent too.
//
// ⚠️ PICKUP DOES NOT EXCUSE THE ADDRESS, AND THAT SURPRISED EVERYONE INCLUDING THE BRIEF. A cart with the
// pickup method chosen, a pickup point set and a buyer on it still answered
// `400 {missing:[payment_method, shipping_address]}`. With the counter's own address written, it dropped to
// `400 {missing:[payment_method]}` — the one thing only the payment app can supply. So the address IS
// required, and the spec's "endereço da loja como default" stands.
//
// ★ AND THE ADDRESS IS NOT INVENTED — IT IS THE PICKUP POINT'S OWN, READ FROM THE KERNEL. That is the whole
// difference between a default and a fabrication: the counter writes the address of the place the customer
// is standing in, because the kernel published it.
//
// ⚠️⚠️ THE READ SAYS `uf`; THE WRITE SAYS `region`. `PickupPoint.uf` is what `read.shipping_options` returns;
// `cart.set_delivery` takes `shipping_address.region`. They are the same fact under two names, and mapping
// one to the other is the single most likely place for this file to be "cleaned up" into a silent failure.

import type { PickupPoint, ShippingOption } from '@forgecommerce/storefront-kit/read-client';
import { identifyBuyer } from './buyer';
import { readCheckout } from './cart';
import { totemCommand, totemRead } from './port';
import { resolveTotemStore } from './store';

/**
 * ★ A DESTINATION IS NEEDED ONLY TO OPEN THE QUOTE, AND NOTHING THE COUNTER WRITES COMES OUT OF IT.
 *
 * `read.shipping_options` answers `{options: [], reason: 'no_destination'}` for a cart with no postal code,
 * so the pickup method — the only one this counter serves — cannot be DISCOVERED without sending one. It does
 * not DEPEND on one. Re-measured against the live box on 2026-09-02, with a line in the cart so the emptiness
 * could not be the cart's:
 *
 *     ?store=<balcao>&cart_id=…                       → {"options":[],"reason":"no_destination"}
 *     …&postal_code=01310-100 | 90010-150 | 69900-000 → the same three options, all three times:
 *         delivery  shm_…PBRQFX  Entrega Expressa   3490
 *         delivery  shm_…PDM50MB Entrega Padrão      1990
 *         pickup    shm_…T8PT8T  Retirar no balcão      0  · point "Balcão · Forge Café"
 *
 * São Paulo, Porto Alegre and Rio Branco: one pickup option, same method id, same zero. So this is a KEY,
 * not a claim — and see `assertPickupChosen` below for what keeps it one.
 */
const QUOTE_SEED_POSTAL_CODE = '01310-100';

/**
 * The option this counter serves, out of everything the store happens to quote. Exported because it is the
 * half of the rule a future edit can break — see `assertPickupChosen`.
 */
export function counterOption(options: ShippingOption[]): ShippingOption | null {
  return options.find((o) => o.kind === 'pickup') ?? null;
}

/**
 * ⚠️⚠️ THIS WAS `assertPickupOnly`, AND IT REFUSED EVERY ORDER THIS COUNTER EVER TOOK (s5-1, 03/09).
 *
 * The old guard threw the moment the quote carried ANY delivery option — "the counter store quotes 2 delivery
 * option(s)…" — and on the bench that was every single tap of "Pagar", by both methods, with and without a
 * coupon. Its fear was the right fear: a placeholder postal code must never end up choosing somebody's
 * freight. What it watched was the wrong thing, and two measurements say why.
 *
 *   1. THE STORE CANNOT STOP QUOTING DELIVERY, AND NOBODY CAN MAKE IT. A shipping method in this kernel has
 *      no per-store scope: the admin lists Entrega Expressa / Entrega Padrão / Retirar no balcão with no store
 *      column, and a method's own sheet has no store field (measured in the admin, S7-7, 02/09). Methods
 *      belong to the TENANT — so the counter of a shop that ALSO sells online quotes delivery by
 *      construction, and there is no setting anywhere that turns it off for one store. The old guard made
 *      this till's ability to sell depend on a condition its operator has no way to satisfy.
 *   2. NOTHING PRICED AGAINST THE SEED REACHES THE CART. The counter writes ONE method — the pickup one —
 *      beside the pickup point's OWN address, and `cart.set_delivery` re-prices from the address it is given,
 *      never from the quote that was answered. Measured end to end on the live box: a cart quoted with
 *      01310-100 and written with the counter's own 05416-011 reads back
 *      `{"id":"shipping","name":"Shipping","amount":0}`.
 *
 * So the invariant that protects the customer is not "this store offers nothing but pickup" — a fact about a
 * tenant's logistics — but "this counter never WRITES anything but a pickup", a fact about this file. That is
 * what is asserted here, at the last moment before the write.
 *
 * ★ AND IT IS NOT DEAD CODE. `counterOption` above is the tempting simplification: a counter "obviously" has
 * one option, so `options[0]` reads like a cleanup. The day somebody makes it, the seed postal code starts
 * choosing Entrega Expressa — and this line is what refuses instead of quietly charging R$ 34,90 of freight
 * to an address nobody typed.
 */
export function assertPickupChosen(option: ShippingOption): void {
  if (option.kind === 'pickup') return;
  throw new Error(
    `the counter was about to write "${option.method_name}" (${option.method_id}), which is a ` +
      `${option.kind ?? 'delivery'} method, not a pickup. The quote it came from was opened with a ` +
      'placeholder postal code, so its price was computed against a destination nobody typed. See ' +
      'QUOTE_SEED_POSTAL_CODE and counterOption in counter-order.ts.',
  );
}

/** The counter's pickup option and the point behind it, or null when the store offers neither. */
async function pickupOption(
  cartId: string,
): Promise<{ option: ShippingOption; point: PickupPoint } | null> {
  const store = resolveTotemStore();
  const quote = await totemRead().shippingOptions(store.id, cartId, QUOTE_SEED_POSTAL_CODE);
  if (!quote || quote.options.length === 0) return null;
  // ★ DELIVERY OPTIONS IN THIS LIST ARE IGNORED, NOT REFUSED — see `assertPickupChosen`. They are the
  // tenant's methods, they will be there on any box that also sells online, and none of them is written.
  const option = counterOption(quote.options);
  const point = option?.pickup_locations?.[0];
  if (!option || !point) return null;
  assertPickupChosen(option);
  return { option, point };
}

/** The pickup point's own address, in the shape `cart.set_delivery` takes. `uf` → `region`; see the header. */
export function addressOfPoint(point: PickupPoint): {
  line1: string;
  number: string;
  line2?: string;
  neighborhood: string;
  city: string;
  region: string;
  postal_code: string;
  country_code: string;
} {
  // The kernel stores the street and the number in one line for a pickup point and in two fields for an
  // address. Splitting on the last comma is what the point's own format supports ("Rua X, 1188"); a point
  // written without one keeps the whole string as the street and says so with an empty number, which the
  // kernel accepts.
  const match = /^(.*),\s*([^,]+)$/.exec(point.addr_line1.trim());
  return {
    line1: (match?.[1] ?? point.addr_line1).trim(),
    number: (match?.[2] ?? '').trim(),
    ...(point.addr_line2 ? { line2: point.addr_line2 } : {}),
    neighborhood: point.district ?? '',
    city: point.city,
    region: point.uf,
    postal_code: point.postal_code,
    country_code: 'BR',
  };
}

export type PrepareResult =
  | { ok: true; pickupPointName: string }
  | { ok: false; reason: 'no_pickup_configured' };

/**
 * Everything between "the customer typed a name" and "the cart is one payment method away from an order".
 *
 * ⚠️ IT IS IDEMPOTENT BY READING, NOT BY REMEMBERING. Each step asks the cart whether it is already done —
 * which is what lets the customer walk back to the bag and forward again without spending one of the ten
 * `cart.set_buyer` calls a minute this store is allowed (see `buyer.ts`).
 */
export async function prepareForPayment(cartId: string, name: string): Promise<PrepareResult> {
  const store = resolveTotemStore();
  const view = await readCheckout();

  await identifyBuyer(view, cartId, name);

  // Already carrying a method AND an address? Then the delivery half is done; do not rewrite it.
  if (view?.shipping_method_id && view.has_shipping_address)
    return { ok: true, pickupPointName: view.shipping_method_label ?? 'Balcão' };

  const pickup = await pickupOption(cartId);
  if (!pickup) return { ok: false, reason: 'no_pickup_configured' };

  await totemCommand().setDelivery(
    store.id,
    cartId,
    addressOfPoint(pickup.point),
    pickup.option.method_id,
  );
  // AFTER the method, never before: the kernel refuses a pickup location on a cart whose method is not a
  // pickup one, so the order of these two lines is the contract and not a preference.
  await totemCommand().setPickupLocation(store.id, cartId, pickup.point.id);

  return { ok: true, pickupPointName: pickup.point.name };
}
