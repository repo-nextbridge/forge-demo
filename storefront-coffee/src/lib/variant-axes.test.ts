// o4 #22 — the buybox axis order is DERIVED from the colour-axis role, never the doc's stored option order.

import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { expect, test } from 'vitest';
import { colorAxisId, orderedOptions } from './variant-axes';

/** A product whose doc lists Tamanho BEFORE Cor (as Staging delivers), Cor backed by SKU photos. */
function sizeBeforeColor(): ProductDoc {
  const skus: ProductDoc['skus'] = [];
  for (const c of [
    { id: 'preto', v: 'Preto' },
    { id: 'azul', v: 'Azul' },
  ]) {
    for (const s of ['38', '39']) {
      skus.push({
        id: `sku_${c.id}_${s}`,
        code: `X-${c.id}-${s}`,
        amount: 1000,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: null,
        is_default: c.id === 'preto' && s === '38',
        metadata: {},
        option_values: [
          { option_id: 'size', option_name: 'Tamanho', value_id: s, value: s },
          { option_id: 'color', option_name: 'Cor', value_id: c.id, value: c.v },
        ],
        media: [
          { provider_key: `p/${c.id}`, kind: 'image', role: null, position: 0, url: `u/${c.id}` },
        ],
      });
    }
  }
  return {
    product_id: 'prod_x',
    title: 'X',
    description: null,
    handle: 'x',
    status: 'active',
    metadata: {},
    content_sections: [],
    meta_title: null,
    meta_description: null,
    options: [
      {
        id: 'size',
        name: 'Tamanho',
        position: 0,
        values: [
          { id: '38', value: '38', position: 0 },
          { id: '39', value: '39', position: 1 },
        ],
      },
      {
        id: 'color',
        name: 'Cor',
        position: 1,
        values: [
          { id: 'preto', value: 'Preto', position: 0 },
          { id: 'azul', value: 'Azul', position: 1 },
        ],
      },
    ],
    skus,
    categories: [],
    media: [],
  };
}

test('the colour axis renders FIRST even when the doc lists Tamanho before Cor (derived, not stored order)', () => {
  const product = sizeBeforeColor();
  expect(colorAxisId(product)).toBe('color'); // the role is detected
  const order = orderedOptions(product).map((o) => o.id);
  expect(order).toEqual(['color', 'size']); // Cor first, then Tamanho — regardless of position
});

test('a product with NO colour axis keeps its catalog (position) order untouched', () => {
  const product = sizeBeforeColor();
  // Strip the photos → Cor degrades to a text axis (colorAxisId null) → order is left as catalog position.
  const noPhotos: ProductDoc = {
    ...product,
    skus: product.skus.map((s) => ({ ...s, media: [] })),
  };
  expect(colorAxisId(noPhotos)).toBeNull();
  expect(orderedOptions(noPhotos).map((o) => o.id)).toEqual(['size', 'color']);
});
