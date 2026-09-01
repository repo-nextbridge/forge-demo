// ★★ THE TEST THIS SLICE'S TIGHTEST CEILING DEPENDS ON.
//
// `cart.set_buyer` is ORACLE-class and capped at ten per minute per store+IP, and — unlike the coupon — it is
// MANDATORY for every counter order. Measured on the isolated bench (2026-09-01): ten calls answer 200, the
// eleventh answers 429 with `Retry-After: 60`, and the bucket is SHARED across carts (five on one cart plus
// five on another refuse the eleventh). One totem is one address, so the counter's ceiling is ten orders a
// minute — and every wasted call is somebody's order.
//
// So "the screen must not re-send the buyer when the customer walks back a step and forward again" is not
// hygiene here. It is the difference between spending the store's budget on orders and spending it on
// re-renders. This is the test; the sabotage that proves it is in the slice report.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setBuyer = vi.fn().mockResolvedValue({ cart_id: 'cart_x' });

vi.mock('./port', () => ({ totemCommand: () => ({ setBuyer }) }));
vi.mock('./store', () => ({
  resolveTotemStore: () => ({ id: 'sto_test', handle: 'balcao' }),
}));

const { buyerAlreadySet, identifyBuyer, syntheticBuyerEmail } = await import('./buyer');

type View = Parameters<typeof buyerAlreadySet>[0];
const viewWith = (name: string | null): View =>
  ({
    has_buyer: name !== null,
    buyer_masked: name === null ? null : { name, email: '', phone: '' },
  }) as unknown as View;

beforeEach(() => setBuyer.mockClear());

describe('the synthetic address', () => {
  it('is derived from the cart, so it survives a restart and cannot collide across replicas', () => {
    expect(syntheticBuyerEmail('cart_01M1EYH8K7272E6R0BBTR1NECH')).toBe('balcao+r1nech@forge.demo');
  });

  it('is stable: the same cart always mints the same address', () => {
    const a = syntheticBuyerEmail('cart_01M1EYB3RZXH90594NTFVG7WNF');
    expect(syntheticBuyerEmail('cart_01M1EYB3RZXH90594NTFVG7WNF')).toBe(a);
  });

  it('is lowercase, because an address is', () => {
    expect(syntheticBuyerEmail('cart_ABCDEF')).toBe('balcao+abcdef@forge.demo');
  });
});

describe('identifyBuyer spends the store’s budget at most once per cart', () => {
  it('calls the port the first time a name is given', async () => {
    const r = await identifyBuyer(viewWith(null), 'cart_01M1EYH8K7272E6R0BBTR1NECH', 'MARINA');
    expect(r.called).toBe(true);
    expect(setBuyer).toHaveBeenCalledTimes(1);
    expect(setBuyer).toHaveBeenCalledWith('sto_test', 'cart_01M1EYH8K7272E6R0BBTR1NECH', {
      email: 'balcao+r1nech@forge.demo',
      name: 'MARINA',
      guest: true,
    });
  });

  it('★ DOES NOT call it again when the customer walks back a screen and returns', async () => {
    // The kernel masks what it stored; the second pass reads the cart and sees a buyer already on it.
    const r = await identifyBuyer(viewWith('M••••'), 'cart_01M1EYH8K7272E6R0BBTR1NECH', 'MARINA');
    expect(r.called).toBe(false);
    expect(setBuyer).not.toHaveBeenCalled();
  });

  it('DOES call it again when the customer corrects their name — a correction is worth one of the ten', async () => {
    const r = await identifyBuyer(viewWith('M••••'), 'cart_01M1EYH8K7272E6R0BBTR1NECH', 'JOANA');
    expect(r.called).toBe(true);
    expect(setBuyer).toHaveBeenCalledTimes(1);
  });

  it('treats a cart with no buyer as needing one, whatever the mask says', async () => {
    await identifyBuyer(viewWith(null), 'cart_01M1EYH8K7272E6R0BBTR1NECH', 'MARINA');
    expect(setBuyer).toHaveBeenCalledTimes(1);
  });

  it('never claims a nameless cart is already identified', () => {
    expect(buyerAlreadySet(viewWith('M••••'), '   ')).toBe(false);
  });
});
