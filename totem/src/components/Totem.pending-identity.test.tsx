// ★★ THE REVIEW SCREEN STOPS CALLING A PROVISIONAL TOTAL FINAL — and goes on saying nothing when it is final.
//
// ── THE DEFECT, MEASURED. The review printed R$ 153,00 and the QR charged R$ 137,40. Neither number was
// wrong: the review runs over a cart with nobody on it, and "10% na primeira compra" cannot be judged until
// `cart.set_buyer`, which this counter sends 43 ms before it closes the order. What was wrong was the
// SILENCE — a screen with one bit ("is there a discount row?") cannot tell "nothing to earn here" from "this
// total is still open", so it printed an open number in the size of a settled bill.
//
// So every case here is about what the screen SAYS, never about what it computes, and the negative cases
// carry the same weight as the positive one: a notice that appears over a settled total would be the same
// defect wearing the other mask.
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Bag } from '@/lib/view';

vi.mock('@/app/actions', () => ({
  resetCounter: vi.fn(),
  payWith: vi.fn(),
  applyCoupon: vi.fn(),
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

/** The measured basket: R$ 156,00 of coffee, one combo already taken, and the first-purchase promotion still
 *  unjudged because nobody has said who they are. */
const bag = (over: Partial<Bag> = {}): Bag => ({
  cartId: 'cart_01ABC',
  lines: [
    {
      lineId: 'cl_1',
      skuId: 'sku_1',
      name: 'Espresso Forge',
      variant: 'Curto',
      imageUrl: undefined,
      qty: 12,
      lineTotalLabel: 'R$ 156,00',
    },
  ],
  count: 12,
  subtotalLabel: 'R$ 156,00',
  discounts: [{ title: 'Combo da manhã · R$ 3,00 OFF', amountLabel: '−R$ 3,00' }],
  totalLabel: 'R$ 153,00',
  pendingIdentity: [{ promotionId: 'promo_A', label: '10% na primeira compra' }],
  couponCode: null,
  ...over,
});

function tap(label: string | RegExp) {
  const el = screen.getByText(label).closest('button');
  if (!el) throw new Error(`no button behind ${String(label)}`);
  act(() => {
    el.click();
  });
}

/** Attract → menu → review. Where a finger actually is when it reads the total. */
function walkToReview(initialBag: Bag) {
  render(<Totem initialMenu={menu} initialBag={initialBag} idleSeconds={90} />);
  tap('Toque para começar');
  tap('Revisar pedido');
}

describe('the review when a promotion is still waiting on an identity', () => {
  it('★ NAMES the promotion, in the merchant’s own words', () => {
    walkToReview(bag());
    expect(screen.getByTestId('pending-identity')).toBeTruthy();
    expect(screen.getByTestId('pending-identity-label').textContent).toBe('10% na primeira compra');
  });

  it('⛔ prints NO MONEY inside the notice — not the promotion’s value, not a saving, not a total', () => {
    // Identifying can leave the promotion REFUSED (a returning customer earns no first-purchase discount),
    // so any figure here is a promise the engine already declined to make. The contract carries none, and
    // this is the guard that keeps a helpful afternoon from adding one.
    //
    // ⚠️ IT IS NOT "NO DIGITS". The label is the MERCHANT'S own words and the measured one reads "10% na
    // primeira compra" — a percentage inside a name is the merchant naming their promotion, and paraphrasing
    // it would be this screen editing the store's copy. What may never appear is an AMOUNT.
    walkToReview(bag());
    const text = screen.getByTestId('pending-identity').textContent ?? '';
    expect(text).not.toMatch(/R\$/);
    expect(text).not.toMatch(/\d+[.,]\d\d/);
  });

  it('★ is an OFFER and not a fault — it interrupts nothing and raises no alarm', () => {
    walkToReview(bag());
    const notice = screen.getByTestId('pending-identity');
    expect(notice.getAttribute('role')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('★★ withdraws the claim that the total is final, without promising it will fall', () => {
    walkToReview(bag());
    expect(screen.getByText('Total parcial')).toBeTruthy();
    expect(screen.queryByText('Total')).toBeNull();
    // ⚠️ AND THE NUMBER ITSELF IS UNTOUCHED. The kernel's total is the only total this screen may print;
    // what changed is the sentence around it.
    expect(screen.getByText('R$ 153,00')).toBeTruthy();
  });

  it('★★ the payment button states the figure as a CEILING, which is what it is', () => {
    // A promotion can only ever reduce a total, so "até" is exact — and it adds no second number to a screen
    // whose whole defect was asserting the first one too confidently.
    walkToReview(bag());
    tap('Ir para o pagamento');
    expect(screen.getByText(/^Pagar/).textContent).toBe('Pagar até R$ 153,00');
  });
});

describe('the review when nothing is waiting — the silence, which is the other half', () => {
  const settled = bag({ pendingIdentity: [] });

  it('★ says nothing at all', () => {
    walkToReview(settled);
    expect(screen.queryByTestId('pending-identity')).toBeNull();
  });

  it('★ calls the total a total, and states the figure flat on the button', () => {
    walkToReview(settled);
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.queryByText('Total parcial')).toBeNull();
    tap('Ir para o pagamento');
    expect(screen.getByText(/^Pagar/).textContent).toBe('Pagar R$ 153,00');
  });

});

describe('the pendency is stated ONCE, where the number is read', () => {
  it('★ the payment step carries the qualifier and NOT a second copy of the notice', () => {
    // The step after the review is the keyboard that asks for the name — the answer to the question, not a
    // place to repeat it. Two copies of one open question on two consecutive screens reads as two problems.
    walkToReview(bag());
    tap('Ir para o pagamento');
    expect(screen.queryByTestId('pending-identity')).toBeNull();
    expect(screen.getByText(/^Pagar/).textContent).toBe('Pagar até R$ 153,00');
  });
});
