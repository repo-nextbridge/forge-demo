// Catalog example for PdpBuyRow (/ui-storefront/pdp-buy-row) — the buybox CTA: ONE full-width "Adicionar ao
// carrinho" with the quantity stepper embedded (− N +). Wrapped in a LIVE stub MinicartProvider so the JS path
// actually adds at the chosen qty (the drawer would open in the real chrome); a second row shows the sold-out
// state ("Esgotado", disabled, no add path).
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import { useMemo } from 'react';
import { type MinicartActions, MinicartProvider } from '../minicart/MinicartProvider';
import { PdpBuyRow } from './PdpBuyRow';

/** A live in-memory cart port — add mutates a local array and re-reads, exactly like the real Server Actions. */
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
        variant: 'Preto · 40',
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

export function PdpBuyRowExamples() {
  const actions = useStubActions();
  // The no-JS fallback action: inert here (with a provider mounted, the JS path handles the add instead).
  const noop = async () => {};
  return (
    <MinicartProvider actions={actions}>
      <div style={{ display: 'grid', gap: 24, maxWidth: 460 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--color-subtle)' }}>Disponível: o + / − escolhe a quantidade</p>
          <PdpBuyRow action={noop} skuId="sku_speed_elite_preto_40" />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ color: 'var(--color-subtle)' }}>Esgotado: CTA desabilitado, sem adição</p>
          <PdpBuyRow action={noop} skuId="sku_speed_elite_preto_38" soldOut />
        </div>
      </div>
    </MinicartProvider>
  );
}
