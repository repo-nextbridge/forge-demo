// The rules that decide what a coffee page can and cannot say — pinned here because every one of them is a
// rule about MISSING data, and missing data is exactly what a fixture-shaped test forgets to have.
//
// The catalogue this shop ships with is UNEVEN on purpose: a house blend has no altitude, four of the six
// coffees are unscored, one is sold as beans only. A page written against the fullest product looks correct
// in review and breaks on the seventh coffee somebody adds.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { describe, expect, test } from 'vitest';
import { field, notesOf, priceOf, specsOf, variantSummary } from './product-view';

const sku = (over: Partial<ProductDoc['skus'][number]> = {}): ProductDoc['skus'][number] => ({
  id: 'sku_1',
  code: 'ALV-250-G',
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
  product_id: 'prod_1',
  title: 'Forge Alvorada',
  description: null,
  handle: 'forge-alvorada',
  status: 'active',
  metadata: {},
  options: [],
  skus: [sku()],
  categories: [],
  media: [],
  ...over,
});

describe('a custom field the merchant did not fill is ABSENT, never blank', () => {
  test('a missing key, a blank string and a non-string all read as absent', () => {
    const p = product({ metadata: { regiao: '   ', torra: { nested: true }, processo: 'natural' } });
    expect(field(p, 'regiao')).toBeUndefined();
    expect(field(p, 'torra')).toBeUndefined();
    expect(field(p, 'altitude')).toBeUndefined();
    expect(field(p, 'processo')).toBe('natural');
  });

  test('a metadata bag that is not an object at all does not throw — the port types it `unknown`', () => {
    for (const metadata of [null, undefined, 'nope', 42, []]) {
      expect(() => specsOf(product({ metadata }))).not.toThrow();
    }
    expect(specsOf(product({ metadata: null }))).toEqual([]);
  });

  test('SCA arrives as a number on one product and a string on another, and both read', () => {
    expect(field(product({ metadata: { sca: 86 } }), 'sca')).toBe('86');
    expect(field(product({ metadata: { sca: '88' } }), 'sca')).toBe('88');
  });
});

describe('the tasting notes are one string the merchant wrote, and the chips are the shop`s doing', () => {
  test('a comma-separated label becomes trimmed chips', () => {
    const p = product({ metadata: { notas: 'chocolate ao leite, caramelo,  nozes ' } });
    expect(notesOf(p)).toEqual(['chocolate ao leite', 'caramelo', 'nozes']);
  });

  test('the middle dot is accepted too — a merchant copying the bag is not making a mistake', () => {
    expect(notesOf(product({ metadata: { notas: 'mel · maçã verde · floral' } }))).toEqual([
      'mel',
      'maçã verde',
      'floral',
    ]);
  });

  test('no notes is an empty list, so the chip row simply does not draw', () => {
    expect(notesOf(product())).toEqual([]);
    expect(notesOf(product({ metadata: { notas: ' , , ' } }))).toEqual([]);
  });
});

describe('the Características panel', () => {
  test('lists only what this coffee has, in the READING order and never the bag`s', () => {
    // The bag is written back-to-front on purpose: JSON key order is whatever the writer used, and a panel
    // built by iterating it would reorder itself when somebody edits a product.
    const p = product({
      metadata: { sca: '86', torra: 'clara', regiao: 'Serra do Caparaó', notas: 'mel, floral' },
    });
    expect(specsOf(p).map((s) => s.key)).toEqual(['notas', 'regiao', 'torra', 'sca']);
    expect(specsOf(p)[0]).toEqual({ key: 'notas', label: 'Notas sensoriais', value: 'mel, floral' });
  });

  test('a coffee with nothing declared draws no panel rows at all', () => {
    expect(specsOf(product())).toEqual([]);
  });
});

describe('the variant summary is DERIVED from the options, never captioned by hand', () => {
  test('two axes read as the design writes them', () => {
    const p = product({
      options: [
        {
          id: 'o1',
          name: 'Moagem',
          position: 0,
          values: [
            { id: 'v1', value: 'Grãos', position: 0 },
            { id: 'v2', value: 'Filtrado', position: 1 },
            { id: 'v3', value: 'Espresso', position: 2 },
          ],
        },
        {
          id: 'o2',
          name: 'Peso',
          position: 1,
          values: [
            { id: 'v4', value: '250g', position: 0 },
            { id: 'v5', value: '1kg', position: 1 },
          ],
        },
      ],
    });
    expect(variantSummary(p)).toBe('Grãos · Filtrado · Espresso / 250g · 1kg');
  });

  test('the single-SKU coffee says so by itself — nobody edits a caption for it', () => {
    const p = product({
      options: [
        {
          id: 'o1',
          name: 'Moagem',
          position: 0,
          values: [{ id: 'v1', value: 'Grãos', position: 0 }],
        },
      ],
    });
    expect(variantSummary(p)).toBe('Grãos');
    expect(variantSummary(product())).toBe('');
  });

  test('position decides the order, not the order the port happened to return', () => {
    const p = product({
      options: [
        {
          id: 'o2',
          name: 'Peso',
          position: 1,
          values: [{ id: 'v5', value: '1kg', position: 1 }, { id: 'v4', value: '250g', position: 0 }],
        },
        {
          id: 'o1',
          name: 'Moagem',
          position: 0,
          values: [{ id: 'v1', value: 'Grãos', position: 0 }],
        },
      ],
    });
    expect(variantSummary(p)).toBe('Grãos / 250g · 1kg');
  });
});

describe('the price, and the struck-through number beside it', () => {
  test('with no star, the product speaks with its CHEAPEST sku', () => {
    const p = product({ skus: [sku({ id: 's1', amount: 14900 }), sku({ id: 's2', amount: 4290 })] });
    expect(priceOf(p)?.amount).toBe(4290);
  });

  test('the merchant`s starred sku wins over the cheapest', () => {
    const p = product({
      skus: [sku({ id: 's1', amount: 14900, is_default: true }), sku({ id: 's2', amount: 4290 })],
    });
    expect(priceOf(p)?.amount).toBe(14900);
  });

  test('★ a `was` that is NOT above the price is not shown — that is a leftover, not a sale', () => {
    expect(priceOf(product({ skus: [sku({ amount: 4290, compare_at_amount: 4290 })] }))?.compareAt).toBeUndefined();
    expect(priceOf(product({ skus: [sku({ amount: 4290, compare_at_amount: 3990 })] }))?.compareAt).toBeUndefined();
    expect(priceOf(product({ skus: [sku({ amount: 4290, compare_at_amount: 5290 })] }))?.compareAt).toBe(5290);
  });

  test('an active promotion prices the card, and its own unit amount is what gets struck', () => {
    const p = product({
      skus: [
        sku({
          amount: 6800,
          promotional_price: {
            unit_amount: 6800,
            promotional_amount: 5800,
            discount_bp: 1470,
            label: 'Promoção',
            promotion_id: 'promo_1',
          },
        }),
      ],
    });
    expect(priceOf(p)).toMatchObject({ amount: 5800, compareAt: 6800 });
  });

  test('a product with no skus prices nothing rather than printing a zero', () => {
    expect(priceOf(product({ skus: [] }))).toBeUndefined();
  });
});
