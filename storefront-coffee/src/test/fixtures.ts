// Shared test fixtures — a ProductDoc shaped exactly as the read port returns it.
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';

export function makeProduct(overrides: Partial<ProductDoc> = {}): ProductDoc {
  return {
    product_id: 'prod_1',
    title: 'Tênis Esportivo',
    description: 'Calçado preto para corrida',
    handle: 'tenis-esportivo',
    status: 'active',
    metadata: {},
    options: [
      {
        id: 'opt_size',
        name: 'Tamanho',
        position: 0,
        values: [
          { id: 'v_39', value: '39', position: 0 },
          { id: 'v_40', value: '40', position: 1 },
        ],
      },
    ],
    skus: [
      {
        id: 'sku_39',
        code: 'TEN-39',
        amount: 7990,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [
          { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_39', value: '39' },
        ],
        media: [],
      },
      {
        id: 'sku_40',
        code: 'TEN-40',
        amount: 8990,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [
          { option_id: 'opt_size', option_name: 'Tamanho', value_id: 'v_40', value: '40' },
        ],
        media: [],
      },
    ],
    categories: [{ category_id: 'cat_calcados', path: 'roupas.calcados', is_primary: true }],
    media: [{ provider_key: 'cdn/tenis.jpg', kind: 'image', role: 'hero', position: 0 }],
    ...overrides,
  };
}
