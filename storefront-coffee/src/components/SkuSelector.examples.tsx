// Catalog example for SkuSelector (/ui-storefront/sku-selector) — the interactive buybox: colour photo-swatches +
// size text-chips resolve a SKU; the price shown is THE SKU's price (with the struck "was", the "Frete grátis"
// tag and the "ou Nx de R$ X" installment line), and the CTA is the full-width add-to-cart (PdpBuyRow). Fed the
// same ProductDoc shape Staging delivers and wrapped in a LIVE stub MinicartProvider so the add drives a cart.
// A second instance wires `availability` so a sold-out value greys/strikes and the resolved SKU relabels "Esgotado";
// a third adds `backorder` — the SAME zeroed colour, sold anyway: dashed border, amber notice, CTA still buying.
'use client';

import type { SummaryLine } from '@forgeco/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgeco/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgeco/storefront-kit/read-client';
import { useMemo } from 'react';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';
import { SkuSelector } from './SkuSelector';

/** A 1×1 colored square as a data URI — a stand-in swatch/cover photo (no media door in the offline preview). */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

const COLORS = [
  { id: 'preto', value: 'Preto', hex: '%2317181a' },
  { id: 'azul', value: 'Azul', hex: '%231d4ed8' },
  { id: 'branco', value: 'Branco', hex: '%23e7e9ec' },
  { id: 'verde', value: 'Verde', hex: '%2316a34a' },
];
const SIZES = ['38', '39', '40', '41', '42'];

function sampleProduct(): ProductDoc {
  const skus: ProductDoc['skus'] = [];
  for (const c of COLORS) {
    for (const s of SIZES) {
      skus.push({
        id: `sku_${c.id}_${s}`,
        code: `SPD-${c.id.slice(0, 3).toUpperCase()}-${s}`,
        amount: 74990,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: 97490,
        is_default: c.id === 'preto' && s === '40',
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: c.id, value: c.value },
          { option_id: 'size', option_name: 'Tamanho', value_id: s, value: s },
        ],
        media: [
          {
            provider_key: `demo/${c.id}`,
            kind: 'image',
            role: null,
            position: 0,
            url: square(c.hex),
          },
        ],
      });
    }
  }
  return {
    product_id: 'prod_speed_elite',
    title: 'Tênis Speed Elite',
    description: null,
    handle: 'tenis-speed-elite',
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
        values: SIZES.map((s, i) => ({ id: s, value: s, position: i })),
      },
      {
        id: 'color',
        name: 'Cor',
        position: 1,
        values: COLORS.map((c, i) => ({ id: c.id, value: c.value, position: i })),
      },
    ],
    skus,
    categories: [{ category_id: 'cat_corrida', path: 'tenis/corrida', is_primary: true }],
    media: [
      {
        provider_key: 'demo/cover',
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square('%23c7cdd4'),
      },
    ],
  };
}

/** A live in-memory cart port — the add-to-cart CTA (PdpBuyRow) mutates a local array and re-reads. */
function useStubActions(): MinicartActions {
  return useMemo(() => {
    const cart: { id: string; qty: number }[] = [];
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.id,
        sku_id: l.id,
        qty: l.qty,
        unit_amount: 74990,
        line_total: 74990 * l.qty,
        title: 'Tênis Speed Elite',
        variant: l.id.replace('sku_', '').replace('_', ' · '),
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

export function SkuSelectorExamples() {
  const actions = useStubActions();
  const product = useMemo(sampleProduct, []);

  // Mark the whole "Verde" colour as out of stock so a value greys/strikes and, when resolved, the CTA reads "Esgotado".
  const availability = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sku of product.skus) {
      map[sku.id] = sku.option_values.some((ov) => ov.value_id === 'verde') ? 0 : 5;
    }
    return map;
  }, [product]);

  // ★ SF-BACKORDER-NAO-RENDERIZA — the same zeroed colour, but the warehouse sells past zero. The two examples
  // sit side by side deliberately: "esgotado" and "sob encomenda" are opposite answers to the same question,
  // and the only way to be sure the skins never converge is to look at them together.
  const backorder = useMemo(() => {
    const map: Record<string, { extra_days: number | null }> = {};
    for (const sku of product.skus) {
      if (sku.option_values.some((ov) => ov.value_id === 'verde')) map[sku.id] = { extra_days: 10 };
    }
    return map;
  }, [product]);

  return (
    <MinicartProvider actions={actions}>
      <div style={{ display: 'grid', gap: 32, maxWidth: 420 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--color-subtle)' }}>
            Buybox completo: swatches de cor, chips de tamanho, preço do SKU + CTA
          </p>
          <SkuSelector
            product={product}
            store="demo"
            freeShippingThreshold={60000}
            maxInstallments={12}
          />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--color-subtle)' }}>
            Com estoque: "Verde" esgotado (riscado / "Esgotado")
          </p>
          <SkuSelector
            product={product}
            store="demo"
            freeShippingThreshold={60000}
            maxInstallments={12}
            availability={availability}
          />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--color-subtle)' }}>
            Sob encomenda: "Verde" zerado mas vendável (tracejado / aviso âmbar / CTA compra)
          </p>
          <SkuSelector
            product={product}
            store="demo"
            freeShippingThreshold={60000}
            maxInstallments={12}
            availability={availability}
            backorder={backorder}
          />
        </div>
      </div>
    </MinicartProvider>
  );
}
