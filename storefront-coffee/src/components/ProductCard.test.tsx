// CONN-MEDIA — the product card renders the read-port-resolved `url`, and degrades to the placeholder when no
// url is present (no media base configured).
// S6-IMAGES — plus: the cover is the first IMAGE by position, and its alt is the operator's (title fallback).
// S6-PRODUCT-CARD — plus: the cover the operator SET is the card's photo, and the "was" price struck through.
// S7-SF-HOME "v3" — plus: the ordered tags (Frete grátis → -N% → NOVO), the reserved rating row, the reserved
// struck-price height (the card never dances), and the installment line (from the payment app config, never a
// hardcoded "12x"). The chrome (free-shipping threshold / max installments) arrives as PROPS, so the card is a
// plain SYNC component; the tests render the SHELL with `cart={false}` (the interactive island is tested in
// ProductCardCart.test.tsx).

import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { render, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { makeProduct } from '@/test/fixtures';
import { ProductCard } from './ProductCard';

/** Render the card SHELL (no interactive island → no MinicartProvider needed). Queries are scoped to THIS
 * render's container, so a test that renders twice never collides on document.body. */
function renderShell(props: Omit<Parameters<typeof ProductCard>[0], 'base'>) {
  const { container } = render(<ProductCard base={HOST_BASE} cart={false} {...props} />);
  return { container, ...within(container) };
}

test('renders the resolved media url as the image src', () => {
  const product = makeProduct({
    media: [
      {
        provider_key: 'demo/x',
        kind: 'image',
        role: 'hero',
        position: 0,
        alt: null,
        url: 'https://h/media/demo/x',
      },
    ],
  });
  const { container } = renderShell({ product });
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://h/media/demo/x');
});

test('no url (base unset) → clean placeholder, no broken <img>', () => {
  const product = makeProduct({
    media: [{ provider_key: 'demo/x', kind: 'image', role: 'hero', position: 0, alt: null }],
  });
  const { container, getByLabelText } = renderShell({ product });
  expect(container.querySelector('img')).toBeNull();
  expect(getByLabelText('no image')).toBeTruthy();
});

test("the cover's alt is the operator's; without one it falls back to the product title", () => {
  const cover = {
    provider_key: 'demo/x',
    kind: 'image' as const,
    role: null,
    position: 0,
    url: 'https://h/media/demo/x',
  };
  const withAlt = renderShell({
    product: makeProduct({
      title: 'Tênis Runner',
      media: [{ ...cover, alt: 'Tênis verde de frente' }],
    }),
  });
  expect(withAlt.container.querySelector('img')?.getAttribute('alt')).toBe('Tênis verde de frente');
  const noAlt = renderShell({
    product: makeProduct({ title: 'Tênis Runner', media: [{ ...cover, alt: null }] }),
  });
  expect(noAlt.container.querySelector('img')?.getAttribute('alt')).toBe('Tênis Runner');
});

test('★ the COVER the operator set is the card photo — the first IMAGE by position, never a video', () => {
  const product = makeProduct({
    media: [
      { provider_key: 'demo/b', kind: 'image', role: null, position: 1, url: 'https://h/b.jpg' },
      {
        provider_key: 'demo/v',
        kind: 'video_external',
        role: null,
        position: 0,
        url: 'https://y/v',
      },
      { provider_key: 'demo/a', kind: 'image', role: null, position: 0, url: 'https://h/a.jpg' },
    ],
  });
  const { container } = renderShell({ product });
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://h/a.jpg');
});

test('★ compare_at above the price → struck "was"; absent/null/not above → nothing struck', () => {
  const skus = (compare: number | null | undefined) => [
    {
      id: 'sku_1',
      code: 'C1',
      amount: 9990,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      ...(compare === undefined ? {} : { compare_at_amount: compare }),
      metadata: {},
      option_values: [],
      media: [],
    },
  ];
  const on = renderShell({ product: makeProduct({ skus: skus(14990) }) });
  expect(on.getByTestId('price-compare').textContent).toMatch(/149,90/);
  expect(on.getByTestId('price').textContent).toMatch(/99,90/);
  for (const compare of [undefined, null, 9990, 5000]) {
    const { container } = renderShell({ product: makeProduct({ skus: skus(compare) }) });
    expect(container.querySelector('[data-testid="price-compare"]')).toBeNull();
  }
});

test('the "from" price (and its "was") come from the CHEAPEST sku', () => {
  const sku = (id: string, amount: number, compare: number) => ({
    id,
    code: id,
    amount,
    currency: 'BRL',
    status: 'active',
    name: null,
    ref: null,
    ean: null,
    compare_at_amount: compare,
    metadata: {},
    option_values: [],
    media: [],
  });
  const { getByTestId } = renderShell({
    product: makeProduct({ skus: [sku('sku_hi', 19990, 24990), sku('sku_lo', 9990, 14990)] }),
  });
  expect(getByTestId('price').textContent).toMatch(/99,90/);
  expect(getByTestId('price-compare').textContent).toMatch(/149,90/);
});

test('the extra badge slot is EMPTY by default and renders only when filled', () => {
  const product = makeProduct();
  expect(renderShell({ product }).queryByTestId('product-card-badges')).toBeNull();
  const filled = renderShell({ product, badges: <span>Selo</span> });
  expect(filled.getByTestId('product-card-badges').textContent).toBe('Selo');
});

// ── S7-SF-HOME v3 ──────────────────────────────────────────────────────────────────────────────────────────

test('★ PACK item 16 — three tags EARNED, two shown: the cap drops the least valuable (NOVO)', () => {
  // amount 60000 ≥ threshold 60000 → free shipping; compare 80000 above → -25%; isNew → NOVO.
  const product = makeProduct({
    skus: [
      {
        id: 's',
        code: 'C',
        amount: 60000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: 80000,
        metadata: {},
        option_values: [],
        media: [],
      },
    ],
  });
  const { getByTestId, queryByTestId, container } = renderShell({
    product,
    freeShippingThreshold: 60000,
    isNew: true,
  });
  // This product earns all three. Renan's cap (item 16-bis) is TWO, and the theme's precedence is
  // discount > free-shipping > new — so the price badge and the shipping badge survive and "NOVO" does not.
  // Three tags on one card is the noise the cap exists to prevent.
  expect(getByTestId('tag-discount').textContent).toBe('-25%');
  expect(getByTestId('tag-free-shipping')).toBeTruthy();
  expect(queryByTestId('tag-new')).toBeNull();
  // Each badge keeps the corner the design gives it: -N% top-right, the rest stacked top-left.
  const html = container.innerHTML;
  expect(html.indexOf('tag-free-shipping')).toBeLessThan(html.indexOf('tag-discount'));
});

test('no free-shipping threshold → no Frete grátis tag (never a false promise); below threshold → none', () => {
  const cheap = makeProduct({
    skus: [
      {
        id: 's',
        code: 'C',
        amount: 1000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [],
        media: [],
      },
    ],
  });
  expect(renderShell({ product: cheap }).queryByTestId('tag-free-shipping')).toBeNull(); // no threshold
  expect(
    renderShell({ product: cheap, freeShippingThreshold: 60000 }).queryByTestId(
      'tag-free-shipping',
    ),
  ).toBeNull(); // below
});

test('★ the struck-price row is RESERVED — present with AND without a compare_at (the card never dances)', () => {
  const base = {
    code: 'C',
    amount: 9990,
    currency: 'BRL',
    status: 'active',
    name: null,
    ref: null,
    ean: null,
    metadata: {},
    option_values: [],
    media: [],
  };
  const withCompare = renderShell({
    product: makeProduct({ skus: [{ id: 's', ...base, compare_at_amount: 14990 }] }),
  });
  const without = renderShell({ product: makeProduct({ skus: [{ id: 's', ...base }] }) });
  // The reserved row exists in BOTH states (constant height); only the with-compare one carries the struck node.
  expect(withCompare.getByTestId('product-card-compare-row')).toBeTruthy();
  expect(without.getByTestId('product-card-compare-row')).toBeTruthy();
  expect(withCompare.queryByTestId('price-compare')).toBeTruthy();
  expect(without.queryByTestId('price-compare')).toBeNull();
});

test('★ installments come from the payment config ("ou Nx de …"), never a hardcoded 12x; absent → no line', () => {
  const product = makeProduct({
    skus: [
      {
        id: 's',
        code: 'C',
        amount: 12000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [],
        media: [],
      },
    ],
  });
  const with6 = renderShell({ product, maxInstallments: 6 });
  expect(with6.getByTestId('product-card-installment').textContent).toMatch(/ou 6x de.*20,00/);
  const none = renderShell({ product });
  expect(none.getByTestId('product-card-installment').textContent).toBe('');
});

// OOS card (ronda3 #11) — out of stock on the card. The kernel stamps `available` on the product read; the card turns it into the
// "Esgotado" badge and drops the quick-add pill (no add path). `available` true or undefined → the normal card.
test('★ sold out: available=false → "Esgotado" badge + no add pill; available=true/undefined → normal card', () => {
  const skus = [
    {
      id: 's',
      code: 'C',
      amount: 9990,
      currency: 'BRL',
      status: 'active',
      name: null,
      ref: null,
      ean: null,
      metadata: {},
      option_values: [],
      media: [],
    },
  ];
  const soldOut = within(
    render(<ProductCard base={HOST_BASE} product={makeProduct({ skus, available: false })} />)
      .container,
  );
  expect(soldOut.getByTestId('tag-sold-out').textContent).toBe('Esgotado');
  expect(soldOut.queryByTestId('card-cart-button')).toBeNull(); // the add pill is dropped

  const inStock = within(
    render(<ProductCard base={HOST_BASE} product={makeProduct({ skus, available: true })} />)
      .container,
  );
  expect(inStock.queryByTestId('tag-sold-out')).toBeNull();
  expect(inStock.getByTestId('card-cart-button')).toBeTruthy();

  // No availability signal (undefined) → today's behaviour: no badge, add pill present.
  const legacy = within(
    render(<ProductCard base={HOST_BASE} product={makeProduct({ skus })} />).container,
  );
  expect(legacy.queryByTestId('tag-sold-out')).toBeNull();
  expect(legacy.getByTestId('card-cart-button')).toBeTruthy();
});

test('the rating row is reserved but empty when no rating is passed; filled when it is', () => {
  const product = makeProduct();
  expect(renderShell({ product }).getByTestId('product-card-rating').textContent).toBe('');
  const rated = renderShell({ product, rating: { average: 4.7, count: 128 } });
  expect(rated.getByTestId('product-card-rating').textContent).toMatch(/128/);
});
