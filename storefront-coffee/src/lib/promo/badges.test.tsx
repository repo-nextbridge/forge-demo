// PACK items 15 + 16 — the theme's badge decision, and the gate that keeps it anonymous-safe.
//
// Three things are asserted here, and only the first is about pixels:
//   1. the DECISION — precedence, the cap of two, and sold-out being exclusive;
//   2. the ANTI-DRIFT — the card and the PDP show the SAME badge for the SAME product, because the badge that
//      existed on one and not the other is exactly what item 15 is;
//   3. the GATE — a badge can only be born from an anonymous-safe fact, enforced as an allow-list rather than
//      as a list of things to exclude.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BadgeSignals,
  badgesFor,
  cardBadges,
  MAX_CARD_BADGES,
  SIGNAL_PROVENANCE,
} from '@forgeco/storefront-kit/promo/badges';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { render, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProductCard } from '@/components/ProductCard';
import { SkuSelector } from '@/components/SkuSelector';
import { makeProduct } from '@/test/fixtures';
import { KIT_SRC } from '@/test/kit-source';

const HERE = dirname(fileURLToPath(import.meta.url));

const NONE: BadgeSignals = {
  soldOut: false,
  percentOff: null,
  freeShipping: false,
  isNew: false,
};

const kinds = (s: Partial<BadgeSignals>) => badgesFor({ ...NONE, ...s }).map((b) => b.kind);

// ── 1. the decision ────────────────────────────────────────────────────────────────────────────────────────

test('★ the precedence is money first: discount > free shipping > new', () => {
  expect(kinds({ percentOff: 20, freeShipping: true, isNew: true })).toEqual([
    'discount',
    'free-shipping',
    'new',
  ]);
  // …and it does not depend on the order the caller happened to fill the signals in.
  expect(kinds({ isNew: true, freeShipping: true })).toEqual(['free-shipping', 'new']);
});

test('★ item 16-bis — a CARD shows at most two; the ones past the cap are dropped, not reordered', () => {
  const all = { percentOff: 20, freeShipping: true, isNew: true };
  expect(badgesFor({ ...NONE, ...all })).toHaveLength(3);
  const card = cardBadges({ ...NONE, ...all });
  expect(card).toHaveLength(MAX_CARD_BADGES);
  expect(card.map((b) => b.kind)).toEqual(['discount', 'free-shipping']);
});

test('★ sold out is EXCLUSIVE — a product nobody can buy promises nothing else', () => {
  // Every other badge is earned, and none of them renders: advertising a discount on an unbuyable product is
  // a promise about a purchase that cannot happen.
  expect(kinds({ soldOut: true, percentOff: 30, freeShipping: true, isNew: true })).toEqual([
    'sold-out',
  ]);
});

test('a zero or absent percentage is not a badge (never "-0%")', () => {
  expect(kinds({ percentOff: null })).toEqual([]);
  expect(kinds({ percentOff: 0 })).toEqual([]);
});

// ── 2. the anti-drift: item 15 ─────────────────────────────────────────────────────────────────────────────

/** One product, discounted by the kernel's anonymous-safe preview — the bench's case 1 in miniature. */
function discountedProduct() {
  return makeProduct({
    skus: [
      {
        id: 'sku_1',
        code: 'C1',
        amount: 70000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [],
        media: [],
        promotional_price: {
          unit_amount: 70000,
          promotional_amount: 56000,
          discount_bp: 2000,
          label: '20% off Adistar 4',
          promotion_id: 'prom_1',
        },
      },
    ],
  });
}

test('★ item 15 — the SAME product shows the SAME badge on the card and on the PDP', () => {
  const product = discountedProduct();

  const card = render(<ProductCard base={HOST_BASE} product={product} cart={false} />);
  const cardBadge = within(card.container).getByTestId('tag-discount').textContent;

  const pdp = render(<SkuSelector product={product} />);
  const pdpBadge = within(pdp.container).getByTestId('tag-discount').textContent;

  // The listing said "-20%" and the PDP said nothing at all — that asymmetry IS item 15.
  expect(cardBadge).toBe('-20%');
  expect(pdpBadge).toBe(cardBadge);
  // …and both price it the same way, from the same decider.
  expect(within(pdp.container).getByTestId('price-compare').textContent).toMatch(/700,00/);
  expect(within(pdp.container).getByTestId('price').textContent).toMatch(/560,00/);
});

test('no promotion and no compare_at → neither surface invents a badge', () => {
  const product = makeProduct();
  const card = render(<ProductCard base={HOST_BASE} product={product} cart={false} />);
  const pdp = render(<SkuSelector product={product} />);
  expect(within(card.container).queryByTestId('tag-discount')).toBeNull();
  expect(within(pdp.container).queryByTestId('tag-discount')).toBeNull();
});

// ── 3. the gate ────────────────────────────────────────────────────────────────────────────────────────────

test('★★ every badge signal declares an ANONYMOUS-SAFE provenance — allow-list, not exclusion list', () => {
  // The compiler already forces `SIGNAL_PROVENANCE` to be exhaustive over `BadgeSignals` (its type is
  // Record<keyof BadgeSignals, …>), so a signal added without a provenance does not build. This asserts the
  // other half: that every declared provenance is one a CACHED, shopper-less route may serve.
  const allowed = ['catalog', 'stock', 'store-config', 'anonymous-safe-preview'];
  for (const [signal, provenance] of Object.entries(SIGNAL_PROVENANCE)) {
    expect(allowed, `${signal} has an unknown provenance`).toContain(provenance);
  }
  // The one promotion-derived signal, named: if a second appears, this test is where the decision is made.
  const fromPromotions = Object.entries(SIGNAL_PROVENANCE)
    .filter(([, p]) => p === 'anonymous-safe-preview')
    .map(([s]) => s);
  expect(fromPromotions).toEqual(['percentOff']);
});

test('★★ the decision never touches the shopper — no buyer, no payment method, no raw promotion', () => {
  // A cached badge that depended on WHO is buying or HOW they pay would serve one shopper's promise to
  // everybody. The engine refuses those by having no identity (packages/core/src/promo/preview.ts); this
  // asserts the storefront cannot reintroduce them by reading a field directly.
  // Comments are stripped first: this file EXPLAINS the forbidden fields at length, and the assertion is about
  // the code reading them, not about the prose naming them.
  const code = readFileSync(join(KIT_SRC, 'promo/badges.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  for (const forbidden of [
    'buyer',
    'customer',
    'payment_method',
    'paymentMethod',
    'promotional_price',
    'conditions',
  ]) {
    expect(code, `badges.ts reads ${forbidden}`).not.toContain(forbidden);
  }
});

test('★★ "the item ALONE unlocks it" — the free-shipping signal is a UNIT price test, never a cart total', () => {
  // The rule: a R$ 250 product must not be badged because TWO of them would clear a R$ 500 floor. The
  // comparison therefore has to be against the sku's own amount, in both hosts. A qty or a subtotal creeping
  // into this expression is the failure, and it would be invisible in a screenshot.
  for (const file of ['components/ProductCard.tsx', 'components/SkuSelector.tsx']) {
    const source = readFileSync(join(HERE, '../..', file), 'utf8');
    expect(source, `${file} must gate free shipping on the UNIT amount`).toMatch(
      /freeShippingThreshold != null && sku\.amount >= freeShippingThreshold/,
    );
    expect(source).not.toMatch(/qty\s*\*\s*sku\.amount\s*>=\s*freeShippingThreshold/);
  }
});
