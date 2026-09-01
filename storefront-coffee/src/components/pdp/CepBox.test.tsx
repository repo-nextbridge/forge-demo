// S7-SF-PDP — the PDP CEP box: typing a full CEP quotes shipping (options fade in), and PERSISTS the CEP on the
// cart (setPdpCepAction). Re-opening the PDP with a persisted CEP pre-fills the field and quotes on mount — the
// proof of the round-trip (PDP → checkout → back, CEP kept).
//
// PERF-B — that persisted CEP is now ASKED FOR (cartPostalCodeAction) instead of arriving as a server-rendered
// prop: the PDP's HTML is edge-cached, so the page may not read the cart cookie. Both paths are covered below —
// the fetched one (the real one) and the `initialCep` override the preview gallery still uses.

import type { ShippingOption } from '@forgecommerce/storefront-kit/read-client';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

const setPdpCepAction = vi.fn(
  async (_store: string, _cep: string, _skuId?: string): Promise<ShippingOption[]> => [],
);
const cartPostalCodeAction = vi.fn(async (_store: string): Promise<string | null> => null);
vi.mock('@/lib/cart-actions', () => ({
  setPdpCepAction: (store: string, cep: string, skuId?: string) =>
    setPdpCepAction(store, cep, skuId),
  cartPostalCodeAction: (store: string) => cartPostalCodeAction(store),
}));

const OPTIONS: ShippingOption[] = [
  {
    method_id: 'std',
    method_name: 'Padrão',
    price: 0,
    undiscounted_price: 0,
    free_applied: false,
    delivery_min_days: 3,
    delivery_max_days: 5,
  },
  {
    method_id: 'exp',
    method_name: 'Expresso',
    price: 2490,
    undiscounted_price: 2490,
    free_applied: false,
    delivery_min_days: 1,
    delivery_max_days: 2,
  },
];

test('typing a complete CEP quotes shipping and fades the options in (Grátis + price)', async () => {
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  // the CEP was persisted on the cart (the 8 digits)
  await waitFor(() => expect(setPdpCepAction).toHaveBeenCalledWith('sto_a', '01310100', undefined));
  // the kernel-priced options render
  await waitFor(() => {
    const box = getByTestId('pdp-cep-options');
    expect(box.textContent).toContain('Padrão');
    expect(box.textContent).toContain('Grátis');
    expect(box.textContent).toContain('Expresso');
    expect(box.textContent).toContain('24,90');
  });
});

// ── SHIP-ADM DoD 6 (storefront half) — "Grátis" carries the price it replaced ──────────────────────────
//
// ★ A RENDER TEST, not a screen sweep: `tsc` and jsdom are blind to layout but they DO see whether an element
// exists, and this is a fact about markup — the struck-through number is either in the DOM or it is not. The
// value can only be there because the port stopped throwing it away (`undiscounted_price`), so this test also
// pins the reason the read grew a field.
//
// ★ AND IT PINS THE DISTINCTION THE PORT DRAWS. `free_applied` means a THRESHOLD was cleared, so there is a
// saving to show. A method that simply costs nothing is also "Grátis" and has NO strike-through: telling the
// shopper they saved R$ 0,00 would be an invented claim, and reading `price === 0` as "free shipping applied"
// is exactly how that gets shipped.
const FREE_APPLIED: ShippingOption[] = [
  {
    method_id: 'std',
    method_name: 'Padrão',
    price: 0,
    undiscounted_price: 2490,
    free_applied: true,
    delivery_min_days: 3,
    delivery_max_days: 5,
  },
  {
    method_id: 'own',
    method_name: 'Retirada',
    price: 0,
    undiscounted_price: 0,
    free_applied: false,
    delivery_min_days: 0,
    delivery_max_days: 0,
  },
];

test('★★ a free option renders "Grátis" WITH the full price struck through — and a zero-cost one does not', async () => {
  setPdpCepAction.mockReset();
  setPdpCepAction.mockResolvedValueOnce(FREE_APPLIED);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  await waitFor(() => {
    const box = getByTestId('pdp-cep-options');
    expect(box.textContent).toContain('Grátis');
    // The saving is the number the shopper reads, and it is in a <s> — struck through, not merely printed.
    const struck = box.querySelectorAll('s');
    expect(struck).toHaveLength(1);
    expect(struck[0]?.textContent).toContain('24,90');
  });

  // Two options are free; only ONE of them waived a price, so only one carries a strike-through.
  expect(getByTestId('pdp-cep-options').textContent).toContain('Retirada');
});

test('a partial CEP does not quote (waits for the 8th digit)', async () => {
  setPdpCepAction.mockClear();
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);
  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310' } });
  expect(setPdpCepAction).not.toHaveBeenCalled();
});

test('leva-4 #8: a valid CEP with NO options shows the out-of-coverage message (no silent failure)', async () => {
  setPdpCepAction.mockClear();
  setPdpCepAction.mockResolvedValueOnce([]);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  const msg = await waitFor(() => getByTestId('pdp-cep-message'));
  expect(msg.textContent).toContain('Não entregamos nesse CEP');
  expect(msg.getAttribute('data-variant')).toBe('empty');
});

test('leva-4 #8: a failed quote shows the retry message (was a silent degrade)', async () => {
  setPdpCepAction.mockClear();
  setPdpCepAction.mockRejectedValueOnce(new Error('boom'));
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  const msg = await waitFor(() => getByTestId('pdp-cep-message'));
  expect(msg.textContent).toContain('Não foi possível calcular agora');
  expect(msg.getAttribute('data-variant')).toBe('error');
});

test('leva-4 #8: an incomplete CEP is neutral — no message, no options', async () => {
  setPdpCepAction.mockClear();
  const { CepBox } = await import('./CepBox');
  const { getByTestId, queryByTestId } = render(<CepBox store="sto_a" />);
  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310' } });
  expect(queryByTestId('pdp-cep-message')).toBeNull();
  expect(setPdpCepAction).not.toHaveBeenCalled();
});

test('re-opening with a persisted CEP pre-fills the field AND quotes on mount (the round-trip)', async () => {
  setPdpCepAction.mockClear();
  cartPostalCodeAction.mockClear();
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" initialCep="01310100" />);

  // the field shows the masked persisted CEP
  expect((getByTestId('pdp-cep-input') as HTMLInputElement).value).toBe('01310-100');
  // and it quoted on mount without the shopper typing
  await waitFor(() => expect(setPdpCepAction).toHaveBeenCalledWith('sto_a', '01310100', undefined));
  // the override short-circuits the round trip: no need to ask the cart for what we were handed
  expect(cartPostalCodeAction).not.toHaveBeenCalled();
});

test('PERF-B: with no prop, the box ASKS the cart for the persisted CEP, fills it and quotes', async () => {
  setPdpCepAction.mockClear();
  cartPostalCodeAction.mockClear();
  cartPostalCodeAction.mockResolvedValueOnce('01310100');
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  await waitFor(() => expect(cartPostalCodeAction).toHaveBeenCalledWith('sto_a'));
  await waitFor(() =>
    expect((getByTestId('pdp-cep-input') as HTMLInputElement).value).toBe('01310-100'),
  );
  await waitFor(() => expect(setPdpCepAction).toHaveBeenCalledWith('sto_a', '01310100', undefined));
});

test('PERF-B: no cart / no persisted CEP → the box starts empty and quotes nothing', async () => {
  setPdpCepAction.mockClear();
  cartPostalCodeAction.mockClear();
  cartPostalCodeAction.mockResolvedValueOnce(null);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  await waitFor(() => expect(cartPostalCodeAction).toHaveBeenCalledWith('sto_a'));
  expect((getByTestId('pdp-cep-input') as HTMLInputElement).value).toBe('');
  expect(setPdpCepAction).not.toHaveBeenCalled();
});

// ── ★ QA-PACK-1 C2 — the box asks about the PRODUCT, not about the cart ──────────────────────────────────
//
// On the bench the same CEP answered "Não entregamos nesse CEP" with an empty cart and quoted correctly after
// an item was added: the cart quote returns an empty list when there are no lines, and this box reads an empty
// list as "out of coverage". Consulting shipping BEFORE deciding to buy is what this box is for, so the shopper
// was hearing a false no about their own address.
//
// The kernel half (a `sku_id` path on read.shipping_options, priced from the SKU row) is proven in
// apps/api/src/shipping.e2e.test.ts. What belongs here is the wiring: the box says WHICH product it is asking
// about, so an empty cart is no longer part of the question.

test('★ the PDP box quotes the resolved SKU — the empty cart stops being part of the question', async () => {
  setPdpCepAction.mockClear();
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" skuId="sku_42" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  // The CEP is still persisted on the cart (the PDP → checkout round trip is untouched) AND the quote now
  // names the product.
  await waitFor(() => expect(setPdpCepAction).toHaveBeenCalledWith('sto_a', '01310100', 'sku_42'));
  await waitFor(() => expect(getByTestId('pdp-cep-options').textContent).toContain('Expresso'));
});

test('with no SKU (the preview gallery) the box behaves exactly as before', async () => {
  // The examples render <CepBox store="demo" /> with no product in sight; that path must keep working, and it
  // is also what a host that knows no SKU gets. Absence degrades to the old question, never to an error.
  setPdpCepAction.mockClear();
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });
  await waitFor(() => expect(setPdpCepAction).toHaveBeenCalledWith('sto_a', '01310100', undefined));
});

// ── ★★ QA9 · A5 — THE BOX PRINTS THE KERNEL'S WINDOW, AND NOTHING ELSE ──────────────────────────────────────
//
// This is the one component that used to ADD the backorder's days to the window it displayed, from an
// `extraDays` prop. It was right on screen and wrong everywhere else: the checkout two clicks later, the
// frozen order snapshot and every date derived from it (the account page, the admin sheet, the confirmation)
// read the un-extended number, because the sum lived in a component instead of in the quote. The QA measured
// the gap end to end — "11 a 12 dias" here, "1 a 2 dias" at the checkout, and a confirmation date the store
// could not hold (g1e-1). The sum now happens in `shipping/quote-cart.ts`; these two tests are the fence that
// keeps it from coming back here.
test('★ the backorder window arrives ALREADY extended and is printed verbatim', async () => {
  // What the kernel answers for a basket owing ten days on a 3–5 method: 13–15. The box adds nothing to it.
  setPdpCepAction.mockResolvedValueOnce([
    { ...(OPTIONS[1] as ShippingOption), delivery_min_days: 13, delivery_max_days: 15 },
  ]);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" skuId="sku_1" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  await waitFor(() => {
    const box = getByTestId('pdp-cep-options');
    expect(box.textContent).toContain('13 a 15 dias úteis');
    // The PRICES are untouched either way (the kernel prices, not us).
    expect(box.textContent).toContain('24,90');
  });
});

test('★ THE FENCE — the windows are byte-for-byte the kernel’s', async () => {
  setPdpCepAction.mockResolvedValueOnce(OPTIONS);
  const { CepBox } = await import('./CepBox');
  const { getByTestId } = render(<CepBox store="sto_a" skuId="sku_1" />);

  fireEvent.change(getByTestId('pdp-cep-input'), { target: { value: '01310-100' } });

  await waitFor(() => {
    const box = getByTestId('pdp-cep-options');
    expect(box.textContent).toContain('3 a 5 dias úteis');
    expect(box.textContent).toContain('1 a 2 dias úteis');
  });
});
