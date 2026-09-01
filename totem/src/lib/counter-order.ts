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
 * ★ A DESTINATION IS NEEDED ONLY TO OPEN THE QUOTE, AND FOR THIS COUNTER ITS VALUE IS MEANINGLESS.
 *
 * `read.shipping_options` answers `{options: [], reason: 'no_destination'}` for a cart with no postal code,
 * so the pickup method — the only thing this counter offers — cannot be discovered without sending one. And
 * a pickup option does not depend on where the buyer lives. Measured with three deliberately distant CEPs
 * (Porto Alegre 90010-150, Rio Branco 69900-000, the counter's own 05416-011): one option each time, the
 * same "Retirar no balcão".
 *
 * So this is a KEY, not a claim, and nothing about it reaches the order — the address written to the cart is
 * the pickup point's. `assertPickupOnly` below is what keeps that true: the day this counter also offers
 * delivery, a seed postal code would start silently choosing somebody's shipping price, and the code refuses
 * rather than quote against a number nobody meant.
 */
const QUOTE_SEED_POSTAL_CODE = '01310-100';

/** The counter's pickup option and the point behind it, or null when the store offers neither. */
async function pickupOption(
  cartId: string,
): Promise<{ option: ShippingOption; point: PickupPoint } | null> {
  const store = resolveTotemStore();
  const quote = await totemRead().shippingOptions(store.id, cartId, QUOTE_SEED_POSTAL_CODE);
  if (!quote || quote.options.length === 0) return null;
  assertPickupOnly(quote.options);
  const option = quote.options.find((o) => o.kind === 'pickup');
  const point = option?.pickup_locations?.[0];
  if (!option || !point) return null;
  return { option, point };
}

/**
 * ⚠️ A COUNTER THAT SUDDENLY OFFERS DELIVERY IS A DIFFERENT SHOP, AND THIS IS WHERE IT SAYS SO.
 *
 * The seed postal code above is safe ONLY because every option this store quotes is a pickup. If a delivery
 * method ever appears, the seed stops being irrelevant and starts being a fake destination that a price was
 * computed against — so the screen stops instead of quietly charging somebody freight to an address nobody
 * typed. Exported for the test.
 */
export function assertPickupOnly(options: ShippingOption[]): void {
  const delivery = options.filter((o) => o.kind !== 'pickup');
  if (delivery.length > 0)
    throw new Error(
      `the counter store quotes ${delivery.length} delivery option(s) (${delivery
        .map((o) => o.method_name)
        .join(', ')}). The totem seeds the quote with a placeholder postal code because a pickup price does ` +
        'not depend on a destination — that stops being true the moment delivery is on the list. See ' +
        'QUOTE_SEED_POSTAL_CODE in counter-order.ts.',
    );
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
