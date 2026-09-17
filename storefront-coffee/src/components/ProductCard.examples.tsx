// Catalog examples for the theme's ONE ProductCard (/ui-storefront/product-card) — the canonical card every
// product surface injects, rendered faithfully to the design source. Wrapped in a LIVE stub MinicartProvider +
// a MinicartTrigger so the 2-click add actually drives the cart (adds → the minicart dropdown opens via the
// 'add' path). A tiny inline ProductDoc feeds it; no data port is touched.
'use client';

import type { SummaryLine } from '@forgeco/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgeco/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { HOST_BASE } from '@forgeco/storefront-kit/store-route';
import { useMemo } from 'react';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';
import { MinicartTrigger } from './minicart/MinicartTrigger';
import { ProductCard } from './ProductCard';

/** A 1×1 colored square as a data URI — a stand-in swatch photo so the color option renders as photo swatches. */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

function sampleProduct(over: Partial<ProductDoc> = {}): ProductDoc {
  return {
    product_id: 'prod_demo',
    title: 'Tênis Speed Elite',
    description: null,
    handle: 'tenis-speed-elite',
    status: 'active',
    metadata: {},
    options: [
      {
        id: 'color',
        name: 'Cor',
        position: 0,
        values: [
          { id: 'red', value: 'Vermelho', position: 0 },
          { id: 'blue', value: 'Azul', position: 1 },
          { id: 'black', value: 'Preto', position: 2 },
        ],
      },
      {
        id: 'size',
        name: 'Tamanho',
        position: 1,
        values: [
          { id: '39', value: '39', position: 0 },
          { id: '40', value: '40', position: 1 },
          { id: '41', value: '41', position: 2 },
        ],
      },
    ],
    skus: [
      {
        id: 'sku_red_40',
        code: 'R40',
        amount: 79900,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: 99900,
        is_default: true,
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: 'red', value: 'Vermelho' },
          { option_id: 'size', option_name: 'Tamanho', value_id: '40', value: '40' },
        ],
        media: [
          {
            provider_key: 'demo/red',
            kind: 'image',
            role: null,
            position: 0,
            url: square('%23b91c1c'),
          },
        ],
      },
      {
        id: 'sku_blue_40',
        code: 'B40',
        amount: 79900,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: 'blue', value: 'Azul' },
          { option_id: 'size', option_name: 'Tamanho', value_id: '40', value: '40' },
        ],
        media: [
          {
            provider_key: 'demo/blue',
            kind: 'image',
            role: null,
            position: 0,
            url: square('%231d4ed8'),
          },
        ],
      },
      {
        id: 'sku_black_40',
        code: 'K40',
        amount: 79900,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: 'black', value: 'Preto' },
          { option_id: 'size', option_name: 'Tamanho', value_id: '40', value: '40' },
        ],
        media: [
          {
            provider_key: 'demo/black',
            kind: 'image',
            role: null,
            position: 0,
            url: square('%2317181a'),
          },
        ],
      },
    ],
    categories: [{ category_id: 'cat', path: 'tenis', is_primary: true }],
    media: [
      {
        provider_key: 'demo/cover',
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square('%23c7cdd4'),
      },
    ],
    ...over,
  };
}

function useStubActions(): MinicartActions {
  return useMemo(() => {
    const cart: { id: string; qty: number }[] = [];
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.id,
        sku_id: l.id,
        qty: l.qty,
        unit_amount: 79900,
        line_total: 79900 * l.qty,
        title: 'Tênis Speed Elite',
        variant: l.id.replace('sku_', ''),
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

export function ProductCardExamples() {
  const actions = useStubActions();
  return (
    <MinicartProvider actions={actions}>
      <div style={{ position: 'relative', minHeight: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 24px' }}>
          <MinicartTrigger base={HOST_BASE} />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 240px))',
            gap: 24,
            padding: '0 24px',
          }}
        >
          {/* PACK item 16 — this card EARNS three badges (-20% from the struck "was", "Frete grátis" because
              R$ 799 clears the R$ 600 floor, and NOVO) and shows TWO: the cap is the card's, the precedence is the
              theme's (money first), so NOVO is the one that yields. */}
          <ProductCard
            base={HOST_BASE}
            product={sampleProduct()}
            freeShippingThreshold={60000}
            maxInstallments={12}
            rating={{ average: 4.5, count: 32 }}
            isNew
          />
          {/* ★ PACK item 16, the case the rule exists FOR: R$ 300 against a R$ 600 floor. TWO of them would
              clear it — and that is precisely why there is no "Frete grátis" badge here. A badge is a
              certainty for a cart holding this item and nothing else; the "you are R$ 300 away" story belongs
              to the progress bar. Badge is certainty, bar is a path. */}
          <ProductCard
            base={HOST_BASE}
            product={sampleProduct({
              title: 'Tênis Speed Lite (R$ 300, metade do frete grátis)',
              handle: 'tenis-speed-lite',
              skus: [
                {
                  id: 'sku_half',
                  code: 'H',
                  amount: 30000,
                  currency: 'BRL',
                  status: 'active',
                  name: null,
                  ref: null,
                  ean: null,
                  metadata: {},
                  option_values: [],
                  media: [
                    {
                      provider_key: 'demo/cover',
                      kind: 'image',
                      role: null,
                      position: 0,
                      url: square('%23dfe3e8'),
                    },
                  ],
                },
              ],
              options: [],
            })}
            freeShippingThreshold={60000}
            maxInstallments={12}
          />
          {/* Single-SKU: no variation panel — just the qty stepper. */}
          <ProductCard
            base={HOST_BASE}
            product={sampleProduct({
              skus: [
                {
                  id: 'sku_solo',
                  code: 'S',
                  amount: 45990,
                  currency: 'BRL',
                  status: 'active',
                  name: null,
                  ref: null,
                  ean: null,
                  metadata: {},
                  option_values: [],
                  media: [
                    {
                      provider_key: 'demo/cover',
                      kind: 'image',
                      role: null,
                      position: 0,
                      url: square('%23c7cdd4'),
                    },
                  ],
                },
              ],
              options: [],
            })}
            maxInstallments={12}
          />
        </div>
      </div>
    </MinicartProvider>
  );
}
