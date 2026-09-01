// ProductCardView — the card's interactive island (§2.8), driving the REAL cart. The contract, each asserted
// where it can break: a card WITH a choice opens on the 1st click (no add) and adds the RESOLVED variation via
// addAndOpen(skuId, qty) on the 2nd; a card with NO choice adds on the first; the panel closes on an outside
// click, "+N" shows the overflow, the qty stepper feeds the add, and a double-click never adds twice.
//
// ⚠️ These tests watch `addLine` — they prove the WIRING. What they cannot see is whether the shopper could
// have reached the control or understood it, which is the whole of what QA6/A7 was: see the sibling suites
// ProductCardView.quickbuy.test.tsx (the CART after the click) and ProductCardView.reachable.guard.test.ts
// (the click arriving at the control at all).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { CartModel } from '@/lib/cardModel';
import type { MinicartActions } from './minicart/MinicartProvider';
import { MinicartProvider } from './minicart/MinicartProvider';
import { type ProductCardData, ProductCardView } from './ProductCardView';

const MODEL: CartModel = {
  currency: 'BRL',
  defaultSkuId: 'sku_red_40',
  options: [
    {
      optionId: 'color',
      name: 'Cor',
      kind: 'swatch',
      values: [
        { valueId: 'red', label: 'Vermelho', swatchUrl: 'https://h/red.jpg' },
        { valueId: 'blue', label: 'Azul', swatchUrl: 'https://h/blue.jpg' },
      ],
    },
    {
      optionId: 'size',
      name: 'Tamanho',
      kind: 'text',
      values: [
        { valueId: '39', label: '39' },
        { valueId: '40', label: '40' },
      ],
    },
  ],
  skus: [
    { id: 'sku_red_39', optionValues: { color: 'red', size: '39' } },
    { id: 'sku_red_40', optionValues: { color: 'red', size: '40' } },
    { id: 'sku_blue_39', optionValues: { color: 'blue', size: '39' } },
    { id: 'sku_blue_40', optionValues: { color: 'blue', size: '40' } },
  ],
};

function props(model: CartModel = MODEL): ProductCardData {
  return {
    href: '/p/x',
    title: 'Tênis',
    imageAlt: 'Tênis',
    sizes: '100vw',
    tags: [],
    price: 'R$ 99,90',
    cart: true,
    model,
  };
}

function mount(model: CartModel = MODEL, over: Partial<MinicartActions> = {}) {
  const actions: MinicartActions = {
    readCart: vi.fn(async () => EMPTY_SNAPSHOT),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
    ...over,
  };
  render(
    <MinicartProvider actions={actions}>
      <ProductCardView {...props(model)} />
    </MinicartProvider>,
  );
  return actions;
}

test('★ 1st click opens (no add); 2nd click adds the default variation and collapses', async () => {
  const actions = mount();
  const panel = screen.getByTestId('card-cart-panel');
  const button = screen.getByTestId('card-cart-button');

  expect(panel.getAttribute('data-open')).toBeNull();
  fireEvent.click(button); // 1st
  expect(panel.getAttribute('data-open')).not.toBeNull();
  expect(actions.addLine).not.toHaveBeenCalled();

  fireEvent.click(button); // 2nd
  await waitFor(() => expect(actions.addLine).toHaveBeenCalledWith('sku_red_40', 1));
  await waitFor(() => expect(panel.getAttribute('data-open')).toBeNull());
});

test('★ 2nd click adds the SELECTED variation (color + size resolve to the right SKU)', async () => {
  const actions = mount();
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  fireEvent.click(screen.getByTestId('card-value-blue'));
  fireEvent.click(screen.getByTestId('card-value-39'));
  fireEvent.click(screen.getByTestId('card-cart-button')); // add
  await waitFor(() => expect(actions.addLine).toHaveBeenCalledWith('sku_blue_39', 1));
});

test('the qty stepper feeds the add (qty > 1)', async () => {
  const actions = mount();
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  fireEvent.click(screen.getByTestId('card-qty-plus'));
  fireEvent.click(screen.getByTestId('card-qty-plus'));
  expect(screen.getByTestId('card-qty').textContent).toBe('3');
  fireEvent.click(screen.getByTestId('card-cart-button')); // add
  await waitFor(() => expect(actions.addLine).toHaveBeenCalledWith('sku_red_40', 3));
});

test('★ a click outside closes the panel WITHOUT adding', async () => {
  const actions = mount();
  const panel = screen.getByTestId('card-cart-panel');
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  expect(panel.getAttribute('data-open')).not.toBeNull();
  fireEvent.mouseDown(document.body); // outside
  await waitFor(() => expect(panel.getAttribute('data-open')).toBeNull());
  expect(actions.addLine).not.toHaveBeenCalled();
});

test('★ "+N" shows the overflow when an option has more values than fit', () => {
  const many: CartModel = {
    ...MODEL,
    options: [
      {
        optionId: 'size',
        name: 'Tamanho',
        kind: 'text',
        values: Array.from({ length: 8 }, (_, i) => ({ valueId: `s${i}`, label: `${38 + i}` })),
      },
    ],
    skus: Array.from({ length: 8 }, (_, i) => ({
      id: `sku_${i}`,
      optionValues: { size: `s${i}` },
    })),
  };
  mount(many);
  fireEvent.click(screen.getByTestId('card-cart-button')); // open
  expect(screen.getByTestId('card-overflow').textContent).toBe('+4'); // 8 values, 4 visible → +4
});

// QA6/A7 — a single-SKU product has NOTHING to ask, so the first click is the sale. It used to open an empty
// pill (a qty stepper for a card that sells one unit) and wait for a second click nobody knew to make: the
// "Comprar que não vende" the QA round reported. There is no panel and no stepper on this card any more.
test('★ a single-SKU product has no panel and no stepper — the FIRST click adds the default', async () => {
  const single: CartModel = {
    currency: 'BRL',
    defaultSkuId: 'sku_only',
    options: [],
    skus: [{ id: 'sku_only', optionValues: {} }],
  };
  const actions = mount(single);
  expect(screen.queryByTestId('card-cart-panel')).toBeNull(); // no variation panel
  expect(screen.queryByTestId('card-qty')).toBeNull(); // no qty stepper it could never open
  fireEvent.click(screen.getByTestId('card-cart-button')); // add
  await waitFor(() => expect(actions.addLine).toHaveBeenCalledWith('sku_only', 1));
});

// OOS card (ronda3 #11) — out of stock on the card: the "Esgotado" badge shows and the quick-add pill is gone (the caller turns
// `cart` off for a sold-out product), but the stretched PDP link stays — the card is still clickable.
test('★ sold out: shows the "Esgotado" badge, drops the add pill, keeps the PDP link', () => {
  render(
    <MinicartProvider
      actions={{
        readCart: vi.fn(async () => EMPTY_SNAPSHOT),
        addLine: vi.fn(async () => {}),
        updateLine: vi.fn(async () => {}),
        removeLine: vi.fn(async () => {}),
      }}
    >
      <ProductCardView
        {...props()}
        cart={false}
        tags={[{ kind: 'sold-out', text: 'Esgotado', testId: 'tag-sold-out' }]}
      />
    </MinicartProvider>,
  );
  expect(screen.getByTestId('tag-sold-out').textContent).toBe('Esgotado');
  expect(screen.queryByTestId('card-cart-button')).toBeNull(); // no add path for a sold-out product
  expect(screen.getByRole('link', { name: 'Tênis' })).toBeTruthy(); // still opens the PDP
});

// A card WITHOUT the sold-out signal never shows the badge (the availability data is absent → today's behaviour).
test('not sold out: no "Esgotado" badge, the add pill is present', () => {
  mount();
  expect(screen.queryByTestId('tag-sold-out')).toBeNull();
  expect(screen.getByTestId('card-cart-button')).toBeTruthy();
});

// o4 #6a / #6b — layout contract, asserted against the CSS module (jsdom computes no layout). These are what stop
// the reported breakage: one card's open panel dragging its silent siblings taller, and the expanded add-bar
// stopping short of the card edge.
const cardCss = () =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ProductCardView.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // strip comments so prose ("NO height: 100%") never trips a regex
    .replace(/\s+/g, ' ');

test('o4 #6a — only the clicked card grows: the card is not tied to its row track (no percentage height) and the title reserves a fixed two lines', () => {
  const css = cardCss();
  // No `height: 100%` on the card — a percentage height would re-couple it to the (expanding) row track.
  expect(css).not.toMatch(/\.card\s*{[^}]*height:\s*100%/);
  // A fixed two-line title keeps every resting card the same height, so `align-items: start` rows stay even.
  expect(css).toMatch(/\.title\s*{[^}]*-webkit-line-clamp:\s*2/);
  expect(css).toMatch(/\.title\s*{[^}]*min-height:/);
});

test('o4 #6b — the expanded add-to-cart bar spans 100% of the card with no max-width cap', () => {
  const css = cardCss();
  expect(css).toMatch(/\.addPill\[data-open\]\s*{[^}]*width:\s*100%/);
  // The old ~160px/120px caps are gone, so the open orange stepper bar fills the card edge-to-edge.
  expect(css).not.toMatch(/\.addPill[^{]*{[^}]*max-width/);
});

test('★ a double-click (2nd + 3rd rapidly) never adds twice (debounce)', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const addLine = vi.fn(async () => {
    await gate;
  });
  const actions = mount(MODEL, { addLine });
  const button = screen.getByTestId('card-cart-button');
  fireEvent.click(button); // open
  fireEvent.click(button); // add (in flight — gate held)
  fireEvent.click(button); // ignored while busy
  release();
  await waitFor(() => expect(actions.addLine).toHaveBeenCalledTimes(1));
});

test('★ swatch chip images are DEFERRED until the card opens (no eager download on a listing)', () => {
  // The variation panel is collapsed (max-height:0) on a listing, but next/image's lazy loader still fetched a
  // 0-height-but-in-viewport chip — so every card on a PLP eagerly downloaded its color swatches. The image must
  // be mounted only once the panel actually opens (the only moment the chips are visible / a color is chosen).
  mount();
  expect(screen.getByTestId('card-value-red').querySelector('img')).toBeNull(); // closed → not mounted
  fireEvent.click(screen.getByTestId('card-cart-button')); // open the panel
  expect(screen.getByTestId('card-value-red').querySelector('img')).not.toBeNull(); // open → mounted
});
