// ★★ THE RESET BETWEEN CUSTOMERS, MEASURED ON A CLOCK.
//
// This is the acceptance criterion the brief refused to take on trust — "prove com medida, não com
// 'implementei'" — and it is the one behaviour that separates a till from a web page: the person who walks
// up must never inherit the previous person's basket.
//
// The measurement is in three parts, and all three matter:
//   1. nothing happens before the window is up (a counter that reset itself mid-order would be worse);
//   2. when it is up, the SERVER action fires — the cart pointer is an httpOnly cookie, so a reset that only
//      changed React state would look identical on screen and leave the basket alive on the next render;
//   3. any touch restarts the clock, or a customer reading the menu loses their order.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resetCounter = vi.fn().mockResolvedValue({ bag: { cartId: null, lines: [], count: 0, subtotalLabel: 'R$ 0,00', discountLabel: null, discountTitle: null, totalLabel: 'R$ 0,00', couponCode: null } });

vi.mock('@/app/actions', () => ({
  resetCounter,
  addItem: vi.fn(),
  applyCoupon: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
  payWith: vi.fn(),
  removeCoupon: vi.fn(),
  removeItem: vi.fn(),
  simulatePixPayment: vi.fn(),
}));

const { Totem } = await import('./Totem');

const menu = {
  visible: true as const,
  sections: [
    {
      id: 'cafes' as const,
      kicker: 'Extraído na hora',
      title: 'Cafés',
      note: 'Espresso e coado feitos no balcão',
      items: [],
      railImageUrl: undefined,
    },
  ],
};

const bagWithSomething = {
  cartId: 'cart_01ABC',
  lines: [
    {
      lineId: 'cl_1',
      skuId: 'sku_1',
      name: 'Cappuccino',
      variant: 'G · Aveia',
      imageUrl: undefined,
      qty: 1,
      lineTotalLabel: 'R$ 17,00',
    },
  ],
  count: 1,
  subtotalLabel: 'R$ 17,00',
  discountLabel: null,
  discountTitle: null,
  totalLabel: 'R$ 17,00',
  couponCode: null,
};

/** Walk past the attract screen, the way a customer does: one touch. */
function startOrder() {
  act(() => {
    screen.getByText('Toque para começar').closest('button')?.click();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  resetCounter.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('the counter resets itself between customers', () => {
  it('does NOT reset while the window is still open', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(89_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
  });

  it('★ resets ON THE SERVER once the window closes — the pointer is httpOnly, so only the server can', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });

  it('★ and the previous customer’s bag is gone from the screen with it', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    expect(screen.getByText('R$ 17,00')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    // Back to the attract screen, and the bag the action returned is the empty one.
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByText('R$ 17,00')).toBeNull();
  });

  it('a touch restarts the clock — reading the menu must not cost somebody their order', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(80_000);
    });
    act(() => {
      window.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(80_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(11_000);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });

  it('⚠️ the attract screen itself does NOT arm the clock — an idle totem must not post a write a minute', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    // No touch: we never leave the attract screen.
    await act(async () => {
      vi.advanceTimersByTime(10 * 90_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
  });

  it('honours the window it is configured with, not a number baked into the component', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={20} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(20_001);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });
});
