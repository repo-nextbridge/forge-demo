// ★★ WHAT THE GLASS SAYS AFTER A RELOAD — the voice half of pk9/d1 (04/09).
//
// The owner's report, verbatim: "se eu fizer um pedido e ir até o final e só recarregar a página … ele vai
// para a tela bloqueada e eu consigo começar outro pedido mas não terminar, vai até a parte de pagar mas
// quando aperto pagar dá um erro." The till's own container log, from that session, five times over:
//
//     [totem] payWith refused by the port — payment.initiate · validation_failed: order not payable
//
// The "tela bloqueada" is the attract panel: a reload is the one exit from this flow that never reaches
// `resetCounter`, so the React state is gone and the cookie is not. `lib/cart.ts` stops the till from reusing
// that spent cart; this file is about the OTHER half — the attract panel said nothing at all about an order
// that had just been placed, so the person standing there could not tell whether it had gone through.
//
// ⚠️ THE TWO STATES ARE TWO DIFFERENT INSTRUCTIONS, and that is why one message would have been wrong. A PAID
// order needs nobody. An order left AWAITING PAYMENT — a reload over the pix QR — is a real order this screen
// can no longer settle at all: `providerRef` lived in this component's state and the reload destroyed it.
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions', () => ({
  resetCounter: vi.fn().mockResolvedValue({ bag: null }),
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

/** What `page.tsx` renders after a reload: the vessel landed its order, so it comes back empty. */
const emptyBag = {
  cartId: 'cart_01ABC',
  lines: [],
  count: 0,
  subtotalLabel: 'R$ 0,00',
  discountLabel: null,
  discountTitle: null,
  totalLabel: 'R$ 0,00',
  couponCode: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the attract panel after a reload that followed an order', () => {
  it('says nothing when there is no previous order — the ordinary idle till is unchanged', () => {
    render(<Totem initialMenu={menu} initialBag={emptyBag} idleSeconds={90} />);
    expect(screen.getByText('Toque para começar')).toBeTruthy();
    expect(screen.queryByTestId('previous-order')).toBeNull();
  });

  it('★★ names the order and says it was PAID — the question a reload leaves is "foi registrado?"', () => {
    render(
      <Totem
        initialMenu={menu}
        initialBag={emptyBag}
        idleSeconds={90}
        previousOrder={{ number: 223, awaitingPayment: false }}
      />,
    );
    const said = screen.getByTestId('previous-order').textContent ?? '';
    expect(said).toContain('223');
    expect(said).toContain('registrado e pago');
    // ⚠️ And it does NOT send anybody looking for help over an order that is already settled.
    expect(said).not.toContain('atendente');
  });

  it('★★ and calls for a human when the order is still AWAITING PAYMENT — this screen cannot settle it', () => {
    render(
      <Totem
        initialMenu={menu}
        initialBag={emptyBag}
        idleSeconds={90}
        previousOrder={{ number: 224, awaitingPayment: true }}
      />,
    );
    const said = screen.getByTestId('previous-order').textContent ?? '';
    expect(said).toContain('224');
    expect(said).toContain('ainda não foi pago');
    expect(said).toContain('atendente');
    // The two states must not collapse into one sentence: an unpaid order must never read as settled.
    expect(said).not.toContain('registrado e pago');
  });

  it('★ and the next customer can still start — the notice is a line, never a wall', () => {
    render(
      <Totem
        initialMenu={menu}
        initialBag={emptyBag}
        idleSeconds={90}
        previousOrder={{ number: 223, awaitingPayment: false }}
      />,
    );
    // The attract panel is one button; the notice lives INSIDE it, so the tap that starts an order still lands.
    expect(screen.getByTestId('previous-order').closest('button')).toBeTruthy();
    expect(screen.getByText('Toque para começar')).toBeTruthy();
  });
});
