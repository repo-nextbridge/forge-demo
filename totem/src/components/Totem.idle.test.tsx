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

const resetCounter = vi.fn().mockResolvedValue({ bag: { cartId: null, lines: [], count: 0, subtotalLabel: 'R$ 0,00', discounts: [], totalLabel: 'R$ 0,00', couponCode: null } });
const payWith = vi.fn();
const simulatePixPayment = vi.fn();
const resumePreviousOrder = vi.fn();

vi.mock('@/app/actions', () => ({
  resetCounter,
  addItem: vi.fn(),
  applyCoupon: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
  payWith: (...a: unknown[]) => payWith(...a),
  removeCoupon: vi.fn(),
  removeItem: vi.fn(),
  resumePreviousOrder: (...a: unknown[]) => resumePreviousOrder(...a),
  simulatePixPayment: (...a: unknown[]) => simulatePixPayment(...a),
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
  discounts: [],
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
  payWith.mockReset();
  simulatePixPayment.mockReset();
  resumePreviousOrder.mockReset();
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

// ── p5-1, AND THE MEASUREMENT FROM THE QUEUE'S SIDE THAT RE-OPENED IT ───────────────────────────────────
//
// ⛔ THE FIRST DEFECT. The clock used to take the QR off the glass while the customer was paying it. Measured
// on the bench of 03/09 (sonda p5, achado p5-1): pix chosen, "Pagar" tapped, ORDER #5 CREATED IN THE KERNEL,
// QR on screen — and at 90 seconds of stillness the till went home. The order stayed behind, "Aguardando",
// with nobody able to close it. The answer then was to exempt this one screen from the clock entirely.
//
// ⛔ THE SECOND DEFECT, AND IT IS THE PRICE OF THAT ANSWER. Watched from the counter QUEUE instead of from the
// paying customer: a QR ABANDONED at the glass sat there for five measured minutes, no warning and no reset,
// the till unusable and a stranger's live payment on screen for the next person to tap.
//
// ★★★ WHAT MAKES BOTH ANSWERABLE IS A FACT THAT CHANGED BETWEEN THE TWO. p5-1's exemption rested on the
// screen holding the ONLY copy of the capability to settle — `providerRef` was component state, and going
// home destroyed it. C5 made the recovery a READ (`read.payment` publishes the attempt's envelope verbatim),
// so any surface that can NAME the order can put the QR back. Going home stopped having to mean forgetting.
//
// ⇒ SO THE REGIME IS NOW THE SAME AS EVERY OTHER SCREEN'S — same window, same question — and only the ENDING
// differs: the order is PARKED, handed to the attract panel by number, instead of dropped. These cases assert
// the ending and not the dialog: a fix that only asked, or only delayed, leaves them red.
const pixPending = (expiresInSeconds: number) => ({
  ok: true as const,
  outcome: {
    kind: 'pix_pending' as const,
    copyPaste: '00020126580014BR.GOV.BCB.PIX',
    providerRef: 'pospix_abc',
    expiresInSeconds,
  },
  orderId: 'ord_01LIVE',
  orderNumber: 5,
  buyerName: 'R',
  bag: bagWithSomething,
});

function tap(label: string | RegExp) {
  const el = screen.getByText(label).closest('button');
  if (!el) throw new Error(`no button behind ${String(label)}`);
  act(() => {
    el.click();
  });
}

/** Attract → menu → bag → name → Pix → Pagar. Leaves the screen on the QR, with the order already placed. */
async function walkToTheQr(idleSeconds = 90) {
  render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={idleSeconds} />);
  tap('Toque para começar');
  tap('Revisar pedido');
  tap('Ir para o pagamento');
  await act(async () => {});
  tap('Q');
  tap('Pix');
  await act(async () => {
    screen.getByText(/^Pagar/).closest('button')?.click();
  });
  // The QR really is the screen we are measuring, and the order number really is on it.
  expect(screen.getByText('Escaneie o QR Code para pagar')).toBeTruthy();
  expect(screen.getByText('5')).toBeTruthy();
}

describe('the QR screen keeps the counter’s clock, and hands the order back instead of dropping it', () => {
  it('⛔ says nothing for most of the window — a question over a live QR every minute is its own defect', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr();
    await act(async () => {
      vi.advanceTimersByTime(69_000);
    });
    expect(screen.queryByText('Você ainda está aí?')).toBeNull();
    expect(screen.getByText('Escaneie o QR Code para pagar')).toBeTruthy();
  });

  it('★ asks before the end, and the QR is still on the glass behind the question', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr();
    await act(async () => {
      vi.advanceTimersByTime(70_500);
    });
    expect(screen.getByText('Você ainda está aí?')).toBeTruthy();
    expect(resetCounter).not.toHaveBeenCalled();
    expect(screen.getByText('Escaneie o QR Code para pagar')).toBeTruthy();
  });

  it('★★ and the question tells the truth of THIS screen — a placed order is not erased', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr();
    await act(async () => {
      vi.advanceTimersByTime(70_500);
    });
    const said = screen.getByText('Você ainda está aí?').parentElement?.textContent ?? '';
    // ⚠️ The basket's sentence would be a lie here: by this moment the order is in the kernel and going home
    // hands it back rather than deleting it.
    expect(said).not.toContain('apagado');
    expect(said).toContain('5');
    expect(said).toContain('continua registrado');
  });

  it('★ a touch buys the whole window back — somebody paying in their bank app is not thrown out', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr();
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
    expect(screen.getByText('Escaneie o QR Code para pagar')).toBeTruthy();
  });

  it('★★★ unanswered, the till goes home AND HANDS THE ORDER BACK by number — the whole point of parking', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    // The glass is free for the next customer…
    expect(resetCounter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByText('Escaneie o QR Code para pagar')).toBeNull();
    // …and the order that was on it is offered back, by the number the barista would call.
    const said = screen.getByTestId('previous-order').textContent ?? '';
    expect(said).toContain('5');
    expect(said).toContain('ainda não foi pago');
    expect(screen.getByTestId('resume-order').textContent).toContain('5');
  });

  it('★★ and the recovery names THAT order — the till does not remember a payment, it re-reads one', async () => {
    payWith.mockResolvedValue(pixPending(900));
    resumePreviousOrder.mockResolvedValue({ ok: false, kind: 'gone' });
    await walkToTheQr();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    await act(async () => {
      screen.getByTestId('resume-order').click();
    });
    expect(resumePreviousOrder).toHaveBeenCalledWith('ord_01LIVE');
  });

  it('⛔ a basket that never became an order is still FORGOTTEN — parking is for orders, not for shopping', async () => {
    render(<Totem initialMenu={menu} initialBag={bagWithSomething} idleSeconds={90} />);
    startOrder();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('previous-order')).toBeNull();
    expect(screen.queryByTestId('resume-order')).toBeNull();
  });

  it('★ the ordinary clock is back the moment the pix is paid — the receipt still goes home by itself', async () => {
    payWith.mockResolvedValue(pixPending(900));
    simulatePixPayment.mockResolvedValue({ paid: true });
    await walkToTheQr();
    await act(async () => {
      screen.getByText('toque no QR Code para simular o pagamento').closest('button')?.click();
    });
    expect(screen.getByText('Pagamento confirmado')).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(90_001);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });

  it('⚠️ the PAYMENT’s own window is the outer bound when it is the shorter of the two', async () => {
    // A box configured to wait five minutes still may not hold a pix past the reservation behind it.
    payWith.mockResolvedValue(pixPending(200));
    await walkToTheQr(300);
    await act(async () => {
      vi.advanceTimersByTime(199_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });

  it('and neither window is a constant baked into the component', async () => {
    payWith.mockResolvedValue(pixPending(900));
    await walkToTheQr(30);
    await act(async () => {
      vi.advanceTimersByTime(29_000);
    });
    expect(resetCounter).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });
});
