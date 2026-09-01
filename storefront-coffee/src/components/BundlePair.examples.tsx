// Catalog example for BundlePair (/ui-storefront/bundle-pair) — the theme's "compre junto" line: a compact
// horizontal pairing of two products (88px thumb + name + "Cor: …" variant + price each), a "+" between them,
// and a footer that sums the two and offers one "Adicionar os dois". Each side carries its own variant picker
// (cross-axis reachability greys dead-end combos). Wrapped in a stub MinicartProvider so the add actually drives
// a cart and opens the drawer, and given a store-bound `addToCart` fake so the button is live offline.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import type { ProductDoc } from '@forgecommerce/storefront-kit/read-client';
import { useMemo } from 'react';
import { BundlePair } from './BundlePair';
import { type MinicartActions, MinicartProvider } from './minicart/MinicartProvider';

/** A 1×1 colored square as a data URI — a stand-in cover photo (no media door in the offline preview). */
function square(color: string): string {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='${color}'/%3E%3C/svg%3E`;
}

/** Build a compact product with a Cor × Tamanho grid — the same ProductDoc shape the PDP showcase feeds. */
function buildProduct(
  id: string,
  title: string,
  handle: string,
  amount: number,
  compareAt: number | null,
  colors: { id: string; value: string; hex: string }[],
  sizes: string[],
): ProductDoc {
  const skus: ProductDoc['skus'] = [];
  const firstColorId = colors[0]?.id;
  const firstSize = sizes[0];
  for (const c of colors) {
    for (const s of sizes) {
      skus.push({
        id: `sku_${id}_${c.id}_${s}`,
        code: `${id.toUpperCase()}-${c.id.slice(0, 3).toUpperCase()}-${s}`,
        amount,
        currency: 'BRL',
        status: 'active',
        name: null,
        ref: null,
        ean: null,
        compare_at_amount: compareAt,
        is_default: c.id === firstColorId && s === firstSize,
        metadata: {},
        option_values: [
          { option_id: 'color', option_name: 'Cor', value_id: c.id, value: c.value },
          { option_id: 'size', option_name: 'Tamanho', value_id: s, value: s },
        ],
        media: [
          {
            provider_key: `demo/${id}/${c.id}`,
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
    product_id: id,
    title,
    description: null,
    handle,
    status: 'active',
    metadata: {},
    content_sections: [],
    meta_title: null,
    meta_description: null,
    options: [
      {
        id: 'color',
        name: 'Cor',
        position: 0,
        values: colors.map((c, i) => ({ id: c.id, value: c.value, position: i })),
      },
      {
        id: 'size',
        name: 'Tamanho',
        position: 1,
        values: sizes.map((s, i) => ({ id: s, value: s, position: i })),
      },
    ],
    skus,
    categories: [{ category_id: 'cat_corrida', path: 'tenis/corrida', is_primary: true }],
    media: [
      {
        provider_key: `demo/${id}/cover`,
        kind: 'image',
        role: 'hero',
        position: 0,
        url: square('%23c7cdd4'),
      },
    ],
  };
}

/** A live stub cart so the "Adicionar os dois" add re-reads a real snapshot and opens the drawer. */
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
        title: 'Item',
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

export function BundlePairExamples() {
  const actions = useStubActions();
  const base = useMemo(
    () =>
      buildProduct(
        'speed',
        'Tênis Speed Elite',
        'tenis-speed-elite',
        74990,
        97490,
        [
          { id: 'preto', value: 'Preto', hex: '%2317181a' },
          { id: 'azul', value: 'Azul', hex: '%231d4ed8' },
        ],
        ['39', '40', '41', '42'],
      ),
    [],
  );
  const paired = useMemo(
    () =>
      buildProduct(
        'meia',
        'Meia Performance',
        'meia-performance',
        3990,
        null,
        [
          { id: 'branco', value: 'Branco', hex: '%23e7e9ec' },
          { id: 'preto', value: 'Preto', hex: '%2317181a' },
        ],
        ['P', 'M', 'G'],
      ),
    [],
  );

  // The store-bound "add these SKUs" the PDP hands to its blocks — a no-op fake here (the stub cart records it).
  const addToCart = async (skuIds: string[]) => {
    for (const id of skuIds) await actions.addLine(id);
  };

  // PROMO — a quote as `read.price_together` answers it: the pair total AND the per-line split. The gallery
  // shows the three states a reviewer needs to see side by side, because two of them only exist in time.
  const quote = useMemo(() => {
    const a = base.skus[0];
    const b = paired.skus[0];
    if (!a || !b) return null;
    const subtotal = a.amount + b.amount;
    return {
      subtotal,
      total: Math.round(subtotal * 0.9),
      discount: subtotal - Math.round(subtotal * 0.9),
      lines: [
        { sku_id: a.id, unit_amount: a.amount, promotional_amount: Math.round(a.amount * 0.9) },
        { sku_id: b.id, unit_amount: b.amount, promotional_amount: Math.round(b.amount * 0.9) },
      ],
      promotions: [{ promotion_id: 'promo_pair', label: 'Leve os 2 juntos' }],
    };
  }, [base, paired]);

  return (
    <MinicartProvider actions={actions}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          maxWidth: 'var(--size-container)',
        }}
      >
        {/* 1. No promotion — it SUMS, which is what it did before the kernel could answer. */}
        <BundlePair base={base} paired={paired} addToCart={addToCart} maxInstallments={12} />
        {/* 2. With the kernel's quote — de/por on BOTH lines and on the total. */}
        <BundlePair
          base={base}
          paired={paired}
          addToCart={addToCart}
          maxInstallments={12}
          quote={quote}
        />
        {/* 3. Mid-flight: change a variant here and the number is HELD and marked while the answer is
            fetched (this example's `requote` never settles, so the updating state stays visible). */}
        <BundlePair
          base={base}
          paired={paired}
          addToCart={addToCart}
          maxInstallments={12}
          quote={quote}
          requote={() => new Promise(() => {})}
        />
      </div>
    </MinicartProvider>
  );
}
