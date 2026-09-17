// The subscription contract, from the fork's side — and every one of these is a rule about a SHOPPER'S
// MONEY or about a product that must NOT offer a subscription.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { describe, expect, test } from 'vitest';
import {
  DEFAULT_PLAN,
  initialSelection,
  isSubscribable,
  OFFERED_PLANS,
  PLAN_FIELD,
  SUBSCRIBER_PERCENT_BP,
  skuForSelection,
  subscriptionAmount,
} from './subscription';

type Sku = ProductDoc['skus'][number];

const sku = (over: Partial<Sku> = {}): Sku => ({
  id: 'sku_1',
  code: 'C',
  amount: 4290,
  currency: 'BRL',
  status: 'active',
  name: null,
  ref: null,
  ean: null,
  metadata: {},
  option_values: [],
  media: [],
  ...over,
});

const product = (over: Partial<ProductDoc> = {}): ProductDoc => ({
  product_id: 'p',
  title: 'Café',
  description: null,
  handle: 'cafe',
  status: 'active',
  metadata: {},
  options: [],
  skus: [sku()],
  categories: [],
  media: [],
  ...over,
});

describe('★ the curation mark — the default is FALSE and everything defends it', () => {
  test('only the boolean true is a mark', () => {
    expect(isSubscribable(sku({ metadata: { sub_enabled: true } }))).toBe(true);
  });

  test('every other state of the world is NOT a mark', () => {
    // The string "true" is the one that matters: this bag arrives over a public face that also accepts
    // undeclared keys, and a truthy string is exactly what a loose check would let through.
    for (const metadata of [
      {},
      { sub_enabled: false },
      { sub_enabled: 'true' },
      { sub_enabled: 1 },
      { sub_enabled: null },
      null,
      undefined,
      'nope',
    ]) {
      expect(isSubscribable(sku({ metadata })), JSON.stringify(metadata)).toBe(false);
    }
    expect(isSubscribable(undefined)).toBe(false);
  });

  test('★ an UNMARKED coffee offers no subscription, and no rule in this fork names it', () => {
    // This is the whole boundary: the Edição do Produtor is out of the offer because the merchant did not
    // mark it — not because any code here knows its handle. Grep this repository for that handle and the
    // absence is the proof.
    const edicao = product({
      handle: 'forge-edicao-do-produtor',
      skus: [sku({ metadata: {} })],
    });
    expect(isSubscribable(edicao.skus[0])).toBe(false);
  });
});

describe('the rhythms', () => {
  test('the offered keys are the app`s own vocabulary — never translated on the wire', () => {
    expect(OFFERED_PLANS.map((p) => p.key)).toEqual(['weekly', 'biweekly', 'monthly']);
    expect(OFFERED_PLANS.map((p) => p.label)).toEqual(['Semanal', 'Quinzenal', 'Mensal']);
  });

  test('the field written on the line is the one the kernel validates against', () => {
    expect(PLAN_FIELD).toBe('sub_plan');
  });

  test('the default is one of the offered rhythms', () => {
    expect(OFFERED_PLANS.map((p) => p.key)).toContain(DEFAULT_PLAN);
  });
});

describe('★ the subscriber price — the number a shopper compares against the checkout', () => {
  test('10% off, in whole cents', () => {
    expect(SUBSCRIBER_PERCENT_BP).toBe(1000);
    expect(subscriptionAmount(4290)).toBe(3861);
    expect(subscriptionAmount(14900)).toBe(13410);
  });

  test('★ it rounds HALF UP, the same direction the kernel does', () => {
    // 4295 * 0.9 = 3865.5. Rounding down would print one cent BELOW what the checkout charges — the only
    // rounding error a shopper ever notices, because it looks like the shop changed its mind at the till.
    expect(subscriptionAmount(4295)).toBe(3866);
    expect(subscriptionAmount(1)).toBe(1);
    expect(subscriptionAmount(0)).toBe(0);
  });
});

describe('resolving the chosen bag', () => {
  const twoAxes = product({
    options: [
      {
        id: 'o_grind',
        name: 'Moagem',
        position: 0,
        values: [
          { id: 'v_beans', value: 'Grãos', position: 0 },
          { id: 'v_filter', value: 'Filtrado', position: 1 },
        ],
      },
      {
        id: 'o_weight',
        name: 'Peso',
        position: 1,
        values: [
          { id: 'v_250', value: '250g', position: 0 },
          { id: 'v_1kg', value: '1kg', position: 1 },
        ],
      },
    ],
    skus: [
      sku({
        id: 'sku_beans_250',
        amount: 4290,
        option_values: [
          { option_id: 'o_grind', option_name: 'Moagem', value_id: 'v_beans', value: 'Grãos' },
          { option_id: 'o_weight', option_name: 'Peso', value_id: 'v_250', value: '250g' },
        ],
      }),
      sku({
        id: 'sku_filter_1kg',
        amount: 14900,
        option_values: [
          { option_id: 'o_grind', option_name: 'Moagem', value_id: 'v_filter', value: 'Filtrado' },
          { option_id: 'o_weight', option_name: 'Peso', value_id: 'v_1kg', value: '1kg' },
        ],
      }),
    ],
  });

  test('a chosen pair resolves to its own sku', () => {
    expect(skuForSelection(twoAxes, { o_grind: 'v_beans', o_weight: 'v_250' })?.id).toBe(
      'sku_beans_250',
    );
  });

  test('★ a combination the merchant never created resolves to NOTHING, never to a different bag', () => {
    // Grãos + 1kg is not a SKU here. Falling back to "the closest one" would sell a shopper a bag they did
    // not pick, at a price they did not see.
    expect(skuForSelection(twoAxes, { o_grind: 'v_beans', o_weight: 'v_1kg' })).toBeUndefined();
  });

  test('matching is by value ID, so renaming a value in the admin changes nothing', () => {
    const renamed = {
      ...twoAxes,
      skus: twoAxes.skus.map((s) => ({
        ...s,
        option_values: s.option_values.map((ov) => ({ ...ov, value: 'qualquer outro nome' })),
      })),
    };
    expect(skuForSelection(renamed, { o_grind: 'v_beans', o_weight: 'v_250' })?.id).toBe(
      'sku_beans_250',
    );
  });

  test('the page opens on the merchant`s starred sku when there is one', () => {
    const starred = {
      ...twoAxes,
      skus: twoAxes.skus.map((s) => ({ ...s, is_default: s.id === 'sku_filter_1kg' })),
    };
    expect(initialSelection(starred)).toEqual({ o_grind: 'v_filter', o_weight: 'v_1kg' });
  });

  test('with no star it opens on the first value of each axis — and that combination EXISTS', () => {
    const chosen = initialSelection(twoAxes);
    expect(chosen).toEqual({ o_grind: 'v_beans', o_weight: 'v_250' });
    expect(skuForSelection(twoAxes, chosen)).toBeDefined();
  });
});
