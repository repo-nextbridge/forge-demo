// Catalog example for the PLP/search body (/ui-storefront/product-listing) — the full listing dressed to the
// design source (S7-SF-PLP-FIDELITY): the title + "{N} produtos" head row with the sort strip on the right, the
// filter sidebar (solid color swatches, size grid, price slider, brand + cf checkboxes), the ProductCard grid,
// and the "Mostrando X de Y produtos" + load-more. Inline fixtures only — no data port is touched. Wrapped in a
// LIVE stub MinicartProvider so the grid's cards can add to the cart.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import type { Facets, ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE, storeHref } from '@forgecommerce/storefront-kit/store-route';
import { useMemo } from 'react';
import type { FilterState } from '@/lib/filters/filter-url';
import type { SwatchImages } from '@/lib/filters/plp';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';
import { ProductCard } from './ProductCard';
import { ProductListing } from './ProductListing';

/** A 1×1 colored square as a data URI — a stand-in product cover so the grid renders offline. */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

const COVERS = ['%23e7e9ec', '%23d9dde1', '%23c7cdd4', '%23eceef1', '%23dfe3e7'];
const NAMES = [
  'Tênis Velocity 9',
  'Tênis Speed Elite',
  'Tênis Pace Runner',
  'Tênis Fresh Foam X',
  'Tênis Glide Boost',
  'Tênis Retro Runner',
  'Tênis Urban Knit',
  'Tênis Nimbus Air',
  'Tênis Wave Rider',
  'Tênis Corre Leve',
  'Tênis Trail Rocha',
  'Tênis Terra Grip',
  'Tênis Summit Pro',
  'Tênis Lama Forte',
  'Tênis Vento Trilha',
  'Tênis Cascalho X',
  'Tênis Metcon Forge',
  'Tênis Power Lift',
  'Tênis Gym Flex',
  'Tênis Core Trainer',
];

function product(i: number): ProductDoc {
  const amount = 24990 + ((i * 5300) % 55000);
  return {
    product_id: `prod_${i}`,
    title: NAMES[i % NAMES.length] ?? `Tênis ${i}`,
    description: null,
    handle: `tenis-${i}`,
    status: 'active',
    metadata: {},
    options: [],
    skus: [
      {
        id: `sku_${i}`,
        code: `T${i}`,
        amount,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: i % 3 === 0 ? Math.round(amount * 1.3) : null,
        is_default: true,
        metadata: {},
        option_values: [],
        media: [
          {
            provider_key: `demo/${i}`,
            kind: 'image',
            role: null,
            position: 0,
            url: square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
          },
        ],
      },
    ],
    categories: [{ category_id: 'cat', path: 'tenis', is_primary: true }],
    media: [
      {
        provider_key: `demo/${i}`,
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
      },
    ],
  };
}

const PRODUCTS: ProductDoc[] = Array.from({ length: 20 }, (_, i) => product(i));

const FACETS: Facets = {
  options: [
    {
      name: 'Cor',
      values: [
        { value: 'Branco', count: 19 },
        { value: 'Preto', count: 23 },
        { value: 'Cinza', count: 11 },
        { value: 'Azul', count: 9 },
        { value: 'Verde', count: 5 },
        { value: 'Vermelho', count: 6 },
        { value: 'Rosa', count: 3 },
        { value: 'Bege', count: 3 },
        { value: 'Marrom', count: 2 },
        { value: 'Laranja', count: 2 },
        { value: 'Amarelo', count: 1 },
        { value: 'Coral', count: 2 },
      ],
    },
    {
      name: 'Tamanho',
      values: ['37', '38', '39', '40', '41', '42', '43', '44'].map((value) => ({
        value,
        count: 12,
      })),
    },
  ],
  price: { min: 20000, max: 100000 },
  brands: [
    { slug: 'adibas', name: 'Adibas', count: 9 },
    { slug: 'asixx', name: 'Asixx', count: 3 },
    { slug: 'converso', name: 'Converso', count: 4 },
    { slug: 'filla', name: 'Filla', count: 1 },
    { slug: 'krocs', name: 'Krocs', count: 1 },
    { slug: 'mike', name: 'Mike', count: 9 },
    { slug: 'mizuna', name: 'Mizuna', count: 2 },
    { slug: 'nova-balance', name: 'Nova Balance', count: 4 },
    { slug: 'olimpiko', name: 'Olimpiko', count: 4 },
    { slug: 'pumba', name: 'Pumba', count: 5 },
    { slug: 'rebok', name: 'Rebok', count: 4 },
    { slug: 'vanz', name: 'Vanz', count: 3 },
  ],
  custom_fields: [
    {
      key: 'Amortecimento',
      values: [
        { value: 'Alto', count: 7 },
        { value: 'Baixo', count: 8 },
        { value: 'Médio', count: 14 },
      ],
    },
    {
      key: 'Cano',
      values: [
        { value: 'Alto', count: 4 },
        { value: 'Baixo', count: 39 },
        { value: 'Médio', count: 4 },
      ],
    },
    {
      key: 'Fechamento',
      values: [
        { value: 'Cadarço', count: 41 },
        { value: 'Elástico', count: 1 },
        { value: 'Velcro', count: 3 },
      ],
    },
  ],
};

// A representative photo per option value, harvested from the loaded products on the real page (Staging passes
// `buildSwatchImages(products)`). Kept here — WITH a `tamanho` axis — so the fixture reproduces the production
// input and PROVES the routing: only "Cor" is ever a swatch; "Tamanho" stays a numeric text grid even when a
// photo exists for its values (S7-SF-PLP-FIDELITY, size-facet fix).
const SWATCH_IMAGES: SwatchImages = {
  cor: Object.fromEntries(
    ['Branco', 'Preto', 'Cinza', 'Azul', 'Verde', 'Vermelho', 'Rosa', 'Bege'].map((v, i) => [
      v,
      square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
    ]),
  ),
  tamanho: Object.fromEntries(
    ['37', '38', '39', '40', '41', '42', '43', '44'].map((v, i) => [
      v,
      square(COVERS[i % COVERS.length] ?? '%23e7e9ec'),
    ]),
  ),
};

const STATE: FilterState = { options: { cor: ['Preto'] }, cf: {} };

function useStubActions(): MinicartActions {
  return useMemo(() => {
    const cart: { id: string; qty: number }[] = [];
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.id,
        sku_id: l.id,
        qty: l.qty,
        unit_amount: 29990,
        line_total: 29990 * l.qty,
        title: 'Tênis',
        variant: undefined,
      }));
      const total = lines.reduce((a, l) => a + l.line_total, 0);
      return {
        lines,
        totalizers: [{ id: 'subtotal', name: 'Subtotal', amount: total }],
        totalAmount: total,
        currency: 'BRL',
        count: cart.reduce((a, l) => a + l.qty, 0),
      };
    };
    return {
      readCart: async () => snap(),
      addLine: async (id, qty = 1) => {
        const hit = cart.find((l) => l.id === id);
        if (hit) hit.qty += qty;
        else cart.push({ id, qty });
      },
      updateLine: async () => {},
      removeLine: async () => {},
    };
  }, []);
}

export function ProductListingExamples() {
  const actions = useStubActions();
  return (
    <MinicartProvider actions={actions}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: 24 }}>
        <ProductListing
          base={HOST_BASE}
          title={'Resultados para “Tênis”'}
          products={PRODUCTS}
          page={1}
          total={24}
          basePath={storeHref(HOST_BASE, '/search')}
          extra={{ q: 'Tênis' }}
          facets={FACETS}
          state={STATE}
          swatchImages={SWATCH_IMAGES}
          empty={<div>Nenhum produto encontrado com esses filtros.</div>}
          renderCard={(p) => (
            <ProductCard
              base={HOST_BASE}
              product={p}
              freeShippingThreshold={60000}
              maxInstallments={12}
            />
          )}
        />
      </div>
    </MinicartProvider>
  );
}
