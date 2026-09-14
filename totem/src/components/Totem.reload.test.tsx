// ★★ WHAT THE GLASS SAYS — AND NOW OFFERS — AFTER A RELOAD. pk9/d1 (04/09) + C5 (05/09).
//
// THE REPORTED DEFECT: an order taken all the way to the end and then a plain page RELOAD lands on the
// blocked screen; a second order can be started but not finished — it reaches the payment step and errors
// there. The till's own container log, from that session, five times over:
//
//     [totem] payWith refused by the port — payment.initiate · validation_failed: order not payable
//
// The "tela bloqueada" is the attract panel: a reload is the one exit from this flow that never reaches
// `resetCounter`, so the React state is gone and the cookie is not. `lib/cart.ts` stops the till from reusing
// that spent cart; this file is about the OTHER half — what the person standing there can see and do.
//
// ⚠️ THE TWO STATES ARE TWO DIFFERENT INSTRUCTIONS, and that is why one message would be wrong. A PAID order
// needs nobody. An order left AWAITING PAYMENT is a real order — and pk9 could only say so.
//
// ★★★ WHAT C5 CHANGED, AND WHY THIS FILE'S OLD ASSERTION HAD TO GO. pk9 asserted the word "atendente" on the
// unpaid branch, because `providerRef` and the copy-and-paste lived in this component's state and the reload
// destroyed them. That was true of the SCREEN and never of the KERNEL: the envelope is persisted on the
// payment attempt and `read.payment` publishes it verbatim, so the till can read the QR back and finish the
// order. Keeping the old assertion would have made this suite defend a sentence the box had stopped meaning.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resumePreviousOrder = vi.fn();

vi.mock('@/app/actions', () => ({
  resetCounter: vi.fn().mockResolvedValue({ bag: null }),
  addItem: vi.fn(),
  applyCoupon: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
  payWith: vi.fn(),
  removeCoupon: vi.fn(),
  removeItem: vi.fn(),
  resumePreviousOrder,
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

/** What `page.tsx` renders after a reload: the vessel landed its order, so it comes back empty. */
const emptyBag = {
  cartId: 'cart_01ABC',
  lines: [],
  count: 0,
  subtotalLabel: 'R$ 0,00',
  discounts: [],
  totalLabel: 'R$ 0,00',
  couponCode: null,
};

const paidOrder = { orderId: 'ord_01PAID', number: 223, awaitingPayment: false };
const unpaidOrder = { orderId: 'ord_01OPEN', number: 224, awaitingPayment: true };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the attract panel after a reload that followed an order', () => {
  it('says nothing when there is no previous order — the ordinary idle till is unchanged', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} />);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByTestId('previous-order')).toBeNull();
    expect(screen.queryByTestId('resume-order')).toBeNull();
  });

  it('★★ names the order and says it was PAID — the question a reload leaves is "foi registrado?"', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={paidOrder} />);
    const said = screen.getByTestId('previous-order').textContent ?? '';
    expect(said).toContain('223');
    expect(said).toContain('registrado e pago');
    // ⚠️ And it does NOT send anybody looking for help over an order that is already settled.
    expect(said).not.toContain('atendente');
    // Nor does it offer to resume a payment that already happened — that button would be a second charge
    // waiting for a finger.
    expect(screen.queryByTestId('resume-order')).toBeNull();
  });

  it('★★ says the order is still UNPAID, and the two states never collapse into one sentence', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />);
    const said = screen.getByTestId('previous-order').textContent ?? '';
    expect(said).toContain('224');
    expect(said).toContain('ainda não foi pago');
    expect(said).not.toContain('registrado e pago');
  });

  it('★★★ C5 — an UNPAID order gets a way out, not just a sentence about it', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />);
    const button = screen.getByTestId('resume-order');
    expect(button.textContent).toContain('224');
    // ⚠️ THE SENTENCE MUST POINT AT THE BUTTON. The pk9 copy sent the person to find a human, which is now
    // the wrong errand: the till can finish this order itself.
    expect(screen.getByTestId('previous-order').textContent ?? '').not.toContain('atendente');
  });

  it('★★ and the tap recovers THAT order by id — the screen names it, it does not remember a payment', () => {
    resumePreviousOrder.mockResolvedValue({ ok: false, kind: 'gone' });
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />);
    fireEvent.click(screen.getByTestId('resume-order'));
    expect(resumePreviousOrder).toHaveBeenCalledWith('ord_01OPEN');
  });

  it('⛔ and NOTHING asks the port while the panel is merely drawn — a render must never reach a payment', () => {
    // The panel redraws on its own (the idle clock, the glow, any parent re-render). A recovery wired to the
    // render would ask the port about somebody else's order on every one of them, which is precisely the
    // reason the kit restricts the payment-resume door to an explicit act of the buyer.
    const { rerender } = render(
      <Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />,
    );
    rerender(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />);
    expect(resumePreviousOrder).not.toHaveBeenCalled();
  });

  it('★ the next customer can still start — the notice is a line, never a wall', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={paidOrder} />);
    // The attract panel is one button; the notice lives INSIDE it, so the tap that starts an order still lands.
    expect(screen.getByTestId('previous-order').closest('button')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });

  it('★★ and it stays a line even with the recovery on screen — the resume button is a SIBLING, not a child', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} previousOrder={unpaidOrder} />);
    const attract = screen.getByText('Toque para começar').closest('button');
    expect(attract).toBeTruthy();
    // ⚠️ A `<button>` inside a `<button>` is invalid HTML and hydrates wrong. The recovery must be beside the
    // attract panel, and the next customer's tap must still reach it.
    expect(attract?.contains(screen.getByTestId('resume-order'))).toBe(false);
  });
});
