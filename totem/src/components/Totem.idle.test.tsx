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

// ── s5-3 ────────────────────────────────────────────────────────────────────────────────────────────────
//
// ⛔ THE RESET USED TO ARRIVE WITHOUT KNOCKING. Measured on the bench of 02/09: 85–90s of stillness on the
// PAYMENT step — name typed, method chosen — and the till went home with the bag, no warning of any kind
// (monitored every 5s). Somebody looking down for their wallet lost the order at the last tap.
//
// ⚠️ THE BAG STILL DIES AT THE END OF THE WINDOW, AND THESE CASES PROVE IT DOES. "Keep the basket instead"
// was the other half of the finding and it is refused: `resetCounter` exists so the next person never
// inherits the previous person's order. What changes is that somebody who is still standing there is ASKED.
describe('the counter asks before it resets', () => {
  it('⛔ says nothing for most of the window — a question every minute is its own defect', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(69_000);
    });
    expect(screen.queryByText('Você ainda está aí?')).toBeNull();
  });

  it('★ asks IDLE_WARNING_SECONDS before the end, and the reset has not happened yet', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(70_500);
    });
    expect(screen.getByText('Você ainda está aí?')).toBeTruthy();
    expect(resetCounter).not.toHaveBeenCalled();
    // and the order is still on the screen behind the question
    expect(screen.getByText('R$ 17,00')).toBeTruthy();
  });

  it('★ answering it buys the WHOLE window again — that is what makes the question worth asking', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(70_500);
    });
    act(() => {
      screen.getByText('Estou aqui').closest('button')?.click();
    });
    // ⚠️ `HTMLElement.click()` fires a `click` and NO `pointerdown`, which is exactly the gesture the
    // window listeners do not see — so this asserts the button's own re-arm, not the ambient one.
    await act(async () => {
      vi.advanceTimersByTime(69_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
    expect(screen.queryByText('Você ainda está aí?')).toBeNull();
    // …and the fresh window then runs its own course, question and all.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
    expect(screen.getByText('Você ainda está aí?')).toBeTruthy();
  });

  it('⚠️ but ignoring it still resets — the till is not held hostage by a dialog nobody answers', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByText('Você ainda está aí?')).toBeNull();
  });

  it('a window SHORTER than the warning gets no warning, never one that fires at zero', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={10} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(9_500);
    });
    expect(screen.queryByText('Você ainda está aí?')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });
});
