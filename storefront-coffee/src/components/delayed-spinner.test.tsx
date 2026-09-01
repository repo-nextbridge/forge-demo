// The delayed-spinner INVENTORY (S7-SF-CLOSE belt). The doctrine (useDelayedFlag): storefront mutations are
// OPTIMISTIC — the UI updates at once and a progress indicator appears ONLY after the mutation outlives 1s.
//
// The mutation surfaces of the theme and how each honors it:
//   · add-to-cart (PDP form)   — AddToCartForm     → "Adicionando…" gated on useDelayedFlag(busy)
//   · pdp-add-to-cart (buybox) — PdpBuyRow         → "Adicionando…" gated on useDelayedFlag(busy)
//   · bought-together add      — BundlePair        → "Adicionando…" gated on useDelayedFlag(busy)
//   · CEP quote (PDP)          — CepBox            → "Calculando…"  gated on useDelayedFlag(quoting)
//   · qty change / remove      — MinicartDrawer    — DISABLE-only (optimistic re-read, NO instant spinner)
//   · save profile / address   — Profile/AddressForm — validate → Server Action; NO instant spinner
//   · remove address           — InlineConfirm     — two-step confirm → Server Action; NO instant spinner
// A mutation that flashes an indicator INSTANTLY (before 1s) violates the doctrine — the behavioural proof
// below pins the representative wiring (AddToCartForm); the other three use the identical useDelayedFlag(busy).

import { EMPTY_SNAPSHOT } from '@forgecommerce/storefront-kit/minicart-types';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AddToCartForm } from './minicart/AddToCartForm';
import { MinicartProvider } from './minicart/MinicartProvider';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('add-to-cart shows NO spinner before 1s and the label only after (optimistic + delayed)', () => {
  // A mutation that never resolves → `busy` stays true, so the only thing that flips the label is the 1s delay.
  const actions = {
    readCart: async () => EMPTY_SNAPSHOT,
    addLine: () => new Promise<void>(() => {}), // never resolves
    updateLine: async () => {},
    removeLine: async () => {},
  };
  render(
    <MinicartProvider actions={actions}>
      <AddToCartForm action={async () => {}} skuId="sku_1" label="Adicionar ao carrinho" />
    </MinicartProvider>,
  );
  const button = screen.getByTestId('add-to-cart');
  act(() => {
    fireEvent.submit(screen.getByTestId('add-to-cart-form'));
  });

  // In-flight but under the threshold: the button is disabled (no double-submit) but the label has NOT changed.
  expect(button.textContent).toBe('Adicionar ao carrinho');
  expect((button as HTMLButtonElement).disabled).toBe(true);

  // Just under 1s: still no spinner.
  act(() => {
    vi.advanceTimersByTime(999);
  });
  expect(button.textContent).toBe('Adicionar ao carrinho');

  // Past 1s: the mutation earned its indicator.
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(button.textContent).toBe('Adicionando…');
});
