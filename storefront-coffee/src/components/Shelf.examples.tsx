// Catalog example for the product-card grid (/ui-storefront/shelf) — the responsive auto-fill Shelf over a
// fixture list of ProductDocs. Its default cell is the theme's ONE ProductCard (which drives the minicart), so
// the grid is wrapped in a LIVE stub MinicartProvider; no data port is touched.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { useMemo } from 'react';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';
import { Shelf } from './Shelf';

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

const PRODUCTS: ProductDoc[] = Array.from({ length: 8 }, (_, i) => product(i));

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

export function ShelfExamples() {
  const actions = useStubActions();
  return (
    <MinicartProvider actions={actions}>
      <div style={{ maxWidth: 'var(--size-container)', margin: '0 auto', padding: 24 }}>
        <Shelf base={HOST_BASE} products={PRODUCTS} />
      </div>
    </MinicartProvider>
  );
}
