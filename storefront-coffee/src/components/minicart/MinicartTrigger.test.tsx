// The header counter reflects the cart: 0 (empty / not yet loaded) hides the badge; N shows N. The count is
// SEEDED post-mount by the injected readCart (the httpOnly cookie is re-read server-side), so the badge lights
// up just after hydration. Clicking the trigger opens the drawer instead of navigating (progressive: the base
// is still a real <a href="/checkout">).

import {
  EMPTY_SNAPSHOT,
  type MinicartSnapshot,
} from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { MinicartActions } from './MinicartProvider';
import { MinicartProvider, useMinicart } from './MinicartProvider';
import { MinicartTrigger } from './MinicartTrigger';

const SNAP: MinicartSnapshot = {
  lines: [
    {
      line_id: 'ln_1',
      sku_id: 'sku_1',
      qty: 2,
      unit_amount: 5000,
      line_total: 10000,
      title: 'Tênis',
    },
  ],
  totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: 10000 }],
  totalAmount: 10000,
  currency: 'BRL',
  count: 2,
};

function actionsFor(snap: MinicartSnapshot): MinicartActions {
  return {
    readCart: vi.fn(async () => snap),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
}

function OpenSpy() {
  const { open } = useMinicart();
  return <span data-testid="is-open">{String(open)}</span>;
}

test('count 2 → badge shows "2"; the aria-label carries the count', async () => {
  render(
    <MinicartProvider actions={actionsFor(SNAP)}>
      <MinicartTrigger base={HOST_BASE} />
    </MinicartProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('minicart-count').textContent).toBe('2'));
  expect(screen.getByTestId('minicart-trigger').getAttribute('aria-label')).toBe('Carrinho (2)');
});

test('count 0 (empty) → NO badge, plain "Carrinho" label', async () => {
  render(
    <MinicartProvider actions={actionsFor(EMPTY_SNAPSHOT)}>
      <MinicartTrigger base={HOST_BASE} />
    </MinicartProvider>,
  );
  // Give the mount refresh a tick; the badge must never appear.
  await waitFor(() =>
    expect(screen.getByTestId('minicart-trigger').getAttribute('aria-label')).toBe('Carrinho'),
  );
  expect(screen.queryByTestId('minicart-count')).toBeNull();
});

test('the base is a real link to /checkout, but clicking opens the drawer (preventDefault)', async () => {
  render(
    <MinicartProvider actions={actionsFor(SNAP)}>
      <MinicartTrigger base={HOST_BASE} />
      <OpenSpy />
    </MinicartProvider>,
  );
  const trigger = screen.getByTestId('minicart-trigger');
  expect(trigger.getAttribute('href')).toBe('/checkout'); // no-JS fallback
  expect(screen.getByTestId('is-open').textContent).toBe('false');
  fireEvent.click(trigger);
  await waitFor(() => expect(screen.getByTestId('is-open').textContent).toBe('true'));
});
