// ⛔ THE FOUR THINGS A FINGER CAN DO TO THIS TILL THAT IT USED TO GET WRONG (s5-2, s5-4, s5-5, s5-6).
//
// Every case here drives the SCREEN — a tap, two taps, a key, a browser gesture — and asserts on what came
// out. None of them asserts on `disabled`, and that is deliberate: the double-tap defect was invisible to
// exactly that assertion (`disabled=false` was measured on the bench WHILE two POSTs were on the wire),
// because a `disabled` attribute is written one render after the tap that should have set it.
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EMPTY = {
  cartId: null,
  lines: [],
  count: 0,
  subtotalLabel: 'R$ 0,00',
  discounts: [],
  totalLabel: 'R$ 0,00',
  pendingIdentity: [],
  couponCode: null,
};

const payWith = vi.fn();
const applyCoupon = vi.fn();
const resetCounter = vi.fn().mockResolvedValue({ bag: EMPTY });

vi.mock('@/app/actions', () => ({
  resetCounter,
  payWith: (...a: unknown[]) => payWith(...a),
  applyCoupon: (...a: unknown[]) => applyCoupon(...a),
  addItem: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
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

const bag = {
  cartId: 'cart_01ABC',
  lines: [
    {
      lineId: 'cl_1',
      skuId: 'sku_1',
      name: 'Espresso Forge',
      variant: 'Curto',
      imageUrl: undefined,
      qty: 1,
      lineTotalLabel: 'R$ 7,00',
    },
  ],
  count: 1,
  subtotalLabel: 'R$ 7,00',
  discounts: [],
  totalLabel: 'R$ 7,00',
  pendingIdentity: [],
  couponCode: null,
};

function tap(label: string | RegExp) {
  const el = screen.getByText(label).closest('button');
  if (!el) throw new Error(`no button behind ${String(label)}`);
  act(() => {
    el.click();
  });
}

/** Attract → menu → bag → payment step, the way a finger gets there. */
async function walkToPayment() {
  render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
  tap('Toque para começar');
  tap('Revisar pedido');
  tap('Ir para o pagamento');
  await act(async () => {});
}

beforeEach(() => {
  payWith.mockReset();
  applyCoupon.mockReset();
});
afterEach(() => vi.clearAllMocks());

// ── s5-4 ────────────────────────────────────────────────────────────────────────────────────────────────
describe('two quick taps on “Pagar” are ONE order', () => {
  it('⛔ the second tap of the same tick never reaches the port', async () => {
    // Never resolves: the whole point is what happens while the first call is still in flight.
    payWith.mockReturnValue(new Promise(() => {}));
    await walkToPayment();
    tap('Q'); // a name
    tap('Pix');

    const button = screen.getByText(/^Pagar/).closest('button');
    if (!button) throw new Error('no pay button');
    act(() => {
      button.click();
      button.click(); // the impatient customer, in the same tick
    });

    expect(payWith).toHaveBeenCalledTimes(1);
  });

  it('and the latch is released when the write comes back — a refused order can be retried', async () => {
    payWith.mockResolvedValue({ ok: false, kind: 'refused', message: 'nope' });
    await walkToPayment();
    tap('Q');
    tap('Pix');
    const button = screen.getByText(/^Pagar/).closest('button');
    if (!button) throw new Error('no pay button');
    await act(async () => {
      button.click();
    });
    await act(async () => {
      button.click();
    });
    expect(payWith).toHaveBeenCalledTimes(2);
  });
});

// ── s5-2 ────────────────────────────────────────────────────────────────────────────────────────────────
describe('a coupon the customer got wrong is answered where the keyboard is', () => {
  async function openCouponDialog() {
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Revisar pedido');
    tap('Adicionar cupom de desconto');
    await act(async () => {});
  }

  it('⛔ keeps the dialog open, keeps the code, and says what the KERNEL said', async () => {
    applyCoupon.mockResolvedValue({
      ok: false,
      kind: 'coupon',
      message: 'Cupom não encontrado. Confira o código e tente de novo.',
      bag,
    });
    await openCouponDialog();
    tap('C');
    tap('A');
    await act(async () => {
      screen.getByText('Adicionar cupom').closest('button')?.click();
    });

    expect(screen.getByRole('alert').textContent).toBe(
      'Cupom não encontrado. Confira o código e tente de novo.',
    );
    // The dialog is still there…
    expect(screen.queryByText('Cupom de desconto')).toBeTruthy();
    // …with the two letters still in it, so the person can fix the one they missed.
    expect(screen.queryByText('CA')).toBeTruthy();
    // and NOT the sentence that sends somebody to fetch a human for their own typo.
    expect(screen.queryByText(/Chame um atendente/)).toBeNull();
  });

  it('the next key clears the refusal — correcting the code is what dismisses it', async () => {
    applyCoupon.mockResolvedValue({ ok: false, kind: 'coupon', message: 'Este cupom expirou.', bag });
    await openCouponDialog();
    tap('C');
    await act(async () => {
      screen.getByText('Adicionar cupom').closest('button')?.click();
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    tap('A');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('⚠️ a refusal we cannot name still closes and calls the attendant — that one IS ours', async () => {
    applyCoupon.mockResolvedValue({ ok: false, kind: 'refused', message: 'boom', bag });
    await openCouponDialog();
    tap('C');
    await act(async () => {
      screen.getByText('Adicionar cupom').closest('button')?.click();
    });
    expect(screen.queryByText('Cupom de desconto')).toBeNull();
    expect(screen.getByText('Não foi possível concluir. Chame um atendente.')).toBeTruthy();
  });
});

// ── s5-5 ────────────────────────────────────────────────────────────────────────────────────────────────
describe('the name keyboard can spell a Brazilian name', () => {
  it('⛔ JOÃO — the accented row exists and types into the field', async () => {
    await walkToPayment();
    for (const k of ['J', 'O', 'Ã', 'O']) tap(k);
    expect(screen.getByText('JOÃO')).toBeTruthy();
  });

  it('JOSÉ and CONCEIÇÃO too — É and Ç are the two the counter cannot do without', async () => {
    await walkToPayment();
    for (const k of ['J', 'O', 'S', 'É']) tap(k);
    expect(screen.getByText('JOSÉ')).toBeTruthy();
    for (const k of ['Ç']) tap(k);
    expect(screen.getByText('JOSÉÇ')).toBeTruthy();
  });

  it('⚠️ and the COUPON keyboard stays A–Z0–9 — an accent in a code is a code that can never match', async () => {
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    tap('Toque para começar');
    tap('Revisar pedido');
    tap('Adicionar cupom de desconto');
    await act(async () => {});
    expect(screen.queryByText('Ç')).toBeNull();
    expect(screen.queryByText('Ã')).toBeNull();
  });
});

// ── s5-6 ────────────────────────────────────────────────────────────────────────────────────────────────
describe('the back gesture stays inside the kiosk', () => {
  it('⛔ a popstate is absorbed by re-pushing the guard entry, so the flow is not left', async () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    render(<Totem initialMenu={menu} initialBag={bag} idleSeconds={90} />);
    // One entry on mount…
    expect(pushState).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // …and one for every back that consumes it.
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    pushState.mockRestore();
  });
});
