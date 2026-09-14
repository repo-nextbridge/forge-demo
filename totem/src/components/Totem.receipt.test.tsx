// ★★ THE RECEIPT ON THE GLASS HAS TO CLOSE — the confirmation screen, measured against its own arithmetic.
//
// ⛔ THE DEFECT. Measured at the counter on an order of eleven items: the "Pagamento confirmado" screen listed
// six lines at full price adding to R$ 156,00 and then, directly under them, "Total pago · Pix R$ 137,40".
// Nothing on the screen accounted for the R$ 18,60 between the two, and the order really did carry two
// promotions. The REVIEW screen of this same till knows how to print a discount row; the confirmation printed
// none at all — so the data was never the problem, the drawing was.
//
// ⚠️ AND THE ROWS ARE DERIVED FROM THE ORDER, never copied from the review. `payWith` hands back
// `bagOfOrder(read.order_confirmation)`; these cases feed exactly that shape and assert the screen prints it.
// A confirmation re-drawing the basket's numbers would be right only until the two disagreed — which is the
// one moment a customer needs it to be right.
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const payWith = vi.fn();
const resetCounter = vi.fn().mockResolvedValue({
  bag: { cartId: null, lines: [], count: 0, subtotalLabel: 'R$ 0,00', discounts: [], totalLabel: 'R$ 0,00', couponCode: null },
});

vi.mock('@/app/actions', () => ({
  resetCounter,
  payWith: (...a: unknown[]) => payWith(...a),
  addItem: vi.fn(),
  applyCoupon: vi.fn(),
  changeQty: vi.fn(),
  openProduct: vi.fn(),
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

const basket = {
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
  couponCode: null,
};

/**
 * ★ THE ORDER AS THE PORT PUBLISHED IT — the measured shape: lines at full price, two promotions, and a
 * `total_amount` that is neither the sum of the lines nor anything this screen could work out.
 */
const paidOrderBag = {
  cartId: null,
  lines: [
    {
      lineId: 'sku_1',
      skuId: 'sku_1',
      name: 'Espresso Forge',
      variant: '',
      imageUrl: undefined,
      qty: 3,
      lineTotalLabel: 'R$ 21,00',
    },
    {
      lineId: 'sku_2',
      skuId: 'sku_2',
      name: 'Pão de queijo',
      variant: '',
      imageUrl: undefined,
      qty: 3,
      lineTotalLabel: 'R$ 18,00',
    },
  ],
  count: 6,
  subtotalLabel: 'R$ 156,00',
  discounts: [
    { title: '10% na primeira compra', amountLabel: '−R$ 15,60' },
    { title: 'Combo da manhã · R$ 3,00 OFF', amountLabel: '−R$ 3,00' },
  ],
  totalLabel: 'R$ 137,40',
  couponCode: null,
};

function tap(label: string | RegExp) {
  const el = screen.getByText(label).closest('button');
  if (!el) throw new Error(`no button behind ${String(label)}`);
  act(() => {
    el.click();
  });
}

/** Attract → menu → bag → name → Cartão → Pagar. `settled` lands the flow straight on the receipt. */
async function walkToTheReceipt() {
  render(<Totem initialMenu={menu} initialBag={basket} idleSeconds={90} />);
  tap('Toque para começar');
  tap('Revisar pedido');
  tap('Ir para o pagamento');
  await act(async () => {});
  tap('Q');
  tap('Cartão');
  await act(async () => {
    screen.getByText(/^Pagar/).closest('button')?.click();
  });
  expect(screen.getByText('Pagamento confirmado')).toBeTruthy();
}

beforeEach(() => {
  vi.clearAllMocks();
  payWith.mockResolvedValue({
    ok: true,
    outcome: { kind: 'settled' },
    orderId: 'ord_01DONE',
    orderNumber: 210,
    buyerName: 'GUSTAVO',
    bag: paidOrderBag,
  });
});

describe('the confirmation prints the same rows the review does', () => {
  it('★★★ names every reduction the kernel applied — the gap between the lines and the total is explained', async () => {
    await walkToTheReceipt();
    expect(screen.getByText('10% na primeira compra')).toBeTruthy();
    expect(screen.getByText('−R$ 15,60')).toBeTruthy();
    expect(screen.getByText('Combo da manhã · R$ 3,00 OFF')).toBeTruthy();
    expect(screen.getByText('−R$ 3,00')).toBeTruthy();
  });

  it('★★ shows the subtotal the lines add up to, beside the total that was actually paid', async () => {
    await walkToTheReceipt();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getByText('R$ 156,00')).toBeTruthy();
    expect(screen.getByText('R$ 137,40')).toBeTruthy();
  });

  it('★ and still says what it was paid with, and the number the barista will call', async () => {
    await walkToTheReceipt();
    expect(screen.getByText(/Total pago · Cartão na maquininha/)).toBeTruthy();
    expect(screen.getByText('210')).toBeTruthy();
  });

  it('⛔ an order with NO discount gets no row of zero — a receipt invents nothing either', async () => {
    payWith.mockResolvedValue({
      ok: true,
      outcome: { kind: 'settled' },
      orderId: 'ord_01PLAIN',
      orderNumber: 211,
      buyerName: 'HELENA',
      bag: { ...paidOrderBag, discounts: [], subtotalLabel: 'R$ 15,00', totalLabel: 'R$ 15,00' },
    });
    await walkToTheReceipt();
    expect(screen.queryByText('10% na primeira compra')).toBeNull();
    expect(screen.queryByText('−R$ 0,00')).toBeNull();
    expect(screen.getByText('Subtotal')).toBeTruthy();
  });
});
