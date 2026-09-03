// ⛔ THE GUARD FOR s5-1 — THE COUNTER THAT COULD NOT SELL ANYTHING.
//
// On the bench of 02/09 every single "Pagar" died in "Não foi possível fechar o pedido. Chame um atendente.",
// by both methods, with and without a coupon, on a till whose menu, bag, coupon and validations all worked.
// The refusal travelled inside an HTTP 200 and said, in full:
//
//     the counter store quotes 2 delivery option(s) (Entrega Expressa, Entrega Padrão). The totem seeds the
//     quote with a placeholder postal code because a pickup price does not depend on a destination — that
//     stops being true the moment delivery is on the list.
//
// ★★ THE FIXTURE IS NOT INVENTED. It is what `read.shipping_options` answered for the counter store on the
// live box, 02/09, quoted with the seed postal code — two tenant-wide delivery methods the counter's operator
// has nowhere to switch off, plus the pickup the counter actually serves:
//
//     GET /v1/read/shipping_options?store=sto_…DT6H&cart_id=…&postal_code=01310-100
//     → delivery shm_…PBRQFX  Entrega Expressa   3490
//       delivery shm_…M50MB   Entrega Padrão     1990
//       pickup   shm_…T8PT8T  Retirar no balcão     0   · "Balcão · Forge Café", 05416-011
//
// ⚠️ THE ASSERTIONS ARE ON THE RESULT, NOT ON THE ABSENCE OF A THROW. "It no longer refuses" would go green
// on a totem that wrote Entrega Expressa to the cart — which is the failure the old guard existed to prevent
// and the one this fix must not buy its way out of. So the guard reads what reached the PORT: which method id
// was written, and whose address went with it.
import type { PickupPoint, ShippingOption } from '@forgecommerce/storefront-kit/read-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const shippingOptions = vi.fn();
const setDelivery = vi.fn().mockResolvedValue({ cart_id: 'cart_x' });
const setPickupLocation = vi.fn().mockResolvedValue({ cart_id: 'cart_x' });
const readCheckout = vi.fn().mockResolvedValue(null);
const identifyBuyer = vi.fn().mockResolvedValue({ called: true });

vi.mock('./port', () => ({
  totemRead: () => ({ shippingOptions }),
  totemCommand: () => ({ setDelivery, setPickupLocation }),
}));
vi.mock('./cart', () => ({ readCheckout: () => readCheckout() }));
vi.mock('./buyer', () => ({
  identifyBuyer: (...args: unknown[]) => identifyBuyer(...args),
}));

process.env.FORGE_TOTEM_STORE_ID = 'sto_01M1FREQR0GZFFSEMFRVS4DT6H';
process.env.FORGE_TOTEM_STORE_HANDLE = 'balcao';

const { assertPickupChosen, counterOption, prepareForPayment } = await import('./counter-order');

const COUNTER: PickupPoint = {
  id: 'plo_01M1FREVBJKAJSVH0XF6BHQR9B',
  name: 'Balcão · Forge Café',
  addr_line1: 'Rua Fradique Coutinho, 1188',
  addr_line2: null,
  district: 'Vila Madalena',
  city: 'São Paulo',
  uf: 'SP',
  postal_code: '05416-011',
  lat: null,
  lng: null,
  hours: {},
  instructions: 'Retire no balcão quando chamarmos o seu nome.',
};

const option = (over: Partial<ShippingOption>): ShippingOption => ({
  method_id: 'shm_x',
  method_name: 'x',
  price: 0,
  undiscounted_price: 0,
  free_applied: false,
  delivery_min_days: 0,
  delivery_max_days: 0,
  ...over,
});

const EXPRESSA = option({
  method_id: 'shm_01M1FSZXBQAAJNHB3H39PBRQFX',
  method_name: 'Entrega Expressa',
  price: 3490,
  undiscounted_price: 3490,
  kind: 'delivery',
  delivery_min_days: 1,
  delivery_max_days: 2,
});
const PADRAO = option({
  method_id: 'shm_01M1FSZXANMTQWZP0QGPDM50MB',
  method_name: 'Entrega Padrão',
  price: 1990,
  undiscounted_price: 1990,
  kind: 'delivery',
  delivery_min_days: 3,
  delivery_max_days: 7,
});
const RETIRADA = option({
  method_id: 'shm_01M1FREVCF8KWDBDPGZZT8PT8T',
  method_name: 'Retirar no balcão',
  kind: 'pickup',
  pickup_locations: [COUNTER],
});

/** Exactly what the live store answered. The counter cannot make these three be two. */
const MEASURED_QUOTE = { options: [EXPRESSA, PADRAO, RETIRADA] };

beforeEach(() => {
  shippingOptions.mockReset();
  setDelivery.mockClear();
  setPickupLocation.mockClear();
  readCheckout.mockResolvedValue(null);
});

describe('the counter closes an order on a store that also sells online', () => {
  it('★ writes the PICKUP method — the store quoting two deliveries is not its business', async () => {
    shippingOptions.mockResolvedValue(MEASURED_QUOTE);

    const result = await prepareForPayment('cart_01M1JEQAXB93X2TTAJJZ50SMDJ', 'MARCOS');

    expect(result).toEqual({ ok: true, pickupPointName: 'Balcão · Forge Café' });
    expect(setDelivery).toHaveBeenCalledTimes(1);
    const [, , address, methodId] = setDelivery.mock.calls[0] as [
      string,
      string,
      Record<string, string>,
      string,
    ];
    expect(methodId).toBe(RETIRADA.method_id);
    // ⚠️ NAMED, not "not a delivery": a future option list could carry a third delivery method, and
    // `not.toBe(EXPRESSA)` would pass while the till charged for it.
    expect([EXPRESSA.method_id, PADRAO.method_id]).not.toContain(methodId);
    // And the destination the cart is priced against is the counter's own, never the seed.
    expect(address.postal_code).toBe('05416-011');
    expect(address).toMatchObject({ line1: 'Rua Fradique Coutinho', number: '1188', region: 'SP' });
    expect(JSON.stringify(address)).not.toContain('01310-100');
    expect(setPickupLocation).toHaveBeenCalledWith(
      'sto_01M1FREQR0GZFFSEMFRVS4DT6H',
      'cart_01M1JEQAXB93X2TTAJJZ50SMDJ',
      COUNTER.id,
    );
  });

  it('the pickup location is written AFTER the method — the kernel refuses the other order', async () => {
    shippingOptions.mockResolvedValue(MEASURED_QUOTE);
    await prepareForPayment('cart_1', 'MARCOS');
    const [deliveryCall] = setDelivery.mock.invocationCallOrder;
    const [pickupCall] = setPickupLocation.mock.invocationCallOrder;
    expect(deliveryCall).toBeDefined();
    expect(pickupCall).toBeDefined();
    expect(deliveryCall as number).toBeLessThan(pickupCall as number);
  });

  it('★ and it is the KIND that decides, not the position — a delivery option carrying a point is refused', async () => {
    // The one shape in which `options[0]` would write a delivery method to the cart AND find a pickup point to
    // go with it, so nothing downstream would notice. It is what `assertPickupChosen` is the belt for, and the
    // reason this case asserts on what was WRITTEN rather than on a throw: both failures — refusing the order
    // and charging R$ 34,90 of freight — are wrong, and only the method id tells them apart.
    const expressaWithPoints = { ...EXPRESSA, pickup_locations: [COUNTER] };
    shippingOptions.mockResolvedValue({ options: [expressaWithPoints, RETIRADA] });

    await expect(prepareForPayment('cart_1', 'MARCOS')).resolves.toEqual({
      ok: true,
      pickupPointName: 'Balcão · Forge Café',
    });
    expect(setDelivery.mock.calls[0]?.[3]).toBe(RETIRADA.method_id);
  });

  it('a store with no pickup at all is REFUSED, not crashed — the screen has a sentence for that', async () => {
    shippingOptions.mockResolvedValue({ options: [EXPRESSA, PADRAO] });
    await expect(prepareForPayment('cart_1', 'MARCOS')).resolves.toEqual({
      ok: false,
      reason: 'no_pickup_configured',
    });
    expect(setDelivery).not.toHaveBeenCalled();
  });
});

describe('the seed postal code can still never choose a price', () => {
  it('counterOption takes the pickup, not the first option the store happens to quote', () => {
    expect(counterOption(MEASURED_QUOTE.options)).toBe(RETIRADA);
    expect(counterOption([EXPRESSA, PADRAO])).toBeNull();
  });

  it('★ and writing a delivery method is REFUSED by name — the tempting `options[0]` cleanup', () => {
    expect(() => assertPickupChosen(RETIRADA)).not.toThrow();
    expect(() => assertPickupChosen(EXPRESSA)).toThrow(/Entrega Expressa/);
    expect(() => assertPickupChosen(EXPRESSA)).toThrow(/placeholder postal code/);
  });

  it('an option from a kernel too old to publish `kind` is treated as delivery, and refused', () => {
    // `kind` is optional on the wire (a storefront talks to whatever kernel its instance pinned). Absent means
    // DELIVERY, per the kit — so an old kernel makes this counter refuse to sell rather than guess.
    expect(counterOption([option({ method_name: 'Entrega antiga' })])).toBeNull();
    expect(() => assertPickupChosen(option({ method_name: 'Entrega antiga' }))).toThrow(
      /Entrega antiga/,
    );
  });
});
