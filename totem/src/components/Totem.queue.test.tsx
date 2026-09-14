// ★★ THE QUEUE, THE EMPTY REVIEW AND THE STEP SEAL — the three things a person standing in line sees.
//
// All three were reported from the glass rather than derived from the code, and all three are about what the
// screen OFFERS: a way out of somebody else's receipt (M9), an invitation that only makes sense when there is
// something to discount (B14), and a step counter that is the last thing on the panel rather than the first
// (B15).
//
// ⚠️ WHAT THIS FILE CAN AND CANNOT GRADE. jsdom has no layout engine, so nothing here asserts a pixel. What
// it asserts is DOCUMENT ORDER, which in a `flex-direction: column` panel IS the visual order — and the
// geometry itself was measured in headless Chromium against this component's own markup and sheet; the
// table is at `.stepSeal` in Totem.module.css.

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emptyBag = {
  cartId: null,
  lines: [],
  count: 0,
  subtotalLabel: 'R$ 0,00',
  discounts: [],
  totalLabel: 'R$ 0,00',
  couponCode: null,
};

const resetCounter = vi.fn().mockResolvedValue({ bag: emptyBag });
const payWith = vi.fn();

vi.mock('@/app/actions', () => ({
  resetCounter: (...a: unknown[]) => resetCounter(...a),
  addItem: vi.fn(),
  applyCoupon: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
  payWith: (...a: unknown[]) => payWith(...a),
  removeCoupon: vi.fn(),
  removeItem: vi.fn(),
  resumePreviousOrder: vi.fn(),
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

const bag = {
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

function tap(text: string) {
  act(() => {
    screen.getByText(text).closest('button')?.click();
  });
}

beforeEach(() => {
  resetCounter.mockClear();
  payWith.mockReset();
});

/** Walk a whole order to the receipt, the way a customer does. */
async function walkToReceipt() {
  payWith.mockResolvedValue({
    ok: true,
    outcome: { kind: 'settled' },
    orderNumber: 42,
    buyerName: 'JOANA',
    bag,
  });
  render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
  tap('Toque para começar');
  tap('Revisar pedido');
  tap('Ir para o pagamento');
  tap('Q');
  tap('Cartão');
  await act(async () => {
    screen.getByText(/^Pagar/).closest('button')?.click();
  });
}

// ── M9 ──────────────────────────────────────────────────────────────────────────────────────────────────
//
// ⛔ THE CONFIRMATION USED TO HOLD THE TILL FOR THE WHOLE INACTIVITY WINDOW. The receipt had no control on
// it at all, so the only thing that freed the counter was the clock — and the next person in the queue stood
// reading the previous customer's number, name and basket with nothing to touch.
describe('the queue gets past a receipt that is not theirs', () => {
  it('★ the receipt offers a way out, and the way out is a button', async () => {
    await walkToReceipt();
    expect(screen.getByText('Pagamento confirmado')).toBeTruthy();
    expect(screen.getByTestId('new-order').textContent).toBe('Novo pedido');
  });

  it('★ tapping it resets ON THE SERVER — the cart pointer is httpOnly, so only the server can', async () => {
    await walkToReceipt();
    expect(resetCounter).not.toHaveBeenCalled();
    await act(async () => {
      screen.getByTestId('new-order').click();
    });
    expect(resetCounter).toHaveBeenCalledTimes(1);
  });

  it('★ and the previous customer’s order is off the glass, which is the whole point', async () => {
    await walkToReceipt();
    await act(async () => {
      screen.getByTestId('new-order').click();
    });
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByText('Pagamento confirmado')).toBeNull();
    expect(screen.queryByText('JOANA')).toBeNull();
    expect(screen.queryByText('R$ 17,00')).toBeNull();
  });
});

// ── B14 ─────────────────────────────────────────────────────────────────────────────────────────────────
describe('the empty review offers nothing it cannot honour', () => {
  function openEmptyReview() {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Sacola');
  }

  it('⛔ does not offer a coupon over a basket with nothing to discount', () => {
    openEmptyReview();
    expect(screen.getByText('Sua sacola está vazia')).toBeTruthy();
    expect(screen.queryByText('Adicionar cupom de desconto')).toBeNull();
  });

  it('⛔ and prints no sum of nothing — neither the subtotal nor the total', () => {
    openEmptyReview();
    expect(screen.queryByText('Subtotal')).toBeNull();
    expect(screen.queryByText('Total')).toBeNull();
    expect(screen.queryByText('R$ 0,00')).toBeNull();
  });

  // ★ THE POSITIVE CONTROL, AND IT IS WHAT MAKES THE TWO ABOVE WORTH RUNNING: a screen that simply stopped
  // drawing both would pass them and be a different defect.
  it('★ both come back the moment there is a line to total', () => {
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Revisar pedido');
    expect(screen.getByText('Adicionar cupom de desconto')).toBeTruthy();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    // Three times over: the line, the subtotal and the total. A single-match query would be asserting that
    // the screen forgot two of them.
    expect(screen.getAllByText('R$ 17,00').length).toBe(3);
  });
});

// ── B15 ─────────────────────────────────────────────────────────────────────────────────────────────────
//
// The seal used to be the FIRST line of the header band, where a short viewport clips it (the measurement is
// in the sheet). It is now the last band of the panel, after the footer — so what is graded here is that
// order, in both step screens.
describe('the step seal is the last thing on the panel', () => {
  const AFTER = Node.DOCUMENT_POSITION_PRECEDING;

  it('★ “Etapa 1 de 2” comes after the review’s own footer, and is not in its header', () => {
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Revisar pedido');
    const seal = screen.getByText('Etapa 1 de 2');
    const lastAction = screen.getByText('Ir para o pagamento');
    expect(seal.compareDocumentPosition(lastAction) & AFTER).toBeTruthy();
    expect(screen.getByText('Seu pedido').parentElement?.contains(seal)).toBe(false);
  });

  it('★ “Etapa 2 de 2” comes after the payment footer, and is not in its header', () => {
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Revisar pedido');
    tap('Ir para o pagamento');
    const seal = screen.getByText('Etapa 2 de 2');
    const lastAction = screen.getByText(/^Pagar/);
    expect(seal.compareDocumentPosition(lastAction) & AFTER).toBeTruthy();
    expect(screen.getByText('Quem vai retirar?').parentElement?.contains(seal)).toBe(false);
  });

  it('★ and the empty review keeps it — a seal that vanished with the basket would be a second defect', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Sacola');
    expect(screen.getByText('Etapa 1 de 2')).toBeTruthy();
  });
});
