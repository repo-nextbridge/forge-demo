// BuyButton — "Comprar" adds the SKU to the cookie cart (the Server Action) and navigates to /checkout. NOTE
// 3: a double-click must NOT fire the action twice (which could create two carts before the cookie is set) —
// the button disables while the first add is in flight.

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

const addToCartAction = vi.fn(async (_store: string, _skuId: string) => {});
const push = vi.fn();
vi.mock('@/lib/cart-actions', () => ({
  addToCartAction: (store: string, skuId: string) => addToCartAction(store, skuId),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

test('clicking Comprar adds the SKU to the cart then navigates to /checkout', async () => {
  const { BuyButton } = await import('./BuyButton');
  render(<BuyButton base={HOST_BASE} store="sto_a" skuId="sku_9" />);
  fireEvent.click(screen.getByTestId('buy-button'));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/checkout'));
  expect(addToCartAction).toHaveBeenCalledWith('sto_a', 'sku_9');
});

test('★ a double-click does not add twice (debounce — no second cart)', async () => {
  addToCartAction.mockClear();
  push.mockClear();
  let resolveAdd: () => void = () => {};
  addToCartAction.mockImplementationOnce(() => new Promise<void>((r) => (resolveAdd = () => r())));
  const { BuyButton } = await import('./BuyButton');
  render(<BuyButton base={HOST_BASE} store="sto_a" skuId="sku_9" />);
  const btn = screen.getByTestId('buy-button');

  fireEvent.click(btn); // first add: in flight (pending)
  fireEvent.click(btn); // second click while busy: ignored
  fireEvent.click(btn);
  expect(addToCartAction).toHaveBeenCalledTimes(1);

  resolveAdd(); // let the first add settle
  await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
});
