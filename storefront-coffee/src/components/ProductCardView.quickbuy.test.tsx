// QA6/A7 — the listing card's QUICK BUY, asserted against the CART, never against a spy.
//
// ★ WHY THIS FILE EXISTS SEPARATELY FROM ProductCardView.test.tsx. That suite proves the island's WIRING (the
// 2-click contract, the resolved sku, the debounce) by watching `addLine` get called. Every one of its tests
// stayed green through the whole of the defect QA reported: "Comprar" on a listing card sold nothing, in
// silence. A spy cannot tell the difference between a shopper who bought and a shopper who clicked and got
// nothing, because the only thing it knows is that the code it was handed ran.
//
// So the assertions here are about the CART AFTER the click — the snapshot the provider re-read from the port,
// rendered by a probe — and about what the SHOPPER can read on the card while the click that sells is still
// pending. The fake port below is a real little cart: it keeps lines, and `readCart` answers from them.

import type { MinicartSnapshot } from '@forgeco/storefront-kit/minicart-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { CartModel } from '@/lib/cardModel';
import { type MinicartActions, MinicartProvider, useMinicart } from './minicart/MinicartProvider';
import { type ProductCardData, ProductCardView } from './ProductCardView';

/** A product with a real choice to make (one size axis). */
const WITH_SIZES: CartModel = {
  currency: 'BRL',
  defaultSkuId: 'sku_37',
  options: [
    {
      optionId: 'size',
      name: 'Tamanho',
      kind: 'text',
      values: [
        { valueId: '36', label: '36' },
        { valueId: '37', label: '37' },
        { valueId: '38', label: '38' },
      ],
    },
  ],
  skus: [
    { id: 'sku_36', optionValues: { size: '36' } },
    { id: 'sku_37', optionValues: { size: '37' } },
    { id: 'sku_38', optionValues: { size: '38' } },
  ],
};

/** A product with NOTHING to choose — one sku, no options. */
const NO_CHOICE: CartModel = {
  currency: 'BRL',
  defaultSkuId: 'sku_only',
  options: [],
  skus: [{ id: 'sku_only', optionValues: {} }],
};

/** The port, as a cart that actually holds lines: `addLine` writes, `readCart` answers from what was written. */
function fakeCart(): MinicartActions & { lines: { sku: string; qty: number }[] } {
  const lines: { sku: string; qty: number }[] = [];
  const snapshot = (): MinicartSnapshot => ({
    lines: lines.map((l) => ({
      line_id: `line_${l.sku}`,
      sku_id: l.sku,
      qty: l.qty,
      unit_amount: 19990,
      line_total: 19990 * l.qty,
      title: 'Sapatilha',
    })),
    totalizers: [],
    totalAmount: lines.reduce((t, l) => t + 19990 * l.qty, 0),
    currency: 'BRL',
    count: lines.reduce((t, l) => t + l.qty, 0),
  });
  return {
    lines,
    readCart: async () => snapshot(),
    addLine: async (skuId: string, qty = 1) => {
      lines.push({ sku: skuId, qty });
    },
    updateLine: async () => {},
    removeLine: async () => {},
  };
}

/** Renders what the CART now holds — the assertion surface. Nothing here talks to the card. */
function CartProbe() {
  const { snapshot } = useMinicart();
  return (
    <p data-testid="cart">
      {snapshot.count} :: {snapshot.lines.map((l) => `${l.sku_id}x${l.qty}`).join(',')}
    </p>
  );
}

function props(model: CartModel): ProductCardData {
  return {
    href: '/p/x',
    title: 'Sapatilha',
    imageAlt: 'Sapatilha',
    sizes: '100vw',
    tags: [],
    price: 'R$ 199,90',
    installments: 'ou 3x de R$ 66,63',
    cart: true,
    model,
  };
}

function mount(model: CartModel) {
  const port = fakeCart();
  render(
    <MinicartProvider actions={port}>
      <ProductCardView {...props(model)} />
      <CartProbe />
    </MinicartProvider>,
  );
  return port;
}

const cart = () => screen.getByTestId('cart').textContent;

// ── The sale ────────────────────────────────────────────────────────────────────────────────────────────
// A card with no choice to make has nothing to open: the click the shopper reads as "buy" must BUY. Two clicks
// were what made the QA agent (and any shopper) conclude the button was dead — the first one changed a colour
// and sold nothing.
test('★ QA6/A7 — a card with NOTHING to choose sells on the FIRST click: the cart holds the sku afterwards', async () => {
  mount(NO_CHOICE);
  await waitFor(() => expect(cart()).toBe('0 :: ')); // the seeded (empty) re-read landed
  fireEvent.click(screen.getByTestId('card-cart-button'));
  await waitFor(() => expect(cart()).toBe('1 :: sku_onlyx1'));
});

// ── The mute ────────────────────────────────────────────────────────────────────────────────────────────
// With a choice to make the first click opens the chooser — that part is the design. What made it dead was
// that the control the shopper must press AGAIN says nothing: an icon that looks exactly like the one that was
// just pressed. The word is the fix, so the word is the assertion.
test('★ QA6/A7 — with variations the 1st click opens WITHOUT selling, and the button then SAYS what the 2nd click does', async () => {
  mount(WITH_SIZES);
  await waitFor(() => expect(cart()).toBe('0 :: '));
  const button = screen.getByTestId('card-cart-button');
  expect(button.textContent).toBe(''); // closed: the icon alone, labelled "Comprar"

  fireEvent.click(button);
  expect(screen.getByTestId('card-cart-panel').getAttribute('data-open')).not.toBeNull();
  expect(cart()).toBe('0 :: '); // nothing sold yet — and the shopper must be able to tell
  expect(button.textContent).toBe('Adicionar');
});

test('★ QA6/A7 — the 2nd click sells the SELECTED size: the cart holds sku_38, not the default', async () => {
  mount(WITH_SIZES);
  await waitFor(() => expect(cart()).toBe('0 :: '));
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  fireEvent.click(screen.getByTestId('card-value-38')); // choose 38
  fireEvent.click(screen.getByTestId('card-cart-button')); // add
  await waitFor(() => expect(cart()).toBe('1 :: sku_38x1'));
});

test('QA6/A7 — the qty stepper still feeds the sale (3 units of the chosen size land in the cart)', async () => {
  mount(WITH_SIZES);
  await waitFor(() => expect(cart()).toBe('0 :: '));
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  fireEvent.click(screen.getByTestId('card-qty-plus'));
  fireEvent.click(screen.getByTestId('card-qty-plus'));
  fireEvent.click(screen.getByTestId('card-cart-button')); // add
  await waitFor(() => expect(cart()).toBe('3 :: sku_37x3'));
});
