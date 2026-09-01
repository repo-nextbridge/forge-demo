// Progressive enhancement: the "Adicionar ao carrinho" is a NATIVE form (a real submit + a bound action) — so it
// works with no JS (the action redirects to /checkout, the v0.1 fallback). With JS, submitting is intercepted:
// it adds through the port and opens the drawer instead of navigating (the shopper stays on the page).

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { AddToCartForm } from './AddToCartForm';
import type { MinicartActions } from './MinicartProvider';
import { MinicartProvider, useMinicart } from './MinicartProvider';

function actions(): MinicartActions {
  return {
    readCart: vi.fn(async () => ({
      lines: [],
      totalizers: [],
      totalAmount: 0,
      currency: 'BRL',
      count: 0,
    })),
    addLine: vi.fn(async () => {}),
    updateLine: vi.fn(async () => {}),
    removeLine: vi.fn(async () => {}),
  };
}

function OpenSpy() {
  const { open } = useMinicart();
  return <span data-testid="is-open">{String(open)}</span>;
}

// PRE-S7-STOREFRONT-DEBT — this used to assert `method="post"` ON THE ELEMENT, which is what the component
// declared and what made the PDP hydrate into a mismatch: React OWNS the method of a form whose `action` is a
// function (a Server Action) — it writes POST into the server HTML and overrides whatever we set on the client.
// The invariant this test protects is unchanged (the base is a real, submittable, no-JS form); what it asserts
// is now the TRUE form of it — the element carries no method of OURS, because React supplies it.
test('the base is a native <form> whose method React owns, with a submit button — works without JS', () => {
  render(
    <MinicartProvider actions={actions()}>
      <AddToCartForm action={vi.fn(async () => {})} skuId="sku_9" />
    </MinicartProvider>,
  );
  const form = screen.getByTestId('add-to-cart-form') as HTMLFormElement;
  expect(form.tagName).toBe('FORM');
  expect(form.getAttribute('method')).toBeNull(); // never ours — React's (POST), or the mismatch is back
  const btn = screen.getByTestId('add-to-cart') as HTMLButtonElement;
  expect(btn.type).toBe('submit');
});

test('with JS, submitting adds via the port and opens the drawer (no navigation)', async () => {
  const fakeAction = vi.fn(async () => {});
  const acts = actions();
  render(
    <MinicartProvider actions={acts}>
      <AddToCartForm action={fakeAction} skuId="sku_9" />
      <OpenSpy />
    </MinicartProvider>,
  );
  fireEvent.submit(screen.getByTestId('add-to-cart-form'));
  await waitFor(() => expect(acts.addLine).toHaveBeenCalledWith('sku_9'));
  await waitFor(() => expect(screen.getByTestId('is-open').textContent).toBe('true'));
  // The no-JS redirect action never runs on the JS path (preventDefault).
  expect(fakeAction).not.toHaveBeenCalled();
});
