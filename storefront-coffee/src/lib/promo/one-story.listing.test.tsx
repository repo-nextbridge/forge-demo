// ★★ PACK item 14, THE LISTING'S HALF — one product, one price, told the same way on the shelf.
//
// THE DEFECT: the listing said "de R$ 700,00 por R$ 560,00" and the cart said the line was R$ 700,00 with a
// separate −R$ 140,00 in the totals. Both were arithmetically right and together they were a lie of framing:
// one product carrying two different prices inside one flow.
//
// ★ CHECKOUT-APP (C1) SPLIT THE PAIR ACROSS TWO DEPLOYABLES. The cart's half is asserted in
// `apps/checkout/src/lib/promo/one-story.test.tsx`, from the SAME two constants; this is the shelf, which
// renders in this build. What keeps them from drifting is not these two files agreeing by hand — it is that
// the de/por is produced by `promo/display-price` in the kit, which both apps import.

import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProductCard } from '@/components/ProductCard';
import { makeProduct } from '@/test/fixtures';

const WAS = 70000; // R$ 700,00 — the catalog price
const NOW = 56000; // R$ 560,00 — 20% off, the engine's number

/** `formatMoney` glues "R$" to the number with a NON-BREAKING space; every read normalises it. */
const money = (node: Element | null | undefined) =>
  (node?.textContent ?? '').replace(/\u00A0/g, ' ').trim();

/** The listing's half: the kernel's anonymous-safe preview on the sku (what the card and the PDP price from). */
function listedProduct() {
  return makeProduct({
    skus: [
      {
        id: 'sku_1',
        code: 'C1',
        amount: WAS,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [],
        media: [],
        promotional_price: {
          unit_amount: WAS,
          promotional_amount: NOW,
          discount_bp: 2000,
          label: '20% off Adistar 4',
          promotion_id: 'prom_item',
        },
      },
    ],
  });
}

test('★ the listing prints the de/por — struck 700, paying 560', () => {
  const listing = render(<ProductCard base={HOST_BASE} product={listedProduct()} cart={false} />);
  expect(money(within(listing.container).getByTestId('price-compare'))).toBe('R$ 700,00');
  expect(money(within(listing.container).getByTestId('price'))).toBe('R$ 560,00');
});
