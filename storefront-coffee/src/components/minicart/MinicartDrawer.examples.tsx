// Catalog example for MinicartDrawer (/ui-storefront/minicart-drawer) — the cart panel anchored under the header
// cart icon (a dropdown, NOT a side drawer). Driven by a LIVE stub cart (the same port shape MinicartTrigger
// uses): the qty box expands to − / +, zeroing removes the line, and the subtotal is the kernel totalizer relayed
// from the snapshot. An auto-open effect pops the panel on mount so the gallery shows it filled; a second instance
// shows the empty state. Effects don't run under renderToString, so SSR renders the (mounted-but-hidden) panel.
'use client';

import type { SummaryLine } from '@forgecommerce/storefront-kit/checkout/enrich';
import type { MinicartSnapshot } from '@forgecommerce/storefront-kit/minicart-types';
import { HOST_BASE } from '@forgecommerce/storefront-kit/store-route';
import { useEffect, useMemo } from 'react';
import { MinicartDrawer } from './MinicartDrawer';
import { type MinicartActions, MinicartProvider, useMinicart } from './MinicartProvider';

type L = {
  line_id: string;
  sku_id: string;
  qty: number;
  unit: number;
  title: string;
  variant: string;
};

/** A live stub port: add / update / remove mutate a local array and re-read, exactly like the real Server Actions. */
function useStubActions(seed: L[]): MinicartActions {
  return useMemo(() => {
    const cart: L[] = seed.map((l) => ({ ...l }));
    let seq = cart.length + 1;
    const snap = (): MinicartSnapshot => {
      const lines: SummaryLine[] = cart.map((l) => ({
        line_id: l.line_id,
        sku_id: l.sku_id,
        qty: l.qty,
        unit_amount: l.unit,
        line_total: l.unit * l.qty,
        title: l.title,
        variant: l.variant,
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
      addLine: async (sku, qty = 1) => {
        const hit = cart.find((l) => l.sku_id === sku);
        if (hit) hit.qty += qty;
        else
          cart.push({
            line_id: `ln_${seq++}`,
            sku_id: sku,
            qty,
            unit: 45990,
            title: 'Tênis Trail Grip',
            variant: '42 / Terracota',
          });
      },
      updateLine: async (id, qty) => {
        const l = cart.find((x) => x.line_id === id);
        if (l) l.qty = qty;
      },
      removeLine: async (id) => {
        const i = cart.findIndex((x) => x.line_id === id);
        if (i >= 0) cart.splice(i, 1);
      },
    };
  }, []);
}

/** Opens the panel on mount (icon-open mode) so the gallery shows the filled drawer. No-op under SSR. */
function AutoOpen() {
  const { openDrawer } = useMinicart();
  useEffect(() => {
    openDrawer();
  }, [openDrawer]);
  return null;
}

const FILLED: L[] = [
  {
    line_id: 'ln_1',
    sku_id: 'sku_1',
    qty: 1,
    unit: 69990,
    title: 'Tênis Velocity 9',
    variant: '40 / Branco',
  },
  {
    line_id: 'ln_2',
    sku_id: 'sku_2',
    qty: 2,
    unit: 32990,
    title: 'Meia Performance',
    variant: 'Único',
  },
];

export function MinicartDrawerExamples() {
  const filled = useStubActions(FILLED);
  const empty = useStubActions([]);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p style={{ color: 'var(--color-subtle)' }}>
        Com itens: stepper, swipe-remover e subtotal do kernel.
      </p>
      <div style={{ position: 'relative', minHeight: 420, padding: '80px 24px 0' }}>
        <MinicartProvider actions={filled}>
          <AutoOpen />
          <MinicartDrawer base={HOST_BASE} />
        </MinicartProvider>
      </div>

      <p style={{ color: 'var(--color-subtle)' }}>Vazio: o estado de carrinho sem itens.</p>
      <div style={{ position: 'relative', minHeight: 200, padding: '80px 24px 0' }}>
        <MinicartProvider actions={empty}>
          <AutoOpen />
          <MinicartDrawer base={HOST_BASE} />
        </MinicartProvider>
      </div>
    </div>
  );
}
